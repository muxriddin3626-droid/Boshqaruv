package com.example.remoteagent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject

/**
 * Controller'dan kelgan buyruqlarni (tegish, surish, matn kiritish, navigatsiya)
 * haqiqiy jest/amal sifatida bajaradi. Buyruqlar SignalingClient orqali JSON
 * ko'rinishida keladi va bu yerga handleCommand(payload) orqali uzatiladi.
 *
 * MUHIM — koordinatalar normalizatsiya qilingan (0.0..1.0):
 *   Controller ekran o'lchamidan qat'i nazar nisbiy koordinata yuboradi
 *   (x = bosilgan_joy / ekran_kengligi). Bu yerda ular Agent qurilmaning
 *   HAQIQIY ekran o'lchamiga ko'paytiriladi. Shu sababli ikki telefon
 *   o'lchami har xil bo'lsa ham tegish to'g'ri joyga tushadi.
 *
 * Faqat joriy TASDIQLANGAN sessiyaga tegishli buyruqlar bu yerga yetib keladi -
 * server tomonida ham approved==true tekshiriladi (himoyaning ikkinchi qatlami).
 */
class RemoteInputAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* kerak emas */ }
    override fun onInterrupt() { }

    /**
     * payload misollari:
     *   {"action":"tap","x":0.5,"y":0.42}
     *   {"action":"swipe","x1":0.2,"y1":0.8,"x2":0.2,"y2":0.2,"durationMs":300}
     *   {"action":"text","text":"salom"}   -> fokusdagi maydonga matn yozadi
     *   {"action":"clearText"}              -> fokusdagi maydonni tozalaydi
     *   {"action":"back" | "home" | "recents"}
     */
    fun handleCommand(payload: JSONObject) {
        val w = resources.displayMetrics.widthPixels.toFloat()
        val h = resources.displayMetrics.heightPixels.toFloat()
        when (payload.optString("action")) {
            "tap" -> performTap(
                normX(payload.getDouble("x"), w),
                normY(payload.getDouble("y"), h)
            )
            "swipe" -> performSwipe(
                normX(payload.getDouble("x1"), w), normY(payload.getDouble("y1"), h),
                normX(payload.getDouble("x2"), w), normY(payload.getDouble("y2"), h),
                payload.optLong("durationMs", 300)
            )
            "text" -> setFocusedText(payload.optString("text"))
            "clearText" -> setFocusedText("")
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
        }
    }

    /** 0..1 -> piksel; chegaradan chiqib ketmasligi uchun qisqartiriladi. */
    private fun normX(v: Double, width: Float) = (v.toFloat().coerceIn(0f, 1f)) * width
    private fun normY(v: Double, height: Float) = (v.toFloat().coerceIn(0f, 1f)) * height

    private fun performTap(x: Float, y: Float) {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
            .build()
        dispatchGesture(gesture, null, null)
    }

    private fun performSwipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long) {
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs.coerceIn(1, 60_000)))
            .build()
        dispatchGesture(gesture, null, null)
    }

    /**
     * Fokusdagi tahrirlanadigan maydonni topib, unga matn yozadi (ACTION_SET_TEXT
     * butun matnni almashtiradi). Fokusda maydon bo'lmasa, hech narsa qilinmaydi.
     */
    private fun setFocusedText(text: String) {
        val node = findEditableFocus() ?: return
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        node.recycle()
    }

    /** Avval kiritish fokusini, bo'lmasa oddiy fokusni qaytaradi (tahrirlanadigan bo'lsa). */
    private fun findEditableFocus(): AccessibilityNodeInfo? {
        findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.let { if (it.isEditable) return it }
        val root = rootInActiveWindow ?: return null
        return root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }
    }

    companion object {
        /** MainActivity/Service'lar bu orqali joriy ishlab turgan instansga murojaat qiladi. */
        var instance: RemoteInputAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
