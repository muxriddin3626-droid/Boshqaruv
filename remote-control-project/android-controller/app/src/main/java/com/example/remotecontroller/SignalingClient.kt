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
                    "answer" -> onRemoteSdp(json)
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
    const val API_BASE_URL = "https://your-backend.example.com"
    const val WS_BASE_URL = "wss://your-backend.example.com"

    // WebRTC STUN/TURN. Mobil tarmoqda (NAT orqasida) ulanish uchun TURN shart.
    // ESLATMA: production'da bu ro'yxatni serverning GET /ice-servers endpointidan
    // olish tavsiya etiladi (TURN paroli kodda saqlanmasligi uchun).
    const val STUN_URL = "stun:stun.l.google.com:19302"
    const val TURN_URL = ""        // masalan "turn:turn.example.com:3478"
    const val TURN_USERNAME = ""
    const val TURN_PASSWORD = ""

    /** RTCConfiguration uchun ICE server ro'yxati (STUN + agar sozlangan bo'lsa TURN). */
    fun iceServers(): List<org.webrtc.PeerConnection.IceServer> {
        val list = mutableListOf(
            org.webrtc.PeerConnection.IceServer.builder(STUN_URL).createIceServer()
        )
        if (TURN_URL.isNotEmpty()) {
            list.add(
                org.webrtc.PeerConnection.IceServer.builder(TURN_URL)
                    .setUsername(TURN_USERNAME)
                    .setPassword(TURN_PASSWORD)
                    .createIceServer()
            )
        }
        return list
    }
}

object AuthStore {
    var token: String? = null
    var deviceId: String? = null
}
