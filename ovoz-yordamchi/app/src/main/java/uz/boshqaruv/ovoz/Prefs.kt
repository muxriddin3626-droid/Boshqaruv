package uz.boshqaruv.ovoz

import android.content.Context

object Prefs {
    private fun sp(c: Context) = c.getSharedPreferences("sozlamalar", Context.MODE_PRIVATE)

    fun callControl(c: Context) = sp(c).getBoolean("qongiroq", false)
    fun setCallControl(c: Context, v: Boolean) = sp(c).edit().putBoolean("qongiroq", v).apply()

    fun continuous(c: Context) = sp(c).getBoolean("doimiy", false)
    fun setContinuous(c: Context, v: Boolean) = sp(c).edit().putBoolean("doimiy", v).apply()

    /** Telefonda o'zbekcha ovoz bo'lmasa — internet orqali o'zbekcha gapirish. */
    fun onlineVoice(c: Context) = sp(c).getBoolean("onlayn_ovoz", true)
    fun setOnlineVoice(c: Context, v: Boolean) = sp(c).edit().putBoolean("onlayn_ovoz", v).apply()

    /** Ovozni tanish tili: "uz-UZ" yoki "ru-RU". */
    fun language(c: Context): String = sp(c).getString("til", "uz-UZ") ?: "uz-UZ"
    fun setLanguage(c: Context, v: String) = sp(c).edit().putString("til", v).apply()

    /** Sun'iy intellekt (Claude) yoqilganmi va uning API kaliti. */
    fun aiEnabled(c: Context) = sp(c).getBoolean("ai", false)
    fun setAiEnabled(c: Context, v: Boolean) = sp(c).edit().putBoolean("ai", v).apply()
    fun apiKey(c: Context): String = sp(c).getString("api_kalit", "") ?: ""
    fun setApiKey(c: Context, v: String) = sp(c).edit().putString("api_kalit", v.trim()).apply()

    /** Hamma ilovalar ustida turadigan mikrofon tugmasi. */
    fun bubble(c: Context) = sp(c).getBoolean("tugma", false)
    fun setBubble(c: Context, v: Boolean) = sp(c).edit().putBoolean("tugma", v).apply()

    fun bubbleX(c: Context) = sp(c).getInt("tugma_x", 0)
    fun bubbleY(c: Context) = sp(c).getInt("tugma_y", -1)
    fun setBubblePosition(c: Context, x: Int, y: Int) = sp(c).edit().putInt("tugma_x", x).putInt("tugma_y", y).apply()
}
