package uz.tozaekran

import android.content.Context
import android.content.SharedPreferences
import java.security.MessageDigest

/** Barcha sozlamalar bir joyda. */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("toza_ekran", Context.MODE_PRIVATE)

    /** 0 = past, 1 = o'rta, 2 = yuqori */
    var sensitivity: Int
        get() = sp.getInt("sensitivity", 1)
        set(v) = sp.edit().putInt("sensitivity", v).apply()

    var imageScan: Boolean
        get() = sp.getBoolean("image_scan", true)
        set(v) = sp.edit().putBoolean("image_scan", v).apply()

    var textScan: Boolean
        get() = sp.getBoolean("text_scan", true)
        set(v) = sp.edit().putBoolean("text_scan", v).apply()

    /** Sozlamalarda ilovani o'chirishga urinishni bloklash (PIN kerak). */
    var protect: Boolean
        get() = sp.getBoolean("protect", false)
        set(v) = sp.edit().putBoolean("protect", v).apply()

    var customWords: String
        get() = sp.getString("custom_words", "") ?: ""
        set(v) = sp.edit().putString("custom_words", v).apply()

    val blockedCount: Int get() = sp.getInt("blocked_count", 0)
    fun incBlocked() = sp.edit().putInt("blocked_count", blockedCount + 1).apply()

    /** PIN to'g'ri kiritilgandan keyin vaqtincha himoya to'xtatiladi. */
    var unlockedUntil: Long
        get() = sp.getLong("unlocked_until", 0L)
        set(v) = sp.edit().putLong("unlocked_until", v).apply()

    fun isUnlocked(): Boolean = System.currentTimeMillis() < unlockedUntil

    val hasPin: Boolean get() = sp.getString("pin_hash", null) != null

    fun setPin(pin: String?) {
        if (pin.isNullOrEmpty()) {
            sp.edit().remove("pin_hash").putBoolean("protect", false).apply()
        } else {
            sp.edit().putString("pin_hash", hash(pin)).apply()
        }
    }

    fun checkPin(pin: String): Boolean {
        val saved = sp.getString("pin_hash", null) ?: return true
        return saved == hash(pin)
    }

    private fun hash(pin: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val bytes = md.digest(("toza-ekran:" + pin).toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
