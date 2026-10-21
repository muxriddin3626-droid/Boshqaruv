package com.example.remoteagent

import okhttp3.*
import org.json.JSONObject
import java.io.IOException

object ApiClient {
    private val client = OkHttpClient()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    fun generatePairingCode(callback: (code: String?, error: String?) -> Unit) {
        val body = JSONObject().apply {
            put("agentDeviceId", AuthStore.deviceId)
        }.toString().toRequestBody(JSON)

        val request = Request.Builder()
            .url("${Config.API_BASE_URL}/pair/generate-code")
            .addHeader("Authorization", "Bearer ${AuthStore.token}")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(null, e.message)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        callback(null, "Server xatosi: ${it.code}")
                        return
                    }
                    val json = JSONObject(it.body?.string() ?: "{}")
                    callback(json.optString("code"), null)
                }
            }
        })
    }
}

// Kotlin OkHttp extension'lari uchun kerakli import'lar (ba'zi versiyalarda kerak bo'ladi)
private fun String.toMediaType() = okhttp3.MediaType.parse(this)!!
private fun String.toRequestBody(mediaType: okhttp3.MediaType) = RequestBody.create(mediaType, this)
