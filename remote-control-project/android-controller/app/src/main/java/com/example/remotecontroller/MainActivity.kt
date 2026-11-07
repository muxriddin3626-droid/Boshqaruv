package com.example.remotecontroller

import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import org.webrtc.*

/**
 * Controller ekrani (kuzatuvchi tomon).
 *
 * Oqim:
 *  1) Foydalanuvchi Agent tomonda ko'rsatilgan 6 xonali kodni kiritadi
 *  2) Backend orqali sessiya yaratiladi va Agent tomonda tasdiqlash so'raladi
 *  3) Agent RUXSAT BERGANDAN keyingina WebRTC video oqimi boshlanadi
 *  4) Ekrandagi tegishlar/surishlar normalizatsiya qilingan (0.0-1.0)
 *     koordinatalar sifatida signaling orqali Agent'ga yuboriladi -
 *     bu Agent tomonidagi haqiqiy ekran o'lchamidan qat'i nazar to'g'ri ishlaydi
 */
class MainActivity : AppCompatActivity() {

    private lateinit var signalingClient: SignalingClient
    private lateinit var remoteScreenView: SurfaceViewRenderer
    private lateinit var statusDot: android.view.View
    private lateinit var statusLabel: android.widget.TextView
    private lateinit var eglBase: EglBase
    private lateinit var peerConnectionFactory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private var sessionId: String? = null
    private lateinit var codeInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        remoteScreenView = findViewById(R.id.remoteScreenView)
        statusDot = findViewById(R.id.statusDot)
        statusLabel = findViewById(R.id.statusLabel)
        val codeInputView = findViewById<EditText>(R.id.pairingCodeInput)
        codeInput = codeInputView
        val connectBtn = findViewById<Button>(R.id.connectBtn)

        eglBase = EglBase.create()
        remoteScreenView.init(eglBase.eglBaseContext, null)

        signalingClient = SignalingClient(
            onPairingResult = { approved ->
                runOnUiThread {
                    if (approved) {
                        Toast.makeText(this, "Ruxsat berildi, ulanmoqda...", Toast.LENGTH_SHORT).show()
                        statusDot.setBackgroundResource(R.drawable.dot_live)
                        statusLabel.text = "Ulangan"
                        initPeerConnectionAndCreateOffer()
                    } else {
                        statusLabel.text = "Rad etildi"
                        Toast.makeText(this, "Boshqa tomon ulanishni rad etdi", Toast.LENGTH_LONG).show()
                    }
                }
            },
            onRemoteSdp = { sdpJson -> handleRemoteAnswer(sdpJson) },
            onRemoteIceCandidate = { candidateJson -> handleRemoteIceCandidate(candidateJson) }
        )
        signalingClient.connect()

        connectBtn.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.length != 6) {
                Toast.makeText(this, "6 xonali kodni kiriting", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            claimCode(code)
        }

        // Agar ilova havola orqali ochilgan bo'lsa (masalan remoteagent://pair/123456),
        // kodni avtomatik o'qib, ulanishga urinamiz
        handleIncomingLink(intent)

        // Tegishlarni normalizatsiya qilingan koordinata sifatida yuborish
        remoteScreenView.setOnTouchListener { view, event ->
            val nx = event.x / view.width.toFloat()
            val ny = event.y / view.height.toFloat()
            when (event.action) {
                MotionEvent.ACTION_DOWN -> sendTap(nx, ny)
                // ACTION_MOVE va ACTION_UP orqali swipe/drag ham qo'shish mumkin
            }
            true
        }
    }

    /** Havoladagi kodni ajratib olish va ulanishga urinish (masalan remoteagent://pair/123456). */
    private fun handleIncomingLink(intent: Intent?) {
        val uri = intent?.data ?: return
        val code = uri.lastPathSegment?.trim() ?: return
        if (code.length == 6 && code.all { it.isDigit() }) {
            codeInput.setText(code)
            claimCode(code)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingLink(intent)
    }

    private fun claimCode(code: String) {
        statusLabel.text = "Ulanmoqda..."
        ApiClient.claimPairingCode(code) { sid, error ->
            runOnUiThread {
                if (error != null) {
                    statusLabel.text = "Ulanmagan"
                    Toast.makeText(this, "Xatolik: $error", Toast.LENGTH_LONG).show()
                } else {
                    sessionId = sid
                    statusLabel.text = "Kutilmoqda..."
                    Toast.makeText(this, "Kutilmoqda: ikkinchi tomon tasdiqlashi kerak...", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun sendTap(nx: Float, ny: Float) {
        val sid = sessionId ?: return
        val payload = JSONObject().apply {
            put("action", "tap")
            put("x", nx) // Agent tomonda haqiqiy ekran kengligiga ko'paytiriladi
            put("y", ny)
        }
        signalingClient.sendInputCommand(sid, payload)
    }

    private fun initPeerConnectionAndCreateOffer() {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(applicationContext).createInitializationOptions()
        )
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        val rtcConfig = PeerConnection.RTCConfiguration(emptyList())
        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                val sid = sessionId ?: return
                signalingClient.sendIceCandidate(sid, candidate)
            }
            override fun onAddStream(stream: MediaStream) {
                runOnUiThread {
                    stream.videoTracks.firstOrNull()?.addSink(remoteScreenView)
                }
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        })
        // Agent video yuboradi, Controller faqat qabul qiladi (recvonly)
        peerConnection?.addTransceiver(
            MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO,
            RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY)
        )
    }

    private fun handleRemoteAnswer(sdpJson: JSONObject) {
        val sdp = SessionDescription(SessionDescription.Type.ANSWER, sdpJson.getString("sdp"))
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {}
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(p0: String?) {}
        }, sdp)
    }

    private fun handleRemoteIceCandidate(json: JSONObject) {
        val candidate = IceCandidate(
            json.getString("sdpMid"),
            json.getInt("sdpMLineIndex"),
            json.getString("candidate")
        )
        peerConnection?.addIceCandidate(candidate)
    }

    override fun onDestroy() {
        super.onDestroy()
        peerConnection?.close()
        remoteScreenView.release()
        signalingClient.close()
    }
}
