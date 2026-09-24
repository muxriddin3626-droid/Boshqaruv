package uz.boshqaruv.ovoz

import android.content.Context

object Prefs {
    private fun sp(c: Context) = c.getSharedPreferences("sozlamalar", Context.MODE_PRIVATE)

    fun callControl(c: Context) = sp(c).getBoolean("qongiroq", false)
    fun setCallControl(c: Context, v: Boolean) = sp(c).edit().putBoolean("qongiroq", v).apply()

    fun continuous(c: Context) = sp(c).getBoolean("doimiy", false)
    fun setContinuous(c: Context, v: Boolean) = sp(c).edit().putBoolean("doimiy", v).apply()

    /** Ovozni tanish tili: "uz-UZ" yoki "ru-RU". */
    fun language(c: Context): String = sp(c).getString("til", "uz-UZ") ?: "uz-UZ"
    fun setLanguage(c: Context, v: String) = sp(c).edit().putString("til", v).apply()
}
