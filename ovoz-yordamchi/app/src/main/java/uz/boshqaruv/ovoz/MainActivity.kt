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
    private lateinit var bubbleSwitch: Switch

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
        bubbleSwitch = findViewById(R.id.switch_bubble)

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

        bubbleSwitch.isChecked = Prefs.bubble(this)
        bubbleSwitch.setOnCheckedChangeListener { _, on ->
            Prefs.setBubble(this, on)
            if (on && !Settings.canDrawOverlays(this)) askOverlayPermission() else syncService()
        }

        // Sun'iy intellekt: Gemini (bepul kalit aistudio.google.com) yoki Claude (console.anthropic.com)
        val aiSwitch = findViewById<Switch>(R.id.switch_ai)
        val apiKey = findViewById<EditText>(R.id.api_key)
        val providerGroup = findViewById<RadioGroup>(R.id.ai_provider)
        fun showKeyFor(provider: String) {
            apiKey.setText(Prefs.keyFor(this, provider))
            apiKey.hint = if (provider == Prefs.GEMINI) "Gemini API kalit (AIza…)" else "Claude API kalit (sk-ant-…)"
        }
        showKeyFor(Prefs.aiProvider(this))
        providerGroup.check(if (Prefs.aiProvider(this) == Prefs.CLAUDE) R.id.ai_claude else R.id.ai_gemini)
        providerGroup.setOnCheckedChangeListener { _, id ->
            // Oldingi AI kalitini saqlab, tanlangan AI kalitini ko'rsatamiz
            saveApiKey()
            val provider = if (id == R.id.ai_claude) Prefs.CLAUDE else Prefs.GEMINI
            Prefs.setAiProvider(this, provider)
            showKeyFor(provider)
        }
        findViewById<Button>(R.id.btn_get_key).setOnClickListener {
            val url = if (Prefs.aiProvider(this) == Prefs.CLAUDE) "https://console.anthropic.com/settings/keys"
            else "https://aistudio.google.com/apikey"
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (e: Exception) {
            }
        }
        aiSwitch.isChecked = Prefs.aiEnabled(this)
        aiSwitch.setOnCheckedChangeListener { _, on ->
            saveApiKey()
            if (on && Prefs.keyFor(this, Prefs.aiProvider(this)).isBlank()) {
                Toast.makeText(this, "Avval API kalitni kiriting", Toast.LENGTH_LONG).show()
                aiSwitch.isChecked = false
                return@setOnCheckedChangeListener
            }
            Prefs.setAiEnabled(this, on)
            append(if (on) "ℹ Sun'iy intellekt yoqildi" else "ℹ Sun'iy intellekt o'chirildi")
        }
        apiKey.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) saveApiKey()
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
        bubbleSwitch.isChecked = Prefs.bubble(this)
        // "Ustida ko'rsatish" ruxsati berilib qaytilganda tugmani chiqaramiz
        if (Prefs.bubble(this) && Settings.canDrawOverlays(this)) syncService()
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
        val want = Prefs.callControl(this) || Prefs.continuous(this) || Prefs.bubble(this)
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

    private fun saveApiKey() {
        Prefs.setKeyFor(this, Prefs.aiProvider(this), findViewById<EditText>(R.id.api_key).text.toString())
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
    override fun onInfo(text: String) = append("⚠ $text")
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
        saveApiKey()
        assistant.stopListening()
        super.onPause()
    }

    override fun onDestroy() {
        assistant.release()
        super.onDestroy()
    }
}
