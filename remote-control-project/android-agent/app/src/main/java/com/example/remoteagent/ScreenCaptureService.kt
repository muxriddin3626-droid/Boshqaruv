package com.example.remoteagent

import android.app.*
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import org.webrtc.*

/**
 * Foreground service - ekranni video oqimiga aylantiradi va WebRTC orqali
 * tasdiqlangan Controller qurilmaga uzatadi.
 *
 * WebRTC oqimi (bu service "offer" tomoni):
 *  1) MediaProjection -> ekran video manbasi -> video track
 *  2) PeerConnection yaratiladi, track qo'shiladi
 *  3) createOffer -> setLocalDescription -> SignalingHub orqali Controller'ga
 *     "offer" yuboriladi
 *  4) Controller "answer" qaytaradi -> setRemoteDescription
 *  5) Ikki tomon ICE candidate almashadi -> P2P video oqim boshlanadi
 *
 * MUHIM: Android tizimi bu service ishlab turganda EKRANDA doimiy bildirishnoma
 * ko'rsatishni talab qiladi - buni dastur o'chira olmaydi.
 */
class ScreenCaptureService : Service() {

    private lateinit var eglBase: EglBase
    private lateinit var peerConnectionFactory: PeerConnectionFactory
    private var videoCapturer: VideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var peerConnection: PeerConnection? = null
    private var sessionId: String? = null
    private var permissionData: Intent? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        sessionId = intent?.getStringExtra("sessionId")
        val data = intent?.getParcelableExtra<Intent>("data") ?: return START_NOT_STICKY
        permissionData = data

        // Android 14 (API 34): mediaProjection foreground service TUR bilan
        // startForeground qilinishi SHART, aks holda ilova yiqiladi.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID, buildNotification(),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }

        // MUHIM: getMediaProjection'ni O'ZIMIZ chaqirmaymiz - MediaProjection
        // tokeni BIR MARTALIK. ScreenCapturerAndroid uni ichida o'zi ishlatadi;
        // biz ham chaqirsak, Android 14'da ikkinchi chaqiruv yiqitadi.
        instance = this
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
        videoCapturer = ScreenCapturerAndroid(
            permissionData,
            object : MediaProjection.Callback() {
                override fun onStop() { stopSelf() }
            }
        )
        val source = peerConnectionFactory.createVideoSource(true)
        videoSource = source
        surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        videoCapturer?.initialize(surfaceHelper, applicationContext, source.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30)

        val videoTrack = peerConnectionFactory.createVideoTrack("screen_track", source)

        val rtcConfig = PeerConnection.RTCConfiguration(Config.iceServers())
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate ?: return
                val sid = sessionId ?: return
                val json = JSONObject().apply {
                    put("type", "ice-candidate")
                    put("sessionId", sid)
                    put("candidate", candidate.sdp)
                    put("sdpMid", candidate.sdpMid)
                    put("sdpMLineIndex", candidate.sdpMLineIndex)
                }
                SignalingHub.client?.send(json)
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

        // SDP offer yaratish va Controller'ga yuborish
        peerConnection?.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(p0: SessionDescription?) {
                val desc = p0 ?: return
                peerConnection?.setLocalDescription(SimpleSdpObserver(), desc)
                val sid = sessionId ?: return
                val json = JSONObject().apply {
                    put("type", "offer")
                    put("sessionId", sid)
                    put("sdp", desc.description)
                }
                SignalingHub.client?.send(json)
            }
        }, MediaConstraints())
    }

    /** Controller'dan kelgan "answer" - setRemoteDescription. */
    fun onRemoteAnswer(sdp: String) {
        val answer = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        peerConnection?.setRemoteDescription(SimpleSdpObserver(), answer)
    }

    /** Controller'dan kelgan ICE candidate. */
    fun onRemoteIce(json: JSONObject) {
        val candidate = IceCandidate(
            json.getString("sdpMid"),
            json.getInt("sdpMLineIndex"),
            json.getString("candidate")
        )
        peerConnection?.addIceCandidate(candidate)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
        try { videoCapturer?.stopCapture() } catch (_: Exception) {}
        videoCapturer?.dispose()
        videoSource?.dispose()
        surfaceHelper?.dispose()
        peerConnection?.close()
    }

    companion object {
        const val NOTIFICATION_ID = 42
        const val Activity_RESULT_CANCELED = 0

        /** MainActivity shu orqali kelgan answer/ICE'ni service'ga uzatadi. */
        @Volatile
        var instance: ScreenCaptureService? = null
    }
}

/** Barcha metodlari bo'sh standart SdpObserver - faqat kerakligini qayta yozamiz. */
open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(p0: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(p0: String?) {}
    override fun onSetFailure(p0: String?) {}
}
