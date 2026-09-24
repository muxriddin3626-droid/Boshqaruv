package uz.boshqaruv.ovoz

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Sun'iy intellekt (Google Gemini — bepul, yoki Claude): ovoz noto'g'ri tanilgan bo'lsa ham gapning ma'nosini tushunib,
 * bajariladigan buyruqqa aylantiradi yoki oddiy savolga o'zbekcha javob beradi.
 */
class AiBrain(private val context: Context) {

    /** [command] — bajariladigan buyruq; [reply] — AI'ning o'zbekcha javobi (suhbat uchun). */
    data class Result(val command: Command?, val reply: String?)

    /** Gemini xatosidan keyin nima qilish: shu modelni qayta, keyingi model yoki to'xtash. */
    enum class Retry { SAME, NEXT_MODEL, NO }

    private val main = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private var client: AnthropicClient? = null
    private var clientKey: String? = null
    /** Oxirgi bir necha savol-javob — AI oldingi gapni eslab qolishi uchun. */
    private val history = ArrayDeque<Pair<String, String>>()

    /** Oxirgi xato sababi (ekranda ko'rsatish uchun): noto'g'ri kalit, limit tugagan va h.k. */
    @Volatile
    var lastError: String? = null
        private set

    val isEnabled: Boolean
        get() = Prefs.aiEnabled(context) && Prefs.keyFor(context, Prefs.aiProvider(context)).isNotBlank()

    private fun client(): AnthropicClient {
        val key = Prefs.keyFor(context, Prefs.CLAUDE).trim()
        val existing = client
        if (existing != null && clientKey == key) return existing
        return AnthropicOkHttpClient.builder().apiKey(key).build().also {
            client = it
            clientKey = key
        }
    }

    /** Fon oqimida AI'dan so'raydi, natijani asosiy oqimga qaytaradi (xato bo'lsa — null). */
    fun interpret(alternatives: List<String>, onResult: (Result?) -> Unit) {
        val said = alternatives.distinct().take(5)
        executor.execute {
            lastError = null
            val result = try {
                ask(said)
            } catch (e: Exception) {
                android.util.Log.w("AiBrain", "AI so'rovi bajarilmadi", e)
                lastError = e.message ?: e.javaClass.simpleName
                null
            }
            if (result == null && lastError == null) lastError = "AI tushunarli javob qaytarmadi"
            main.post { onResult(result) }
        }
    }

    private fun ask(said: List<String>): Result? {
        val now = SimpleDateFormat("yyyy-MM-dd HH:mm, EEEE", Locale("uz")).format(Date())
        val prompt = buildString {
            if (history.isNotEmpty()) {
                append("Oldingi suhbat:\n")
                for ((q, a) in history) append("Foydalanuvchi: ").append(q).append("\nYordamchi: ").append(a).append('\n')
                append('\n')
            }
            append("Hozirgi vaqt: ").append(now).append('\n')
            append("Ovoz tanish variantlari (birinchisi eng ehtimolli):\n")
            said.forEachIndexed { i, s -> append(i + 1).append(". ").append(s).append('\n') }
        }

        val text = if (Prefs.aiProvider(this.context) == Prefs.GEMINI) askGemini(prompt) else askClaude(prompt)
        val result = parse(text ?: return null) ?: return null
        result.reply?.let { reply ->
            history.addLast(said.first() to reply)
            while (history.size > 4) history.removeFirst()
        }
        return result
    }

