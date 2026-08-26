package com.example.remoteagent

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/**
 * Token va deviceId'ni shifrlangan holda saqlaydi (androidx.security).
 * build.gradle'ga qo'shish kerak: "androidx.security:security-crypto:1.1.0-alpha06"
 */
object SessionStore {
    private const val PREFS_NAME = "secure_session"

    fun save(context: Context, token: String, deviceId: String) {
        val prefs = getPrefs(context)
        prefs.edit().putString("token", token).putString("deviceId", deviceId).apply()
    }

    /** Saqlangan sessiya bo'lsa AuthStore'ga yuklaydi va true qaytaradi. */
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
