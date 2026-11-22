package uz.tozaekran

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque
import java.util.concurrent.Executors

/**
 * Asosiy himoya xizmati (Maxsus imkoniyatlar / Accessibility).
 *  1) Ekrandagi matnni o'qiydi — sayt manzili, Telegram kanal nomi, qidiruv so'zi.
 *  2) Android 11+ da har ~1.5 soniyada ekran rasmini AI bilan tekshiradi.
 * 18+ topilsa — Bosh ekranga qaytaradi va qora oyna ko'rsatadi.
 */
class GuardService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var prefs: Prefs
    private lateinit var overlay: BlockOverlay

    @Volatile private var classifier: NsfwClassifier? = null
    @Volatile private var scanBusy = false
    private var currentPkg: String? = null
    private var lastTextCheck = 0L
    private var textCheckPending = false
    private var lastBlockAt = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        prefs = Prefs(this)
        overlay = BlockOverlay(this)
        running = true
        worker.execute {
            classifier = try { NsfwClassifier(this) } catch (_: Throwable) { null }
        }
        handler.postDelayed(scanLoop, SCAN_INTERVAL_MS)
    }

    // ---------------- Matn tekshiruvi ----------------

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !::prefs.isInitialized) return
        val pkg = event.packageName?.toString()
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && pkg != null) {
            currentPkg = pkg
        }
        if (pkg == packageName || overlay.isShowing) return

        // Matn yozilayotganda (qidiruv) — darhol tekshiramiz
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED && prefs.textScan) {
            val typed = event.text?.joinToString(" ") ?: ""
            TextFilter.find(typed, prefs.sensitivity, prefs.customWords)?.let {
                blockContent("Qidiruv: \"$it\"")
                return
            }
        }

        val now = SystemClock.uptimeMillis()
        if (now - lastTextCheck >= TEXT_THROTTLE_MS) {
            lastTextCheck = now
            checkScreenText()
        } else if (!textCheckPending) {
            textCheckPending = true
            handler.postDelayed({
                textCheckPending = false
                lastTextCheck = SystemClock.uptimeMillis()
                checkScreenText()
            }, TEXT_THROTTLE_MS)
        }
    }

    private fun checkScreenText() {
        if (overlay.isShowing) return
        val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return
        val pkg = root.packageName?.toString() ?: currentPkg
        if (pkg == packageName) return

        val text = collectText(root)

        // O'chirishdan himoya: Sozlamalarda ilova sahifasi ochilsa PIN so'raymiz
        if (prefs.protect && prefs.hasPin && !prefs.isUnlocked() && pkg != null && pkg in PROTECTED_PKGS &&
            text.contains(getString(R.string.app_name), ignoreCase = true)
        ) {
            showPinGuard()
            return
        }

        if (!prefs.textScan) return
        TextFilter.find(text, prefs.sensitivity, prefs.customWords)?.let {
            blockContent("Topilgan so'z: \"$it\"")
        }
    }

    private fun collectText(root: AccessibilityNodeInfo): String {
        val sb = StringBuilder()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var count = 0
        while (queue.isNotEmpty() && count < MAX_NODES) {
            val n = queue.poll() ?: break
            count++
            n.text?.let { sb.append(it).append('\n') }
            n.contentDescription?.let { sb.append(it).append('\n') }
            for (i in 0 until n.childCount) {
                val c = try { n.getChild(i) } catch (_: Exception) { null }
                if (c != null) queue.add(c)
            }
        }
        return sb.toString()
    }

    // ---------------- Rasm tekshiruvi (AI) ----------------

    private val scanLoop = object : Runnable {
        override fun run() {
            try { scanScreen() } finally { handler.postDelayed(this, SCAN_INTERVAL_MS) }
        }
    }

    private fun scanScreen() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        if (!prefs.imageScan || scanBusy || overlay.isShowing) return
        if (classifier == null) return
        if (currentPkg == packageName) return
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (!pm.isInteractive) return

        scanBusy = true
        try {
            takeScreenshot(Display.DEFAULT_DISPLAY, worker, object : TakeScreenshotCallback {
                override fun onSuccess(result: ScreenshotResult) {
                    var unsafe = false
                    try {
                        val hw = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                        result.hardwareBuffer.close()
                        val bmp = hw?.copy(Bitmap.Config.ARGB_8888, false)
                        hw?.recycle()
                        if (bmp != null) {
                            unsafe = classifier?.isUnsafe(bmp, prefs.sensitivity) == true
                            bmp.recycle()
                        }
                    } catch (_: Throwable) {
                    } finally {
                        scanBusy = false
                    }
                    if (unsafe) handler.post { blockContent("AI: 18+ rasm yoki video aniqlandi") }
                }

                override fun onFailure(errorCode: Int) {
                    scanBusy = false
                }
            })
        } catch (_: Throwable) {
            scanBusy = false
        }
    }

    // ---------------- Bloklash ----------------

    private fun blockContent(reason: String) {
        val now = SystemClock.uptimeMillis()
        if (now - lastBlockAt < 1500) return
        lastBlockAt = now
        prefs.incBlocked()
        performGlobalAction(GLOBAL_ACTION_BACK)
        handler.postDelayed({ performGlobalAction(GLOBAL_ACTION_HOME) }, 150)
        overlay.showContentBlock(reason)
    }

    private fun showPinGuard() {
        overlay.showPinBlock(
            onCorrectPin = { pin ->
                val ok = prefs.checkPin(pin)
                if (ok) prefs.unlockedUntil = System.currentTimeMillis() + UNLOCK_MS
                ok
            },
            onExit = { performGlobalAction(GLOBAL_ACTION_HOME) }
        )
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        running = false
        handler.removeCallbacksAndMessages(null)
        if (::overlay.isInitialized) overlay.hide()
        worker.execute { classifier?.close(); classifier = null }
        worker.shutdown()
        super.onDestroy()
    }

    companion object {
        @Volatile var running = false
            private set

        private const val SCAN_INTERVAL_MS = 1500L
        private const val TEXT_THROTTLE_MS = 500L
        private const val MAX_NODES = 800
        private const val UNLOCK_MS = 10 * 60 * 1000L

        /** Ilovani o'chirish mumkin bo'lgan tizim ilovalari. */
        private val PROTECTED_PKGS = setOf(
            "com.android.settings",
            "com.google.android.packageinstaller",
            "com.android.packageinstaller",
            "com.miui.securitycenter",
            "com.miui.packageinstaller",
            "com.samsung.android.packageinstaller",
            "com.coloros.safecenter",
            "com.oplus.safecenter",
            "com.huawei.systemmanager",
        )
    }
}
