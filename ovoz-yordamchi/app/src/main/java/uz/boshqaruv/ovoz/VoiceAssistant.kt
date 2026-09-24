package uz.boshqaruv.ovoz

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Ovozli yordamchining "miyasi": eshitadi → tushunadi → bajaradi → ovoz bilan javob beradi.
 * Faqat asosiy (main) oqimda ishlatilishi kerak.
 */
class VoiceAssistant(private val context: Context, private val listener: Listener) {

    interface Listener {
        fun onStatus(text: String) {}
        fun onHeard(text: String) {}
        /** Ovoz taniydigan xizmatning boshqa taxminlari (nima eshitganini ko'rsatish uchun). */
        fun onAlternatives(texts: List<String>) {}
        fun onReply(text: String) {}
        fun onListening(active: Boolean) {}
        /** Suhbat tugadi — yordamchi hech narsa kutmayapti. */
        fun onIdle() {}
    }

    /** Yordamchi foydalanuvchidan nimanidir kutayotgan holat. */
    private sealed class Pending {
        data class SmsText(val contact: Contact) : Pending()
        data class SmsConfirm(val contact: Contact, val text: String) : Pending()
        data class Incoming(val who: String, var attempts: Int = 0) : Pending()
        object AwaitCommand : Pending()
    }

    private val main = Handler(Looper.getMainLooper())
    private val actions = PhoneActions(context)
    private val contacts = ContactFinder(context)
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val afterSpeech = HashMap<String, () -> Unit>()
    private var pending: Pending? = null
    private var listening = false

