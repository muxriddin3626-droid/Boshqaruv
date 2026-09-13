package com.example.remotecontroller

import okhttp3.*
import org.json.JSONObject
import java.io.IOException

object ApiClient {
    private val client = OkHttpClient()
    private val JSON = MediaType.parse("application/json; charset=utf-8")!!

    fun claimPairingCode(code: String, callback: (sessionId: String?, error: String?) -> Unit) {
        val body = JSONObject().apply {
            put("code", code)
            put("controllerDeviceId", AuthStore.deviceId)
        }.toString()

        val request = Request.Builder()
            .url("${Config.API_BASE_URL}/pair/claim")
            .addHeader("Authorization", "Bearer ${AuthStore.token}")
            .post(RequestBody.create(JSON, body))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) = callback(null, e.message)
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        callback(null, "Server xatosi: ${it.code}")
                        return
                    }
                    val json = JSONObject(it.body?.string() ?: "{}")
                    callback(json.optString("sessionId"), null)
                }
            }
        })
    }
}
