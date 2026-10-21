package com.example.remotecontroller

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object SessionStore {
    private const val PREFS_NAME = "secure_session"

    fun save(context: Context, token: String, deviceId: String) {
        getPrefs(context).edit().putString("token", token).putString("deviceId", deviceId).apply()
    }

    fun load(context: Context): Boolean {
        val prefs = getPrefs(context)
        val token = prefs.getString("token", null) ?: return false
        val deviceId = prefs.getString("deviceId", null) ?: return false
        AuthStore.token = token
        AuthStore.deviceId = deviceId
        return true
    }

    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
        AuthStore.token = null
        AuthStore.deviceId = null
    }

    private fun getPrefs(context: Context) = EncryptedSharedPreferences.create(
        PREFS_NAME,
        MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
}
