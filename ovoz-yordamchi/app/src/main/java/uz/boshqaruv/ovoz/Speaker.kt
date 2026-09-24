package uz.boshqaruv.ovoz

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID

/**
 * O'zbekcha gapiradi. Tartib:
 *  1. telefonda o'zbekcha ovoz o'rnatilgan bo'lsa — o'sha;
 *  2. internet bo'lsa — onlayn o'zbekcha ovoz (Google);
 *  3. aks holda telefonning turk yoki rus ovozi, matn ular to'g'ri o'qiydigan yozuvga o'girilib.
 */
class Speaker(private val context: Context) {

    private enum class Local { UZBEK, TURKISH, RUSSIAN, OTHER }

    private val main = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null
    private var local = Local.OTHER
    private var ttsReady = false
    private val afterSpeech = HashMap<String, () -> Unit>()

    private var player: MediaPlayer? = null
    /** Hozirgi gapning navbati — [stop] chaqirilsa yangilanadi, eski callback'lar e'tiborsiz qoladi. */
    private var generation = 0
    /** Onlayn ovoz ishlamasa, bu sessiyada qayta urinmaslik uchun. */
    private var onlineFailed = false
    private var probed = false

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) setupLocal()
        }
    }

    private fun setupLocal() {
        val t = tts ?: return
        val uzVoice = try {
            t.voices?.firstOrNull { it.locale.language == "uz" && !it.isNetworkConnectionRequired }
                ?: t.voices?.firstOrNull { it.locale.language == "uz" }
        } catch (e: Exception) {
            null
        }
        local = when {
            uzVoice != null && t.setVoice(uzVoice) == TextToSpeech.SUCCESS -> Local.UZBEK
            t.setLanguage(Locale("uz", "UZ")) >= TextToSpeech.LANG_AVAILABLE -> Local.UZBEK
            t.setLanguage(Locale("tr", "TR")) >= TextToSpeech.LANG_AVAILABLE -> Local.TURKISH
            t.setLanguage(Locale("ru", "RU")) >= TextToSpeech.LANG_AVAILABLE -> Local.RUSSIAN
            else -> Local.OTHER
        }
        if (local != Local.UZBEK && !probed) {
            probed = true
            probeOtherEngines()
        }
        t.setSpeechRate(0.95f)
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

    /**
     * Asosiy ovoz dvigatelida o'zbekcha bo'lmasa — telefondagi boshqa dvigatellarni
     * (masalan, alohida o'rnatilgan o'zbekcha TTS ilovasini) tekshiradi va topilsa o'shanga o'tadi.
     */
    private fun probeOtherEngines() {
        val current = tts ?: return
        val others = try {
            current.engines.map { it.name }.filter { it != current.defaultEngine }
        } catch (e: Exception) {
            emptyList()
        }
        for (pkg in others) {
            lateinit var probe: TextToSpeech
            probe = TextToSpeech(context.applicationContext, { status ->
                val hasUzbek = status == TextToSpeech.SUCCESS && try {
                    probe.voices?.any { it.locale.language == "uz" } == true ||
                        probe.isLanguageAvailable(Locale("uz", "UZ")) >= TextToSpeech.LANG_AVAILABLE
                } catch (e: Exception) {
                    false
                }
                if (hasUzbek && local != Local.UZBEK) {
                    tts?.shutdown()
                    tts = probe
                    setupLocal()
                } else {
                    probe.shutdown()
                }
            }, pkg)
        }
    }

    /** Qaysi ovoz ishlatilayotgani (ekranda ko'rsatish uchun). */
    fun describe(): String = when {
        local == Local.UZBEK -> "telefondagi o'zbekcha ovoz"
        Prefs.onlineVoice(context) && !onlineFailed -> "onlayn o'zbekcha ovoz (internet bo'lganda)"
        local == Local.TURKISH -> "turkcha ovoz (o'zbekchaga moslangan)"
        local == Local.RUSSIAN -> "ruscha ovoz (o'zbekchaga moslangan)"
        else -> "telefon ovozi"
    }

    fun speak(text: String, onDone: () -> Unit) {
        stopPlayback()
        val gen = ++generation
        val done = { if (gen == generation) onDone() }
        when {
            local == Local.UZBEK && ttsReady -> speakLocal(text, done)
            Prefs.onlineVoice(context) && !onlineFailed && isOnline() ->
                speakOnline(Talaffuz.chunks(text), 0, gen, text, done)
            else -> speakLocal(text, done)
        }
    }

    private fun speakLocal(text: String, done: () -> Unit) {
        val t = tts
        if (t == null || !ttsReady) {
            main.postDelayed(done, 600)
            return
        }
        val spoken = when (local) {
            Local.TURKISH -> Talaffuz.forTurkish(text)
            Local.RUSSIAN -> Talaffuz.forRussian(text)
            else -> text
        }
        val id = UUID.randomUUID().toString()
        synchronized(afterSpeech) { afterSpeech[id] = done }
        t.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    private fun speakOnline(parts: List<String>, index: Int, gen: Int, fullText: String, done: () -> Unit) {
        if (gen != generation) return
        if (index >= parts.size) {
            done()
            return
        }
        val url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=uz&q=" +
            Uri.encode(parts[index])
        var finished = false
        val fallback = Runnable {
            if (finished || gen != generation) return@Runnable
            finished = true
            onlineFailed = index == 0
            stopPlayback()
            // Qolgan qismini telefon ovozi bilan aytamiz
            speakLocal(parts.drop(index).joinToString(" ").ifEmpty { fullText }, done)
        }
        try {
            val mp = MediaPlayer()
            player = mp
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            mp.setDataSource(context, Uri.parse(url), mapOf("User-Agent" to "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"))
            mp.setOnPreparedListener {
                main.removeCallbacks(fallback)
                if (gen == generation) it.start()
            }
            mp.setOnCompletionListener {
                if (finished) return@setOnCompletionListener
                finished = true
                it.release()
                if (player === it) player = null
                speakOnline(parts, index + 1, gen, fullText, done)
            }
            mp.setOnErrorListener { _, _, _ ->
                main.removeCallbacks(fallback)
                main.post(fallback)
                true
            }
            mp.prepareAsync()
            // Internet sekin bo'lsa uzoq kutib qolmaslik uchun
            main.postDelayed(fallback, 5000)
        } catch (e: Exception) {
            main.post(fallback)
        }
    }

    private fun isOnline(): Boolean = try {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    } catch (e: Exception) {
        false
    }

    private fun stopPlayback() {
        player?.let {
            try {
                it.stop()
            } catch (e: Exception) {
            }
            it.release()
        }
        player = null
    }

    fun stop() {
        generation++
        stopPlayback()
        tts?.stop()
    }

    fun release() {
        stop()
        tts?.shutdown()
        tts = null
    }
}
