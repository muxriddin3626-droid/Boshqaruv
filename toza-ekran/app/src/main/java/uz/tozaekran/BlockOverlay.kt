package uz.tozaekran

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/** Butun ekranni yopadigan qora oyna. */
class BlockOverlay(private val service: AccessibilityService) {

    private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val handler = Handler(Looper.getMainLooper())
    private var view: View? = null

    val isShowing: Boolean get() = view != null

    /** 18+ kontent topilganda. */
    fun showContentBlock(reason: String) {
        hide()
        val root = baseLayout()
        root.addView(text("🛡️", 64f, Color.WHITE))
        root.addView(text("18+ kontent bloklandi", 26f, Color.WHITE, bold = true))
        root.addView(text("Toza Ekran sizni himoya qildi.\nBu sahifa yopildi.", 16f, 0xFFB8C4C2.toInt()))
        root.addView(text(reason, 13f, 0xFF6F7F7C.toInt()))
        val ok = button("Tushunarli (3)")
        ok.isEnabled = false
        ok.setOnClickListener { hide() }
        root.addView(ok)
        attach(root, focusable = false)

        var left = 3
        val tick = object : Runnable {
            override fun run() {
                if (view !== root) return
                left--
                if (left > 0) {
                    ok.text = "Tushunarli ($left)"
                    handler.postDelayed(this, 1000)
                } else {
                    ok.text = "Tushunarli"
                    ok.isEnabled = true
                }
            }
        }
        handler.postDelayed(tick, 1000)
        // 8 soniyadan keyin o'zi yopiladi
        handler.postDelayed({ if (view === root) hide() }, 8000)
    }

    /** Sozlamalarda ilovani o'chirishga urinilganda — PIN so'raladi. */
    fun showPinBlock(onCorrectPin: (String) -> Boolean, onExit: () -> Unit) {
        hide()
        val root = baseLayout()
        root.addView(text("🔒", 56f, Color.WHITE))
        root.addView(text("Himoyalangan", 24f, Color.WHITE, bold = true))
        root.addView(text("Toza Ekran sozlamalarini o'zgartirish uchun ota-ona PIN-kodini kiriting.", 15f, 0xFFB8C4C2.toInt()))

        val input = EditText(service).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "PIN"
            setTextColor(Color.WHITE)
            setHintTextColor(0xFF6F7F7C.toInt())
            gravity = Gravity.CENTER
            textSize = 22f
            background = rounded(0xFF22302E.toInt())
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        root.addView(input, LinearLayout.LayoutParams(dp(220), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(20)
        })
        val err = text("", 14f, 0xFFFF7A70.toInt())
        root.addView(err)

        val unlock = button("Ochish")
        unlock.setOnClickListener {
            if (onCorrectPin(input.text.toString())) {
                hideKeyboard(input)
                hide()
            } else {
                err.text = "PIN noto'g'ri"
                input.setText("")
            }
        }
        root.addView(unlock)

        val exit = button("Chiqish", secondary = true)
        exit.setOnClickListener {
            hideKeyboard(input)
            hide()
            onExit()
        }
        root.addView(exit)
        attach(root, focusable = true)
        input.requestFocus()
    }

    fun hide() {
        handler.removeCallbacksAndMessages(null)
        view?.let { runCatching { wm.removeView(it) } }
        view = null
    }

    private fun attach(v: View, focusable: Boolean) {
        var flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        if (!focusable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT
        )
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        try {
            wm.addView(v, lp)
            view = v
        } catch (_: Exception) {
            view = null
        }
    }

    private fun baseLayout() = LinearLayout(service).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(0xFA0E1513.toInt())
        setPadding(dp(32), dp(32), dp(32), dp(32))
        isClickable = true // ostidagi ilovaga bosish o'tmasin
    }

    private fun text(s: String, sp: Float, color: Int, bold: Boolean = false) = TextView(service).apply {
        text = s
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(6))
    }

    private fun button(s: String, secondary: Boolean = false): Button {
        val b = Button(service)
        b.text = s
        b.isAllCaps = false
        b.textSize = 16f
        b.setTextColor(if (secondary) 0xFFB8C4C2.toInt() else Color.WHITE)
        b.background = rounded(if (secondary) 0x00000000 else 0xFF0E7C66.toInt())
        b.layoutParams = LinearLayout.LayoutParams(dp(220), dp(52)).apply { topMargin = dp(16) }
        return b
    }

    private fun rounded(color: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(14).toFloat()
    }

    private fun hideKeyboard(v: View) {
        val imm = service.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(v.windowToken, 0)
    }

    private fun dp(v: Int) = (v * service.resources.displayMetrics.density).toInt()
}
