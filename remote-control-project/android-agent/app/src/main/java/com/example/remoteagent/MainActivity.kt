package com.example.remoteagent

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/**
 * Asosiy ekran (Agent tomon - kuzatiluvchi telefon).
 *
 * Oqim:
 *  1) Foydalanuvchi backend'da hisob yaratadi/kiradi (bu yerda soddalashtirilgan)
 *  2) "Pairing kod yarat" tugmasini bosadi -> backend'dan 6 xonali kod oladi
 *  3) Bu kodni ikkinchi qurilmadagi Controller ilovaga aytadi
 *  4) Controller kodni kiritganda, bu ekranda TASDIQLASH oynasi chiqadi -
 *     foydalanuvchi aniq "Ruxsat berish" tugmasini bosmasa, hech narsa
 *     uzatilmaydi
 *  5) Tasdiqlangandan so'ng MediaProjection ruxsati so'raladi (tizim oynasi)
 *     va ScreenCaptureService ishga tushadi
 */
class MainActivity : AppCompatActivity() {

    private lateinit var signalingClient: SignalingClient
    private var pendingSessionId: String? = null
    private lateinit var statusText: TextView
    private lateinit var statusDot: View
    private lateinit var statusLabel: TextView

    companion object {
        const val REQ_MEDIA_PROJECTION = 1001
        const val REQ_ACCESSIBILITY = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        statusDot = findViewById(R.id.statusDot)
        statusLabel = findViewById(R.id.statusLabel)
        val generateCodeBtn = findViewById<Button>(R.id.generateCodeBtn)
        val enableAccessibilityBtn = findViewById<Button>(R.id.enableAccessibilityBtn)

        // Accessibility Service tizim sozlamalaridan qo'lda yoqilishi shart
        enableAccessibilityBtn.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        generateCodeBtn.setOnClickListener {
            if (!isAccessibilityServiceEnabled()) {
                Toast.makeText(this, "Avval Erishimlilik xizmatini yoqing", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            requestPairingCode()
        }

        signalingClient = SignalingClient(
            onPairingRequest = { sessionId, controllerName ->
                runOnUiThread { showApprovalDialog(sessionId, controllerName) }
            },
            onMessage = { /* offer/answer/ice - ScreenCaptureService ichida boshqariladi */ }
        )
    }

    private fun requestPairingCode() {
        // Backend: POST /pair/generate-code -> { code, expiresInSeconds }
        // (Retrofit/OkHttp orqali chaqiriladi - qisqartirish uchun bu yerda
        // ApiClient.generatePairingCode(...) deb faraz qilinmoqda)
        ApiClient.generatePairingCode { code, error ->
            runOnUiThread {
                if (error != null) {
                    Toast.makeText(this, "Xatolik: $error", Toast.LENGTH_LONG).show()
                } else if (code != null) {
                    statusText.text = "Pairing kod: $code\nBoshqa qurilmada shu kodni kiriting yoki havolani yuboring."
                    findViewById<Button>(R.id.sendLinkBtn).apply {
                        visibility = View.VISIBLE
                        setOnClickListener { shareLink(code) }
                    }
                }
            }
        }
    }

    /**
     * Pairing kodni havola shaklida (remoteagent://pair/123456) tizimning
     * standart "Ulashish" oynasi orqali yuboradi - foydalanuvchi o'zi
     * qaysi messenjer/SMS orqali yuborishni tanlaydi. Havola faqat
     * ulanish so'rovini boshlaydi; ulanish baribir shu ekrandagi
     * TASDIQLASH oynasisiz amalga oshmaydi.
     */
    private fun shareLink(code: String) {
        val link = "remoteagent://pair/$code"
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "Ekranimni ko'rish uchun ulanish havolasi: $link\n(5 daqiqa amal qiladi)")
        }
        startActivity(Intent.createChooser(shareIntent, "Havolani yuborish"))
    }

    /** Controller tomondan pairing so'rovi kelganda foydalanuvchidan aniq ruxsat so'raladi. */
    private fun showApprovalDialog(sessionId: String, controllerName: String) {
        pendingSessionId = sessionId
        AlertDialog.Builder(this)
            .setTitle("Ulanish so'rovi")
            .setMessage("\"$controllerName\" qurilmasi ekraningizni ko'rish va boshqarishni so'ramoqda. Ruxsat berasizmi?")
            .setPositiveButton("Ruxsat berish") { _, _ ->
                signalingClient.sendPairingResponse(sessionId, approved = true)
                setLiveStatus(controllerName)
                startScreenCapturePermissionFlow(sessionId)
            }
            .setNegativeButton("Rad etish") { _, _ ->
                signalingClient.sendPairingResponse(sessionId, approved = false)
            }
            .setCancelable(false)
            .show()
    }

    /** Foydalanuvchi ruxsat bergandan keyin tizimning MediaProjection oynasi chiqadi. */
    private fun startScreenCapturePermissionFlow(sessionId: String) {
        val mgr = getSystemService(MediaProjectionManager::class.java)
        startActivityForResult(mgr.createScreenCaptureIntent(), REQ_MEDIA_PROJECTION)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_MEDIA_PROJECTION && resultCode == Activity.RESULT_OK && data != null) {
            val sessionId = pendingSessionId ?: return
            val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
                putExtra("resultCode", resultCode)
                putExtra("data", data)
                putExtra("sessionId", sessionId)
            }
            startForegroundService(serviceIntent)
        } else {
            Toast.makeText(this, "Ekran ulashish rad etildi", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setLiveStatus(controllerName: String) {
        statusDot.setBackgroundResource(R.drawable.dot_live)
        statusLabel.text = "Hozir kuzatilmoqda: $controllerName"
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = "$packageName/${RemoteInputAccessibilityService::class.java.canonicalName}"
        val enabled = Settings.Secure.getString(
            contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }
}