    /** true bo'lsa, faqat "Yordamchi ..." bilan boshlangan gaplarga javob beradi (doimiy tinglash). */
    var requireWakeWord = false

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val t = tts ?: return@TextToSpeech
                // O'zbek ovozi bo'lmasa — turk ovozi o'zbek lotin yozuvini yaxshi o'qiydi
                val locales = listOf(Locale("uz", "UZ"), Locale("tr", "TR"), Locale.getDefault())
                for (l in locales) {
                    if (t.setLanguage(l) >= TextToSpeech.LANG_AVAILABLE) break
                }
                t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) = finish(id)
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String?) = finish(id)
                    private fun finish(id: String?) {
                        val next = synchronized(afterSpeech) { afterSpeech.remove(id) } ?: return
                        main.post(next)
                    }
                })
                ttsReady = true
            }
        }
    }

    val isBusy: Boolean get() = listening || pending != null

    // ---------------- Tinglash ----------------

    fun listen() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            say("Bu telefonda ovozni tanish xizmati yo'q. Google ilovasini o'rnating.")
            return
        }
        val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(context).also {
            it.setRecognitionListener(recognitionListener)
            recognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            val lang = Prefs.language(context)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 10)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            // Gap orasidagi qisqa to'xtashda kesib qo'ymasligi uchun
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
        try {
            r.cancel()
            r.startListening(intent)
            setListening(true)
            listener.onStatus("Eshityapman…")
        } catch (e: Exception) {
            setListening(false)
            listener.onStatus("Mikrofon ishlamadi: ${e.message}")
        }
    }

    fun stopListening() {
        recognizer?.cancel()
        setListening(false)
    }

    private fun setListening(v: Boolean) {
        listening = v
        listener.onListening(v)
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onPartialResults(partialResults: Bundle?) {
            partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                ?.takeIf { it.isNotBlank() }?.let { listener.onStatus("… $it") }
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onError(error: Int) {
            setListening(false)
            val p = pending
            when {
                p is Pending.Incoming && p.attempts < 4 -> {
                    p.attempts++
                    main.postDelayed({ if (pending === p) listen() }, 300)
                }
                error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                    pending = null
                    if (p != null && p !is Pending.Incoming) {
                        say("Eshitmadim. Qaytadan urinib ko'ring.")
                    } else {
                        listener.onStatus("Hech narsa eshitilmadi")
                        listener.onIdle()
                    }
                }
                error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                    pending = null
                    say("Mikrofonga ruxsat bering.")
                }
                else -> {
                    listener.onStatus("Xato ($error)")
                    if (p !is Pending.Incoming) pending = null
                    listener.onIdle()
                }
            }
        }

        override fun onResults(results: Bundle?) {
            setListening(false)
            val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
            if (list.isEmpty()) {
                onError(SpeechRecognizer.ERROR_NO_MATCH)
                return
            }
            handle(list)
        }
    }

    // ---------------- Tushunish va bajarish ----------------

    /** Tanib olingan variantlar ichidan birinchi tushunarlisini bajaradi. */
    fun handle(alternatives: List<String>) {
        var texts = alternatives
        if (requireWakeWord && pending == null) {
            val woken = alternatives.mapNotNull { stripWakeWord(it) }
            if (woken.isEmpty()) {
                listener.onIdle()
                return
            }
            texts = woken
            if (texts.all { it.isBlank() }) {
                pending = Pending.AwaitCommand
                say("Eshitaman") { listen() }
                return
            }
        }
        if (pending == Pending.AwaitCommand) pending = null

        val first = texts.first()
        listener.onHeard(first)
        if (texts.size > 1) listener.onAlternatives(texts.drop(1).distinct().take(4))

        when (val p = pending) {
            is Pending.SmsText -> {
                pending = Pending.SmsConfirm(p.contact, first)
                say("${p.contact.name}ga: \"$first\". Yuboraymi?") { listen() }
                return
            }
            is Pending.SmsConfirm -> {
                when (CommandParser.parse(first, expectingAnswer = true)) {
                    Command.Yes -> {
                        pending = null
                        if (actions.sendSms(p.contact.number, p.text)) say("Yuborildi.")
                        else say("SMS yuborib bo'lmadi. Ruxsatni tekshiring.")
                    }
                    Command.No -> {
                        pending = null
                        say("Bekor qilindi.")
                    }
                    else -> say("Ha yoki yo'q deng.") { listen() }
                }
                return
            }
            is Pending.Incoming -> {
                val cmd = texts.map { CommandParser.parse(it, expectingAnswer = true) }
                    .firstOrNull { it is Command.Yes || it is Command.No || it is Command.Answer || it is Command.HangUp }
                when (cmd) {
                    Command.Yes, Command.Answer -> {
                        pending = null
                        if (!actions.answer()) say("Ko'tarib bo'lmadi. Ruxsatni tekshiring.")
                        listener.onIdle()
                    }
                    Command.No, Command.HangUp -> {
                        pending = null
                        if (!actions.hangUp()) say("Rad etib bo'lmadi.") else listener.onIdle()
                    }
                    else -> if (p.attempts++ < 4) listen() else { pending = null; listener.onIdle() }
                }
                return
            }
            else -> {}
        }

        val cmd = texts.map { CommandParser.parse(it) }.firstOrNull { it !is Command.Unknown }
            ?: Command.Unknown(first)
        execute(cmd)
    }

    private fun execute(cmd: Command) {
        when (cmd) {
            is Command.Call -> {
                val c = contacts.find(cmd.target)
                if (c == null) say("${cmd.target.replaceFirstChar { it.uppercase() }} kontaktlarda topilmadi.")
                else {
                    say("${c.name}ga qo'ng'iroq qilyapman.") {
                        if (actions.call(c.number)) listener.onIdle()
                        else say("Qo'ng'iroq qilib bo'lmadi. Ruxsatni tekshiring.")
                    }
                }
            }
            is Command.Sms -> {
                val c = contacts.find(cmd.target)
                when {
                    c == null -> say("${cmd.target.replaceFirstChar { it.uppercase() }} kontaktlarda topilmadi.")
                    cmd.text == null -> {
                        pending = Pending.SmsText(c)
                        say("${c.name}ga nima deb yozay?") { listen() }
                    }
                    else -> {
                        pending = Pending.SmsConfirm(c, cmd.text)
                        say("${c.name}ga: \"${cmd.text}\". Yuboraymi?") { listen() }
                    }
                }
            }
            Command.Answer -> if (actions.answer()) listener.onIdle() else say("Hozir kiruvchi qo'ng'iroq yo'q.")
            Command.HangUp -> if (actions.hangUp()) listener.onIdle() else say("Tugatadigan qo'ng'iroq yo'q.")
            Command.Time -> say("Soat " + SimpleDateFormat("HH:mm", Locale.US).format(Date()))
            Command.Date -> say("Bugun " + SimpleDateFormat("dd.MM.yyyy", Locale.US).format(Date()))
            Command.FlashOn -> say(if (actions.torch(true)) "Fonar yoqildi." else "Fonarni yoqib bo'lmadi.")
            Command.FlashOff -> say(if (actions.torch(false)) "Fonar o'chirildi." else "Fonarni o'chirib bo'lmadi.")
            is Command.OpenApp -> {
                val name = actions.openApp(cmd.name)
                say(if (name != null) "$name ochilyapti." else "${cmd.name} ilovasi topilmadi.")
            }
            is Command.Music -> {
                if (cmd.query != null) {
                    say("${cmd.query.replaceFirstChar { it.uppercase() }} qo'yilyapti.") {
                        if (!actions.playFromSearch(cmd.query)) say("Musiqa ilovasi topilmadi.") else listener.onIdle()
                    }
                } else {
                    say("Musiqa qo'yilyapti.") {
                        actions.musicResume()
                        // Hech narsa chalinmasa — musiqa ilovasini ochamiz
                        main.postDelayed({
                            if (!actions.isMusicPlaying) actions.openMusicApp()
                            listener.onIdle()
                        }, 1500)
                    }
                }
            }
            Command.MusicPause -> { actions.musicPause(); listener.onIdle() }
            Command.MusicNext -> { actions.musicNext(); listener.onIdle() }
            Command.MusicPrev -> { actions.musicPrev(); listener.onIdle() }
            Command.VolumeUp -> { actions.volume(AudioManager.ADJUST_RAISE); listener.onIdle() }
            Command.VolumeDown -> { actions.volume(AudioManager.ADJUST_LOWER); listener.onIdle() }
            Command.VolumeMute -> { actions.volume(AudioManager.ADJUST_MUTE); listener.onIdle() }
            is Command.Alarm -> {
                val ok = actions.alarm(cmd.hour, cmd.minute)
                say(
                    when {
                        !ok -> "Budilnik ilovasi topilmadi."
                        cmd.hour == null -> "Budilnik ochildi."
                        else -> "Budilnik soat ${cmd.hour}:${"%02d".format(cmd.minute)} ga qo'yildi."
                    }
                )
            }
            is Command.Timer -> {
                val ok = actions.timer(cmd.seconds)
                val m = cmd.seconds / 60
                val sec = cmd.seconds % 60
                val len = listOfNotNull(if (m > 0) "$m daqiqa" else null, if (sec > 0) "$sec soniya" else null).joinToString(" ")
                say(if (ok) "Taymer $len ga qo'yildi." else "Taymer qo'yib bo'lmadi.")
            }
            is Command.Search -> say("${cmd.query} qidirilyapti.") { actions.search(cmd.query); listener.onIdle() }
            is Command.YouTube -> say("YouTube ochilyapti.") { actions.youtube(cmd.query); listener.onIdle() }
            is Command.Navigate -> say(if (cmd.place.isBlank()) "Xarita ochilyapti." else "${cmd.place.replaceFirstChar { it.uppercase() }}ga yo'l ko'rsatyapman.") {
                actions.navigate(cmd.place); listener.onIdle()
            }
            Command.Camera -> if (actions.camera()) listener.onIdle() else say("Kamera ochilmadi.")
            Command.Battery -> say("Batareya ${actions.batteryPercent()} foiz.")
            Command.Wifi -> say("Wi-Fi sozlamasi ochildi.") { actions.wifiSettings(); listener.onIdle() }
            Command.Bluetooth -> say("Bluetooth sozlamasi ochildi.") { actions.bluetoothSettings(); listener.onIdle() }
            Command.Stop -> {
                pending = null
                tts?.stop()
                listener.onIdle()
            }
            Command.Yes, Command.No -> listener.onIdle()
            is Command.Unknown -> say("Tushunmadim: ${cmd.text}. Qaytadan, sekinroq ayting.")
        }
    }

    // ---------------- Kiruvchi qo'ng'iroq ----------------

    /** Telefon jiringlaganda chaqiriladi: kim qo'ng'iroq qilayotganini aytadi va javob kutadi. */
    fun onIncomingCall(number: String?) {
        val who = contacts.nameFor(number) ?: number?.takeIf { it.isNotBlank() } ?: "Noma'lum raqam"
        val p = Pending.Incoming(who)
        pending = p
        say("$who qo'ng'iroq qilyapti. Ko'taraymi?") { if (pending === p) listen() }
    }

    /** Qo'ng'iroq ko'tarildi yoki tugadi — kutishni to'xtatish. */
    fun onCallStateIdleOrOffhook() {
        if (pending is Pending.Incoming) {
            pending = null
            stopListening()
            tts?.stop()
            listener.onIdle()
        }
    }

    // ---------------- Gapirish ----------------

    fun say(text: String, then: (() -> Unit)? = null) {
        listener.onReply(text)
        val t = tts
        if (t == null || !ttsReady) {
            main.postDelayed({ (then ?: { if (pending == null) listener.onIdle() }).invoke() }, 600)
            return
        }
        val id = UUID.randomUUID().toString()
        synchronized(afterSpeech) {
            afterSpeech[id] = then ?: { if (pending == null && !listening) listener.onIdle() }
        }
        t.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    fun release() {
        recognizer?.destroy()
        recognizer = null
        tts?.shutdown()
        tts = null
    }

    companion object {
        private val WAKE = listOf("yordamchi", "yordamchim", "assistent", "asistent", "yordamchiy")

        /** "Yordamchi, Aliga qo'ng'iroq qil" → "Aliga qo'ng'iroq qil"; chaqiruv so'zi bo'lmasa null. */
        fun stripWakeWord(text: String): String? {
            val words = text.trim().split(Regex("\\s+"))
            val idx = words.indexOfFirst { CommandParser.normalize(it) in WAKE }
            if (idx < 0 || idx > 2) return null
            return words.drop(idx + 1).joinToString(" ").trim()
        }
    }
}
