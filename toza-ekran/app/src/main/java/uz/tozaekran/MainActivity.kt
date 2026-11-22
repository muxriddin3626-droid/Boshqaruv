package uz.tozaekran

import android.app.Activity
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var prefs: Prefs
    private var pinPassed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        pinPassed = savedInstanceState?.getBoolean("pin_ok") ?: false
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("pin_ok", pinPassed)
    }

    override fun onResume() {
        super.onResume()
        val recent = System.currentTimeMillis() - lastPinOk < 5 * 60 * 1000L
        if (prefs.hasPin && !pinPassed && !recent) askPinToEnter() else render()
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) pinPassed = false
    }

    // ---------------- PIN ----------------

    private fun askPinToEnter() {
        setContentView(View(this))
        val input = pinField()
        AlertDialog.Builder(this)
            .setTitle("Ota-ona PIN-kodi")
            .setView(wrap(input))
            .setCancelable(false)
            .setPositiveButton("Kirish") { _, _ ->
                if (prefs.checkPin(input.text.toString())) {
                    pinPassed = true
                    lastPinOk = System.currentTimeMillis()
                    // Sozlamalardagi himoyani ham 10 daqiqaga ochamiz (xizmatni sozlash uchun)
                    prefs.unlockedUntil = System.currentTimeMillis() + 10 * 60 * 1000L
                    render()
                } else {
                    toast("PIN noto'g'ri")
                    finish()
                }
            }
            .setNegativeButton("Chiqish") { _, _ -> finish() }
            .show()
    }

    private fun setPinDialog() {
        val input = pinField()
        AlertDialog.Builder(this)
            .setTitle(if (prefs.hasPin) "Yangi PIN-kod" else "PIN-kod o'rnatish")
            .setMessage("Kamida 4 ta raqam. Bu PIN bolangizga aytilmasin.")
            .setView(wrap(input))
            .setPositiveButton("Saqlash") { _, _ ->
                val pin = input.text.toString()
                if (pin.length < 4) toast("Kamida 4 ta raqam kiriting")
                else { prefs.setPin(pin); pinPassed = true; lastPinOk = System.currentTimeMillis(); toast("PIN saqlandi"); render() }
            }
            .setNegativeButton("Bekor", null)
            .apply {
                if (prefs.hasPin) setNeutralButton("PIN'ni o'chirish") { _, _ ->
                    prefs.setPin(null); toast("PIN o'chirildi"); render()
                }
            }
            .show()
    }

    // ---------------- Asosiy ekran ----------------

    private fun render() {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(32))
            setBackgroundColor(0xFFF3F6F5.toInt())
        }

        // Holat
        val enabled = isServiceEnabled()
        col.addView(card {
            addView(title(if (enabled) "🛡️ Himoya yoqilgan" else "⚠️ Himoya o'chiq",
                if (enabled) 0xFF0E7C66.toInt() else 0xFFC0392B.toInt(), 22f))
            addView(body(
                if (enabled) "Ekrandagi 18+ matn va rasmlar bloklanadi: brauzer, Telegram, Instagram, YouTube va boshqa ilovalarda."
                else "Ishlashi uchun \"Maxsus imkoniyatlar\" bo'limida Toza Ekran xizmatini yoqing."
            ))
            addView(body("Bloklangan: ${prefs.blockedCount} marta"))
            if (!enabled) {
                addView(primary("Himoyani yoqish") {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                })
                if (Build.VERSION.SDK_INT >= 33) {
                    addView(body("Agar \"Cheklangan sozlama\" deb chiqsa: Ilova haqida → ⋮ (yuqori o'ng burchak) → \"Cheklangan sozlamalarga ruxsat berish\" ni bosing, so'ng qayta urining."))
                    addView(secondary("Ilova haqida sahifasini ochish") {
                        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                    })
                }
            }
        })

        // Tekshiruv turlari
        col.addView(card {
            addView(title("Nimani tekshirish", Color.BLACK))
            addView(switch("Matn va sayt manzillari", prefs.textScan) { prefs.textScan = it })
            val canImg = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            addView(switch("Rasm va videolar (AI)", prefs.imageScan && canImg, canImg) { prefs.imageScan = it })
            addView(body(
                if (canImg) "AI telefonning o'zida ishlaydi — ekran rasmlari hech qayerga yuborilmaydi."
                else "Rasmni AI bilan tekshirish Android 11 va undan yangi versiyalarda ishlaydi."
            ))
        })

        // Sezgirlik
        col.addView(card {
            addView(title("Sezgirlik", Color.BLACK))
            val group = RadioGroup(this@MainActivity)
            val labels = listOf(
                "Past — faqat 18+ saytlar va aniq porno",
                "O'rta — tavsiya etiladi",
                "Yuqori — bolalar uchun (ba'zan ortiqcha bloklaydi)",
            )
            labels.forEachIndexed { i, s ->
                group.addView(RadioButton(this@MainActivity).apply {
                    id = 1000 + i; text = s; textSize = 15f
                })
            }
            group.check(1000 + prefs.sensitivity)
            group.setOnCheckedChangeListener { _, id -> prefs.sensitivity = id - 1000 }
            addView(group)
        })

        // Qo'shimcha so'zlar
        col.addView(card {
            addView(title("Qo'shimcha bloklanadigan so'zlar", Color.BLACK))
            addView(body("Vergul bilan ajrating. Masalan: kanal nomi, sayt nomi."))
            val edit = EditText(this@MainActivity).apply {
                setText(prefs.customWords)
                hint = "masalan: qizlar_18, example.com"
                minLines = 2
            }
            addView(edit)
            addView(secondary("Saqlash") {
                prefs.customWords = edit.text.toString()
                toast("Saqlandi")
            })
        })

        // Ota-ona nazorati
        col.addView(card {
            addView(title("Ota-ona nazorati", Color.BLACK))
            addView(body(if (prefs.hasPin) "PIN-kod o'rnatilgan. Ilovaga kirish uchun PIN so'raladi." else "PIN-kod o'rnating — shunda bola himoyani o'chira olmaydi."))
            addView(secondary(if (prefs.hasPin) "PIN-kodni o'zgartirish" else "PIN-kod o'rnatish") { setPinDialog() })
            addView(switch("O'chirib yuborishdan himoya", prefs.protect && prefs.hasPin, prefs.hasPin) {
                prefs.protect = it
            })
            addView(body("Yoqilsa, Sozlamalarda Toza Ekran sahifasi ochilganda PIN so'raladi (xizmatni o'chirish yoki ilovani o'chirish uchun)."))
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this@MainActivity, AdminReceiver::class.java)
            if (!dpm.isAdminActive(admin)) {
                addView(secondary("Qurilma administratorini yoqish") {
                    startActivity(Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
                        .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, getString(R.string.admin_desc)))
                })
            } else {
                addView(body("✅ Qurilma administratori yoqilgan — ilovani oddiy usulda o'chirib bo'lmaydi."))
            }
        })

        // Xavfsiz DNS
        col.addView(card {
            addView(title("Qo'shimcha: xavfsiz DNS", Color.BLACK))
            addView(body("18+ saytlarni internet darajasida ham yopish uchun: Sozlamalar → Tarmoq va internet → Shaxsiy DNS → \"Shaxsiy DNS provayderi\" ga quyidagini yozing:"))
            addView(TextView(this@MainActivity).apply {
                text = DNS_HOST; textSize = 17f; setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
                setTextIsSelectable(true); setPadding(0, dp(8), 0, dp(8))
            })
            addView(secondary("Nusxalash va Sozlamalarni ochish") {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("DNS", DNS_HOST))
                toast("Nusxalandi")
                runCatching { startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS)) }
            })
        })

        setContentView(ScrollView(this).apply { addView(col) })
    }

    private fun isServiceEnabled(): Boolean {
        if (GuardService.running) return true
        val list = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val me = ComponentName(this, GuardService::class.java)
        return list.split(':').any { ComponentName.unflattenFromString(it) == me }
    }

    // ---------------- UI yordamchilar ----------------

    private fun card(block: LinearLayout.() -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(16).toFloat() }
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) }
        block()
    }

    private fun title(s: String, color: Int, size: Float = 18f) = TextView(this).apply {
        text = s; textSize = size; setTextColor(color); setTypeface(typeface, Typeface.BOLD)
        setPadding(0, 0, 0, dp(6))
    }

    private fun body(s: String) = TextView(this).apply {
        text = s; textSize = 14f; setTextColor(0xFF4A5553.toInt()); setPadding(0, dp(4), 0, dp(4))
    }

    private fun primary(s: String, onClick: () -> Unit) = Button(this).apply {
        text = s; isAllCaps = false; textSize = 16f; setTextColor(Color.WHITE)
        background = GradientDrawable().apply { setColor(0xFF0E7C66.toInt()); cornerRadius = dp(12).toFloat() }
        layoutParams = LinearLayout.LayoutParams(-1, dp(50)).apply { topMargin = dp(10) }
        setOnClickListener { onClick() }
    }

    private fun secondary(s: String, onClick: () -> Unit) = Button(this).apply {
        text = s; isAllCaps = false; textSize = 15f; setTextColor(0xFF0E7C66.toInt())
        background = GradientDrawable().apply {
            setColor(0xFFE4F2EE.toInt()); cornerRadius = dp(12).toFloat()
        }
        layoutParams = LinearLayout.LayoutParams(-1, dp(46)).apply { topMargin = dp(8) }
        setOnClickListener { onClick() }
    }

    private fun switch(s: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) =
        Switch(this).apply {
            text = s; textSize = 15f; isChecked = checked; isEnabled = enabled
            setPadding(0, dp(8), 0, dp(8))
            setOnCheckedChangeListener { _, v -> onChange(v) }
        }

    private fun pinField() = EditText(this).apply {
        inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        gravity = Gravity.CENTER
        textSize = 22f
        hint = "••••"
    }

    private fun wrap(v: View) = LinearLayout(this).apply {
        setPadding(dp(24), dp(8), dp(24), 0)
        addView(v, LinearLayout.LayoutParams(-1, -2))
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val DNS_HOST = "family.cloudflare-dns.com"
        private var lastPinOk = 0L
    }
}
