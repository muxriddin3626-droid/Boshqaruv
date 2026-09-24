package uz.boshqaruv.ovoz

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * Hamma ilovalar ustida turadigan, surib qo'yish mumkin bo'lgan mikrofon tugmasi.
 * Bosilsa — tinglaydi; javob matni tugma yonida bir necha soniya ko'rinadi.
 */
class FloatingBubble(private val context: Context, private val onTap: () -> Unit) {

    private val wm = context.getSystemService(WindowManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var root: LinearLayout? = null
    private var mic: ImageView? = null
    private var label: TextView? = null
    private var params: WindowManager.LayoutParams? = null
    private val hideLabel = Runnable { label?.visibility = View.GONE }

    val isShown: Boolean get() = root != null

    private fun dp(v: Int) = (v * context.resources.displayMetrics.density).toInt()

    @SuppressLint("ClickableViewAccessibility")
    fun show() {
        if (root != null || !Settings.canDrawOverlays(context)) return

        val text = TextView(context).apply {
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 14f
            maxWidth = dp(240)
            setPadding(dp(10), dp(6), dp(10), dp(6))
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(0xE0202830.toInt())
            }
            visibility = View.GONE
        }
        val button = ImageView(context).apply {
            setImageResource(R.drawable.ic_mic)
            setBackgroundResource(R.drawable.mic_bg)
            setPadding(dp(14), dp(14), dp(14), dp(14))
            elevation = dp(6).toFloat()
            contentDescription = "Gapirish"
        }
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            addView(text, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(4)
            })
            addView(button, LinearLayout.LayoutParams(dp(60), dp(60)))
        }

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = Prefs.bubbleX(context)
            y = Prefs.bubbleY(context).takeIf { it >= 0 } ?: dp(300)
        }

        // Surish: barmoq 10px dan ko'p siljisa — tugma ko'chadi, aks holda bu bosish
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        var moved = false
        button.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = e.rawX; downY = e.rawY
                    startX = lp.x; startY = lp.y
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (abs(dx) > dp(10) || abs(dy) > dp(10)) moved = true
                    if (moved) {
                        lp.x = startX + dx.toInt()
                        lp.y = startY + dy.toInt()
                        root?.let { wm.updateViewLayout(it, lp) }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (moved) Prefs.setBubblePosition(context, lp.x, lp.y) else onTap()
                    true
                }
                else -> false
            }
        }

        try {
            wm.addView(layout, lp)
            root = layout
            mic = button
            label = text
            params = lp
        } catch (e: Exception) {
            root = null
        }
    }

    fun setListening(active: Boolean) {
        mic?.isActivated = active
    }

    fun showText(text: String) {
        val l = label ?: return
        l.text = text
        l.visibility = View.VISIBLE
        main.removeCallbacks(hideLabel)
        main.postDelayed(hideLabel, 7000)
    }

    fun hide() {
        main.removeCallbacks(hideLabel)
        root?.let {
            try {
                wm.removeView(it)
            } catch (e: Exception) {
            }
        }
        root = null
        mic = null
        label = null
    }
}
