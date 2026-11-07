package com.example.remoteagent

import okhttp3.*
import org.json.JSONObject

/**
 * Backend signaling serverga WebSocket ulanishini boshqaradi.
 * Server manzili va JWT token AuthStore'dan olinadi (soddalashtirilgan).
 */
class SignalingClient(
    private val onPairingRequest: (sessionId: String, controllerName: String) -> Unit,
    private val onMessage: (JSONObject) -> Unit
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
                    "pairing-request" -> onPairingRequest(
                        json.getString("sessionId"),
                        json.optString("controllerDeviceId", "Noma'lum qurilma")
                    )
                    else -> onMessage(json)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // Ishlab chiqarishda: eksponensial backoff bilan qayta ulanish kerak
            }
        })
    }

    fun sendPairingResponse(sessionId: String, approved: Boolean) {
        val msg = JSONObject().apply {
            put("type", "pairing-response")
            put("sessionId", sessionId)
            put("approved", approved)
        }
        ws?.send(msg.toString())
    }

    fun send(json: JSONObject) {
        ws?.send(json.toString())
    }

    fun close() {
        ws?.close(1000, "Yopildi")
    }
}

/** Oddiy konfiguratsiya - haqiqiy loyihada BuildConfig yoki remote config orqali olinadi. */
object Config {
    const val API_BASE_URL = "https://remote-control-backend-yox6.onrender.com"
    const val WS_BASE_URL = "wss://remote-control-backend-yox6.onrender.com"

    // WebRTC STUN/TURN. Mobil tarmoqda (NAT orqasida) ulanish uchun TURN shart.
    // ESLATMA: production'da bu ro'yxatni serverning GET /ice-servers endpointidan
    // olish tavsiya etiladi (TURN paroli kodda saqlanmasligi uchun). Bu yerda
    // soddalashtirilgan statik fallback berilgan.
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

/** Token va deviceId'ni saqlash uchun soddalashtirilgan joy (real loyihada EncryptedSharedPreferences). */
object AuthStore {
    var token: String? = null
    var deviceId: String? = null
}

/**
 * Faol SignalingClient'ga umumiy kirish nuqtasi. MainActivity bitta WS ulanishini
 * yaratadi va bu yerga qo'yadi; ScreenCaptureService offer/ICE yuborish uchun shuni
 * ishlatadi (ikkita alohida WS ulanish yaratmaslik uchun).
 */
object SignalingHub {
    @Volatile
    var client: SignalingClient? = null
}