    /**
     * Google Gemini (AI Studio'ning bepul kaliti bilan). Model nomi vaqt o'tib o'zgarishi mumkin,
     * shuning uchun avval doim eng yangi "flash" modelni ko'rsatuvchi nom, keyin aniq nom sinaladi.
     */
    private fun askGemini(prompt: String): String? {
        val key = Prefs.keyFor(context, Prefs.GEMINI).trim()
        val body = JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", SYSTEM_PROMPT))))
            .put("contents", JSONArray().put(
                JSONObject().put("role", "user").put("parts", JSONArray().put(JSONObject().put("text", prompt)))
            ))
            .put("generationConfig", JSONObject()
                .put("responseMimeType", "application/json")
                .put("temperature", 0.2))
            .toString()
        var busy = false
        for (model in GEMINI_MODELS) {
            // Model band bo'lsa (503) bir marta biroz kutib qayta urinamiz, keyin keyingi modelga o'tamiz
            for (attempt in 0..1) {
            if (attempt > 0) Thread.sleep(1500)
            val conn = URL("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent")
                .openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.connectTimeout = 10_000
                conn.readTimeout = 30_000
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setRequestProperty("x-goog-api-key", key)
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                if (code == 404) break // bu model endi yo'q — keyingisini sinaymiz
                if (code !in 200..299) {
                    val err = conn.errorStream?.bufferedReader()?.use { it.readText() }
                    android.util.Log.w("AiBrain", "Gemini xatosi $code ($model): $err")
                    when (geminiRetry(code)) {
                        Retry.SAME -> { busy = true; continue }
                        Retry.NEXT_MODEL -> { busy = true; break }
                        Retry.NO -> {
                            lastError = "Gemini xatosi $code: " + (geminiError(err) ?: "")
                            return null
                        }
                    }
                }
                val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                return geminiText(json)
            } finally {
                conn.disconnect()
            }
            }
        }
        lastError = if (busy) "Gemini hozir band yoki bepul limit tugagan. Birozdan keyin qayta urinib ko'ring."
        else "Gemini modeli topilmadi"
        return null
    }

    private fun askClaude(prompt: String): String? {
        val params = MessageCreateParams.builder()
            .model("claude-opus-5")
            .maxTokens(4000L)
            .system(SYSTEM_PROMPT)
            // Ovozli yordamchi tez javob berishi kerak — qisqa o'ylash yetarli
            .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
            // Rad etilgan so'rov boshqa modelga yo'naltiriladi (server tomonida)
            .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
            .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            .addUserMessage(prompt)
            .build()

        val response = client().messages().create(params)
        val stop = response.stopReason().map { it.toString() }.orElse("")
        if (stop.contains("refusal", ignoreCase = true)) return null
        return response.content().mapNotNull { block -> block.text().orElse(null)?.text() }.joinToString("")
    }

    companion object {
        /** Bepul rejadagi modellar: biri band bo'lsa, keyingisi sinaladi. */
        private val GEMINI_MODELS = listOf(
            "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"
        )

        /** 503/500 — model vaqtincha band: shu modelni qayta; 429 — shu model limiti tugagan: keyingi model. */
        fun geminiRetry(code: Int): Retry = when (code) {
            500, 502, 503, 504 -> Retry.SAME
            429 -> Retry.NEXT_MODEL
            else -> Retry.NO
        }

        /** Gemini xato javobidan qisqa sababni ajratadi: {"error":{"message":"API key not valid..."}} */
        fun geminiError(body: String?): String? = try {
            JSONObject(body ?: "").optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            body?.take(200)
        }

        /** Gemini javobidan matnni ajratadi: candidates[0].content.parts[*].text */
        fun geminiText(json: JSONObject): String? {
            val parts = json.optJSONArray("candidates")?.optJSONObject(0)
                ?.optJSONObject("content")?.optJSONArray("parts") ?: return null
            val sb = StringBuilder()
            for (i in 0 until parts.length()) {
                val p = parts.optJSONObject(i) ?: continue
                if (p.optBoolean("thought", false)) continue
                sb.append(p.optString("text", ""))
            }
            return sb.toString().ifBlank { null }
        }

        private val SYSTEM_PROMPT = """
            You are the brain of a voice assistant running on an Uzbek user's Android phone.
            You receive speech-recognition hypotheses of what the user said. Recognition of Uzbek is often
            poor: words may be misspelled, split, merged, written in Latin or Cyrillic, or mixed with Russian.
            Work out what the user most likely meant, using all hypotheses together.

            Respond with ONLY one JSON object (no markdown, no extra text):
            {
              "action": one of "call", "sms", "answer", "hangup", "music", "music_pause", "music_next",
                        "music_prev", "volume_up", "volume_down", "volume_mute", "alarm", "timer",
                        "search", "youtube", "navigate", "camera", "battery", "wifi", "bluetooth",
                        "flash_on", "flash_off", "open_app", "time", "date", "chat",
              "target": contact name or phone number for call/sms (name in base form, without Uzbek case
                        suffixes such as -ga/-ni: "Aliga" -> "Ali", "onamga" -> "onam"); app name for
                        open_app; place for navigate,
              "text": SMS body exactly as the user wants it sent, or null if they did not say it,
              "query": song/artist for music, search words for search/youtube, or null,
              "hour": integer 0-23 or null, "minute": integer or null, "seconds": integer or null (timer length),
              "reply": what to say back to the user
            }

            Rules:
            - "reply" is always in Uzbek, Latin script, natural and friendly, with correct oʻ and gʻ.
              Keep it to one or two short sentences; for "chat" up to three.
            - Use "chat" for questions, conversation, jokes, advice, or anything the phone actions do not cover,
              and put your actual answer in "reply".
            - "Svet", "fonar", "chiroq", "spichka" when asked to turn on/off mean the flashlight.
            - "music" with a null query means resume or start any music.
            - For "alarm", convert the spoken time to 24-hour format ("kechqurun 7" -> 19).
            - Never invent a contact name or phone number that the user did not say.
        """.trimIndent()

        private fun JSONObject.str(key: String): String? =
            if (isNull(key)) null else optString(key, "").trim().ifEmpty { null }

        private fun JSONObject.int(key: String): Int? =
            if (!has(key) || isNull(key)) null else optInt(key, Int.MIN_VALUE).takeIf { it != Int.MIN_VALUE }

        /** AI javobidagi JSON'ni buyruqqa aylantiradi. */
        fun parse(raw: String): Result? {
            val start = raw.indexOf('{')
            val end = raw.lastIndexOf('}')
            if (start < 0 || end <= start) return null
            val o = try {
                JSONObject(raw.substring(start, end + 1))
            } catch (e: Exception) {
                return null
            }
            val reply = o.str("reply")
            val target = o.str("target")
            val query = o.str("query")
            val cmd: Command? = when (o.str("action")) {
                "call" -> target?.let { Command.Call(it) }
                "sms" -> target?.let { Command.Sms(it, o.str("text")) }
                "answer" -> Command.Answer
                "hangup" -> Command.HangUp
                "music" -> Command.Music(query)
                "music_pause" -> Command.MusicPause
                "music_next" -> Command.MusicNext
                "music_prev" -> Command.MusicPrev
                "volume_up" -> Command.VolumeUp
                "volume_down" -> Command.VolumeDown
                "volume_mute" -> Command.VolumeMute
                "alarm" -> Command.Alarm(o.int("hour")?.takeIf { it in 0..23 }, o.int("minute")?.takeIf { it in 0..59 } ?: 0)
                "timer" -> Command.Timer(o.int("seconds")?.takeIf { it > 0 } ?: 60)
                "search" -> query?.let { Command.Search(it) }
                "youtube" -> Command.YouTube(query)
                "navigate" -> Command.Navigate(target ?: query ?: "")
                "camera" -> Command.Camera
                "battery" -> Command.Battery
                "wifi" -> Command.Wifi
                "bluetooth" -> Command.Bluetooth
                "flash_on" -> Command.FlashOn
                "flash_off" -> Command.FlashOff
                "open_app" -> target?.let { Command.OpenApp(it) }
                "time" -> Command.Time
                "date" -> Command.Date
                else -> null
            }
            if (cmd == null && reply == null) return null
            return Result(cmd, reply)
        }
    }
}
