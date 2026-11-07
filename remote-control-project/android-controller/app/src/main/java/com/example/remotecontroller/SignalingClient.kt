package com.example.remotecontroller

import okhttp3.*
import org.json.JSONObject
import org.webrtc.IceCandidate

class SignalingClient(
    private val onPairingResult: (approved: Boolean) -> Unit,
    private val onRemoteSdp: (JSONObject) -> Unit,
    private val onRemoteIceCandidate: (JSONObject) -> Unit
) {
    private val client = OkHttpClient()
    private var ws: WebSocket? = null

    fun connect() {
        val token = AuthStore.token ?: return
        val deviceId = AuthStore.deviceId ?: return
        val url = "${Config.WS_BASE_URL}/ws?token=$token&deviceId=$deviceId"
        val request = Request.Builder().url(url).build()

        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val json = JSONObject(text)
                when (json.optString("type")) {
                    "pairing-result" -> onPairingResult(json.optBoolean("approved", false))
                    // Agent "offer" tomoni; controller javob (answer) qaytaradi
                    "offer" -> onRemoteSdp(json)
                    "ice-candidate" -> onRemoteIceCandidate(json)
                }
            }
        })
    }

    fun sendIceCandidate(sessionId: String, candidate: IceCandidate) {
        val msg = JSONObject().apply {
            put("type", "ice-candidate")
            put("sessionId", sessionId)
            put("candidate", candidate.sdp)
            put("sdpMid", candidate.sdpMid)
            put("sdpMLineIndex", candidate.sdpMLineIndex)
        }
        ws?.send(msg.toString())
    }

    /** Agent "offer"iga javoban "answer" yuboradi. */
    fun sendAnswer(sessionId: String, sdp: String) {
        val msg = JSONObject().apply {
            put("type", "answer")
            put("sessionId", sessionId)
            put("sdp", sdp)
        }
        ws?.send(msg.toString())
    }

    fun sendInputCommand(sessionId: String, payload: JSONObject) {
        val msg = JSONObject().apply {
            put("type", "input-command")
            put("sessionId", sessionId)
            put("payload", payload)
        }
        ws?.send(msg.toString())
    }

    fun close() = ws?.close(1000, "Yopildi")
}

object Config {
    const val API_BASE_URL = "https://remote-control-backend-yox6.onrender.com"
    const val WS_BASE_URL = "wss://remote-control-backend-yox6.onrender.com"

    // WebRTC STUN/TURN. Mobil tarmoqda (NAT orqasida) ulanish uchun TURN shart.
    // ESLATMA: production'da bu ro'yxatni serverning GET /ice-servers endpointidan
    // olish tavsiya etiladi (TURN paroli kodda saqlanmasligi uchun).
    const val STUN_URL = "stun:stun.l.google.com:19302"

    // TURN - mobil tarmoqda (NAT ortida) ulanish uchun MAJBURIY. Bu yerda bepul
    // ochiq relay (Metered Open Relay) ishlatilgan - ro'yxatdan o'tish shart emas.
    // Ishonchliroq/tezroq kerak bo'lsa, o'z Metered yoki Twilio TURN ma'lumotlaringizni qo'ying.
    private const val TURN_USER = "openrelayproject"
    private const val TURN_PASS = "openrelayproject"

    /** ICE serverlar: STUN + TURN (bir nechta port/transport - maksimal ulanish ehtimoli). */
    fun iceServers(): List<org.webrtc.PeerConnection.IceServer> {
        fun turn(url: String) = org.webrtc.PeerConnection.IceServer.builder(url)
            .setUsername(TURN_USER).setPassword(TURN_PASS).createIceServer()
        return listOf(
            org.webrtc.PeerConnection.IceServer.builder(STUN_URL).createIceServer(),
            org.webrtc.PeerConnection.IceServer.builder("stun:openrelay.metered.ca:80").createIceServer(),
            turn("turn:openrelay.metered.ca:80"),
            turn("turn:openrelay.metered.ca:443"),
            turn("turn:openrelay.metered.ca:443?transport=tcp")
        )
    }
}

object AuthStore {
    var token: String? = null
    var deviceId: String? = null
}
