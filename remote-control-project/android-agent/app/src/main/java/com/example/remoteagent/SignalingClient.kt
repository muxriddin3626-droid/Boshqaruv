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
    const val API_BASE_URL = "https://your-backend.example.com"
    const val WS_BASE_URL = "wss://your-backend.example.com"
}

/** Token va deviceId'ni saqlash uchun soddalashtirilgan joy (real loyihada EncryptedSharedPreferences). */
object AuthStore {
    var token: String? = null
    var deviceId: String? = null
}
