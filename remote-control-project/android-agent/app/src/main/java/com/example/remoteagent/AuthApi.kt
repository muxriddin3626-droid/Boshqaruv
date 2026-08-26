package com.example.remoteagent

import okhttp3.*
import org.json.JSONObject
import java.io.IOException

object AuthApi {
    private val client = OkHttpClient()
    private val JSON = MediaType.parse("application/json; charset=utf-8")!!

    fun register(email: String, password: String, callback: (token: String?, error: String?) -> Unit) =
        authCall("/auth/register", email, password, callback)

    fun login(email: String, password: String, callback: (token: String?, error: String?) -> Unit) =
        authCall("/auth/login", email, password, callback)

    private fun authCall(path: String, email: String, password: String, callback: (String?, String?) -> Unit) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }.toString()

        val request = Request.Builder()
            .url("${Config.API_BASE_URL}$path")
            .post(RequestBody.create(JSON, body))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) = callback(null, e.message)
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        val errBody = runCatching { JSONObject(it.body?.string() ?: "{}").optString("error") }.getOrNull()
                        callback(null, errBody ?: "Server xatosi: ${it.code}")
                        return
                    }
                    val json = JSONObject(it.body?.string() ?: "{}")
                    callback(json.optString("token"), null)
                }
            }
        })
    }

    fun registerDevice(name: String, role: String, platform: String, callback: (deviceId: String?, error: String?) -> Unit) {
        val body = JSONObject().apply {
            put("name", name)
            put("role", role)
            put("platform", platform)
        }.toString()

        val request = Request.Builder()
            .url("${Config.API_BASE_URL}/devices/register")
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
                    callback(json.optString("deviceId"), null)
                }
            }
        })
    }
}
