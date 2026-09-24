package uz.boshqaruv.ovoz

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.net.Uri
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.RadioGroup
import android.widget.ImageButton
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity(), VoiceAssistant.Listener {

    private lateinit var assistant: VoiceAssistant
    private lateinit var status: TextView
    private lateinit var log: TextView
    private lateinit var scroll: ScrollView
    private lateinit var mic: ImageButton
    private lateinit var callSwitch: Switch
    private lateinit var continuousSwitch: Switch

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.status)
        findViewById<TextView>(R.id.title).text = "Ovozli yordamchi v" + packageManager.getPackageInfo(packageName, 0).versionName
        log = findViewById(R.id.log)
        scroll = findViewById(R.id.scroll)
        mic = findViewById(R.id.mic)
        callSwitch = findViewById(R.id.switch_calls)
        continuousSwitch = findViewById(R.id.switch_continuous)

        assistant = VoiceAssistant(this, this)

        mic.setOnClickListener { startListening() }

        // Ovoz yaxshi tanilmasa — buyruqni yozib ham berish mumkin
        val input = findViewById<EditText>(R.id.input)
        val send = {
            val text = input.text.toString().trim()
            if (text.isNotEmpty()) {
                input.setText("")
                assistant.stopListening()
                assistant.handle(listOf(text))
            }
        }
        findViewById<Button>(R.id.btn_send).setOnClickListener { send() }
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) { send(); true } else false
        }

        val onlineVoice = findViewById<Switch>(R.id.switch_online_voice)
        onlineVoice.isChecked = Prefs.onlineVoice(this)
        onlineVoice.setOnCheckedChangeListener { _, on -> Prefs.setOnlineVoice(this, on) }
        findViewById<Button>(R.id.btn_test_voice).setOnClickListener {
            assistant.say("Assalomu alaykum! Men sizning ovozli yordamchingizman. Nima qilay?")
            append("ℹ Ovoz: ${assistant.speaker.describe()}")
        }

        val lang = findViewById<RadioGroup>(R.id.lang)
        lang.check(if (Prefs.language(this) == "ru-RU") R.id.lang_ru else R.id.lang_uz)
        lang.setOnCheckedChangeListener { _, id ->
            Prefs.setLanguage(this, if (id == R.id.lang_ru) "ru-RU" else "uz-UZ")
        }

        callSwitch.isChecked = Prefs.callControl(this)
        continuousSwitch.isChecked = Prefs.continuous(this)
        callSwitch.setOnCheckedChangeListener { _, on ->
            Prefs.setCallControl(this, on)
            syncService()
        }
        continuousSwitch.setOnCheckedChangeListener { _, on ->
            Prefs.setContinuous(this, on)
            syncService()
            if (on) askOverlayPermission()
        }

        findViewById<Button>(R.id.btn_permissions).setOnClickListener { askPermissions() }
        findViewById<Button>(R.id.btn_default).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))
            } catch (e: Exception) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }

        askPermissions()
        if (isVoiceLaunch(intent)) startListening()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (isVoiceLaunch(intent)) startListening()
    }

    override fun onResume() {
        super.onResume()
        callSwitch.isChecked = Prefs.callControl(this)
        continuousSwitch.isChecked = Prefs.continuous(this)
    }

    /** "Uy" tugmasini bosib turish (ASSIST) yoki ovozli buyruq tugmasi orqali ochilganmi. */
    private fun isVoiceLaunch(i: Intent?) =
        i?.action == Intent.ACTION_ASSIST || i?.action == Intent.ACTION_VOICE_COMMAND

    private fun startListening() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            askPermissions()
            return
        }
        if (AssistantService.running && Prefs.continuous(this)) {
            // Mikrofon xizmatda band — tinglashni o'sha yerda boshlaymiz
            startService(Intent(this, AssistantService::class.java).setAction(AssistantService.ACTION_LISTEN))
            status.text = "Eshityapman (xizmat orqali)…"
            return
        }
        assistant.listen()
    }

    private fun syncService() {
        val want = Prefs.callControl(this) || Prefs.continuous(this)
        val svc = Intent(this, AssistantService::class.java)
        if (want) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Avval mikrofonga ruxsat bering", Toast.LENGTH_LONG).show()
                askPermissions()
                return
            }
            assistant.stopListening()
            startForegroundService(svc)
        } else {
            stopService(svc)
        }
    }

    /**
     * Fondan (ekran o'chiq holatda) ilova, musiqa, xarita ochish uchun Android
     * "Boshqa ilovalar ustidan ko'rsatish" ruxsatini talab qiladi.
     */
    private fun askOverlayPermission() {
        if (Settings.canDrawOverlays(this)) return
        Toast.makeText(this, "\"Boshqa ilovalar ustidan ko'rsatish\"ga ruxsat bering — fonda ilovalarni ochish uchun kerak", Toast.LENGTH_LONG).show()
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        } catch (e: Exception) {
        }
    }

    private fun askPermissions() {
        val perms = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.ANSWER_PHONE_CALLS,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.SEND_SMS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms += Manifest.permission.POST_NOTIFICATIONS
        val missing = perms.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val denied = permissions.filterIndexed { i, _ -> grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED }
        if (denied.isNotEmpty()) {
            append("⚠ Ba'zi ruxsatlar berilmadi — ular bilan bog'liq buyruqlar ishlamaydi.")
        }
    }

    // --- VoiceAssistant.Listener ---

    override fun onStatus(text: String) {
        status.text = text
    }

    override fun onHeard(text: String) = append("🗣 $text")
    override fun onReply(text: String) = append("🤖 $text")
    override fun onAlternatives(texts: List<String>) = append("   (yoki: ${texts.joinToString(" | ")})")

    override fun onListening(active: Boolean) {
        mic.isActivated = active
        mic.alpha = if (active) 1f else 0.85f
        if (!active && status.text == "Eshityapman…") status.text = "Mikrofonni bosing"
    }

    override fun onIdle() {
        status.text = "Mikrofonni bosing"
    }

    private fun append(line: String) {
        log.append(if (log.text.isEmpty()) line else "\n$line")
        scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
    }

    override fun onPause() {
        assistant.stopListening()
        super.onPause()
    }

    override fun onDestroy() {
        assistant.release()
        super.onDestroy()
    }
}
