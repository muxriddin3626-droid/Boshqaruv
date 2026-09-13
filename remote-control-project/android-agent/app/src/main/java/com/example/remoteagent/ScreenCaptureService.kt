package com.example.remoteagent

import android.app.*
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.webrtc.*

/**
 * Foreground service - ekranni video oqimiga aylantiradi va WebRTC orqali
 * tasdiqlangan Controller qurilmaga uzatadi.
 *
 * MUHIM: Bu service ishlab turgan vaqtda Android tizimi EKRANDA doimiy
 * bildirishnoma ko'rsatishni talab qiladi (buni dastur o'chira olmaydi).
 * Bu - foydalanuvchi hech qachon bilmasdan kuzatilmasligi uchun platformaning
 * o'zi qo'ygan xavfsizlik kafolati.
 */
class ScreenCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private lateinit var eglBase: EglBase
    private lateinit var peerConnectionFactory: PeerConnectionFactory
    private var videoCapturer: VideoCapturer? = null
    private var peerConnection: PeerConnection? = null
    private var sessionId: String? = null
    private var permissionData: Intent? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        sessionId = intent?.getStringExtra("sessionId")
        val resultCode = intent?.getIntExtra("resultCode", Activity_RESULT_CANCELED) ?: return START_NOT_STICKY
        val data = intent.getParcelableExtra<Intent>("data") ?: return START_NOT_STICKY
        permissionData = data

        startForeground(NOTIFICATION_ID, buildNotification())

        val projectionManager = getSystemService(MediaProjectionManager::class.java)
        mediaProjection = projectionManager.getMediaProjection(resultCode, data)

        initWebRtcAndStartStreaming()
        return START_NOT_STICKY
    }

    private fun buildNotification(): Notification {
        val channelId = "screen_capture_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "Ekran uzatish", NotificationManager.IMPORTANCE_HIGH
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        // "To'xtatish" tugmasi - foydalanuvchi istalgan vaqtda seansni darhol
        // to'xtatishi mumkin bo'lishi shart
        val stopIntent = Intent(this, StopSessionReceiver::class.java)
        val stopPending = PendingIntent.getBroadcast(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle(getString(R.string.capture_notification_title))
            .setContentText(getString(R.string.capture_notification_text))
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .addAction(0, "To'xtatish", stopPending)
            .build()
    }

    private fun initWebRtcAndStartStreaming() {
        eglBase = EglBase.create()

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(applicationContext).createInitializationOptions()
        )

        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        // Ekranni video manba sifatida olish (ruxsat intent'i - permissionData)
        videoCapturer = org.webrtc.ScreenCapturerAndroid(
            permissionData,
            object : MediaProjection.Callback() {
                override fun onStop() { stopSelf() }
            }
        )
        val videoSource = peerConnectionFactory.createVideoSource(true)
        val surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        videoCapturer?.initialize(surfaceHelper, applicationContext, videoSource.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30)

        val videoTrack = peerConnectionFactory.createVideoTrack("screen_track", videoSource)

        // ICE server sozlamalari - backend'dan olingan STUN/TURN
        val iceServers = listOf(
            PeerConnection.IceServer.builder(Config.WS_BASE_URL /* STUN/TURN URL bu yerga */).createIceServer()
        )
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)

        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                // signalingClient orqali qarama-qarshi tomonga yuborish kerak
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        })

        peerConnection?.addTrack(videoTrack, listOf("screen_stream"))

        // Bu yerdan keyingi qadam: SDP offer yaratish va SignalingClient orqali
        // Controller'ga yuborish (createOffer -> setLocalDescription -> yuborish)
    }

    override fun onDestroy() {
        super.onDestroy()
        videoCapturer?.stopCapture()
        peerConnection?.close()
        mediaProjection?.stop()
    }

    companion object {
        const val NOTIFICATION_ID = 42
        const val Activity_RESULT_CANCELED = 0
    }
}
