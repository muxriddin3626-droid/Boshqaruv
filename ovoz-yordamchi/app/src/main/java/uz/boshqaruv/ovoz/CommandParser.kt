package uz.boshqaruv.ovoz

/**
 * Ovozdan kelgan matnni buyruqqa aylantiradi.
 * Android'ga bog'liq emas — shuning uchun oddiy JVM testlari bilan tekshiriladi.
 */
sealed class Command {
    /** [target] — kontakt nomi yoki telefon raqami. */
    data class Call(val target: String) : Command()
    data class Sms(val target: String, val text: String?) : Command()
    object Answer : Command()
    object HangUp : Command()
    object Time : Command()
    object Date : Command()
    object FlashOn : Command()
    object FlashOff : Command()
    data class OpenApp(val name: String) : Command()

    /** [query] — qo'shiqchi yoki qo'shiq nomi; null bo'lsa, oxirgi ijro etilgan musiqa davom etadi. */
    data class Music(val query: String?) : Command()
    object MusicPause : Command()
    object MusicNext : Command()
    object MusicPrev : Command()
    object VolumeUp : Command()
    object VolumeDown : Command()
    object VolumeMute : Command()

    /** [hour] null bo'lsa — budilnik ilovasi ochiladi. */
    data class Alarm(val hour: Int?, val minute: Int) : Command()
    data class Timer(val seconds: Int) : Command()
    data class Search(val query: String) : Command()
    data class YouTube(val query: String?) : Command()
    data class Navigate(val place: String) : Command()
    object Camera : Command()
    object Battery : Command()
    object Wifi : Command()
    object Bluetooth : Command()

    object Yes : Command()
    object No : Command()
    object Stop : Command()
    data class Unknown(val text: String) : Command()
}

object CommandParser {

    private val CYRILLIC = mapOf(
        'а' to "a", 'б' to "b", 'в' to "v", 'г' to "g", 'д' to "d", 'е' to "e", 'ё' to "yo",
        'ж' to "j", 'з' to "z", 'и' to "i", 'й' to "y", 'к' to "k", 'л' to "l", 'м' to "m",
        'н' to "n", 'о' to "o", 'п' to "p", 'р' to "r", 'с' to "s", 'т' to "t", 'у' to "u",
        'ф' to "f", 'х' to "x", 'ц' to "ts", 'ч' to "ch", 'ш' to "sh", 'щ' to "sh", 'ъ' to "",
        'ы' to "i", 'ь' to "", 'э' to "e", 'ю' to "yu", 'я' to "ya", 'ў' to "o", 'қ' to "q",
        'ғ' to "g", 'ҳ' to "h"
    )

    /** Kichik harf, kirill → lotin, tutuq belgilarini olib tashlash: "Qo'ng'iroq" → "qongiroq". */
    fun normalize(text: String): String {
        val sb = StringBuilder()
        for (c in text.lowercase()) {
            val mapped = CYRILLIC[c]
            when {
                mapped != null -> sb.append(mapped)
                c.isLetterOrDigit() || c == '+' -> sb.append(c)
                c == '\'' || c == '`' || c == '‘' || c == '’' || c == 'ʻ' || c == 'ʼ' -> Unit
                else -> sb.append(' ')
            }
        }
        return sb.toString().replace(Regex("\\s+"), " ").trim()
    }

    /**
     * Talaffuzga yaqin shakl: q→k, x→h, ikki harf → bitta.
     * Ovoz taniydigan xizmat "qo'ng'iroq"ni "kongirok", "to'xtat"ni "tohtat" deb yozsa ham tushunish uchun.
     */
    fun phonetic(normalized: String): String {
        val s = normalized.replace('q', 'k').replace('x', 'h').replace('w', 'v')
        val sb = StringBuilder()
        for (c in s) if (sb.isEmpty() || sb.last() != c || c.isDigit()) sb.append(c)
        return sb.toString()
    }

    // Kalit so'zlar talaffuz (phonetic) shaklida yozilgan. Bo'sh joyli kalitlar butun gapdan qidiriladi.
    private val FLASH = listOf("fonar", "fanar", "chirok", "fanarik")
    private val ALARM = listOf("budilnik", "budelnik", "uygot", "alarm", "buditel")
    private val TIMER = listOf("taymer", "taimer", "timer")
    private val MUSIC = listOf("muzik", "muzy", "musik", "muzk", "koshik", "ashula", "pesn", "trek", "kuy ", "kuyni", "radio", "playlist")
    private val PAUSE = listOf("tohtat", "pauza", "stop", "ochir", "vykl", "yopi", "tohta")
    private val NEXT = listOf("keyingi", "kiyingi", "sleduyush", "next", "boshkasi", "boshka", "almashtir", "pereklyuch")
    private val PREV = listOf("oldingi", "avvalgi", "predydush", "orkaga")
    private val VOLUME = listOf("ovoz", "gromk", "gromch", "zvuk", "tovush")
    private val LOUDER = listOf("baland", "kotar", "kuchay", "oshir", "gromche", "kopay", "katta")
    private val QUIETER = listOf("past", "pasay", "kamay", "tushir", "tishe", "sekin", "kichik")
    private val MUTE = listOf("ochir", "yok kil", "vykl", "jim")
    private val BATTERY = listOf("batare", "zaryad", "akumulyator", "batarey")
    private val CAMERA = listOf("kamera", "rasmga ol", "suratga ol", "rasm ol", "foto")
    private val WIFI = listOf("vayfay", "vay fay", "vifi", "vi fi", "wifi", "vaifai")
    private val BLUETOOTH = listOf("blutuz", "blyutuz", "bluetooth", "blutus")
    private val NAVIGATE = listOf("yol korsat", "yolni korsat", "marshrut", "navigator", "karta", "harita", "kak doyehat")
    private val YOUTUBE = listOf("yutub", "youtube", "yutib", "yutb")
    private val SEARCH = listOf("kidir", "gugl", "google", "internetdan", "nayd", "poisk", "izla")
    private val SMS = listOf("sms", "smska", "esemes", "habar", "message", "napish", "soobsh")
    private val WRITE = listOf("yoz", "yozib", "yozing", "yozgin")
    private val ANSWER = listOf("kotar", "kutar", "javob", "kabul kil", "trubkani ol", "trubka ol", "otvet", "primi", "podnimi")
    private val HANGUP = listOf("rad et", "tugat", "ochir", "sbros", "otboy", "tashla", "otkloni", "zaversh", "poloji")
    private val CALL = listOf(
        "kongirok", "kongrok", "kongiro", "kungirok", "kongirk", "zvon", "pozvon", "chakir", "call",
        "tel kil", "telefon kil", "tel kilib", "telefon kilib", "nabery", "nabrat", "nomer ter", "raqam ter"
    )
    private val OPEN = listOf("och", "ochib", "ochgin", "oching", "otkroy", "zapusti", "ishga tushir")
    private val YES = setOf("ha", "haa", "albata", "yubor", "yuborish", "mayli", "ok", "okey", "tasdikla", "togri", "jonat", "da", "konechno", "davay", "hop", "hoop")
    private val NO = setOf("yok", "bekor", "kerakmas", "net", "yuborma", "tohta", "otmena", "kerak emas")
    private val STOP = listOf("tohta", "bas", "jim bol", "yetadi", "hvatit")

    /** Ism/raqam/so'rov atrofida keladigan, ammo o'zi ma'no bermaydigan so'zlar (normalize shaklida). */
    private val FILLER = setOf(
        "iltimos", "menga", "hozir", "tezda", "qil", "qilib", "qilgin", "qiling", "ber", "bering",
        "yubor", "yuborgin", "jonat", "kerak", "ga", "raqamiga", "raqamga", "nomerga", "nomeriga",
        "telefoniga", "telefonga", "tel", "telefon", "deb", "shu", "unga", "manga", "bir", "bitta",
        "sms", "smska", "xabar", "yoz", "yozib", "yozgin", "yozing", "ni", "qongiroq", "chaqir",
        "pozvoni", "zvoni", "napishi", "otpravi", "mne", "pojaluysta", "ey", "hey"
    )

    /** Musiqa/qidiruv so'rovidan olib tashlanadigan so'zlar (talaffuz shaklida). */
    private val MEDIA_FILLER = setOf(
        "koy", "koyib", "koygin", "koying", "yok", "yokib", "top", "topib", "kor", "och", "ochib", "dan", "da",
        "menga", "iltimos", "bir", "biror", "hozir", "kerak", "ber", "kil", "kilib", "yana", "trek", "ichidan", "mne"
    )
    private val MEDIA_FILLER_PREFIX = listOf(
        "kuyla", "eshit", "ijro", "chal", "vkl", "postav", "sygray", "igray", "kidir", "korsat", "muzik", "muzy",
        "musik", "koshik", "ashula", "pesn", "orkali", "yutub", "youtube", "gugl", "google", "internet", "nayd",
        "poisk", "izla", "najmi", "otkroy"
    )

    private data class Tok(val orig: String, val norm: String, val ph: String)

    private fun tokenize(text: String): List<Tok> =
        text.trim().split(Regex("\\s+")).flatMap { w ->
            val n = normalize(w)
            val parts = n.split(' ').filter { it.isNotEmpty() }
            // "7:30" → "7", "30": bitta so'z ichidagi belgilar ajratgan qismlar alohida so'z bo'ladi
            if (parts.size == 1) listOf(Tok(w, n, phonetic(n))) else parts.map { Tok(it, it, phonetic(it)) }
        }

    /** So'z kalit o'zakka mosmi: boshlanishi mos yoki (uzun o'zaklarda) bitta harf farq qiladi. */
    private fun wordMatches(w: String, stem: String): Boolean {
        if (w.startsWith(stem)) return true
        if (stem.length >= 6 && w.length >= stem.length - 1) {
            return levenshtein(w.take(stem.length), stem) <= 1
        }
        return false
    }

    private class Text(val tokens: List<Tok>) {
        val ph: List<String> = tokens.map { it.ph }
        val joined: String = " " + ph.joinToString(" ") + " "

        fun has(keys: Collection<String>): Boolean = keys.any { k ->
            if (k.contains(' ') || k.endsWith(' ')) joined.contains(" ${k.trim()}${if (k.endsWith(' ')) " " else ""}")
            else ph.any { wordMatches(it, k) }
        }

        fun indexOf(keys: Collection<String>): Int =
            ph.indexOfFirst { w -> keys.any { k -> !k.contains(' ') && wordMatches(w, k) } }
    }

    /**
     * [expectingAnswer] — yordamchi "ha/yo'q" kutayotgan bo'lsa true.
     */
    fun parse(raw: String, expectingAnswer: Boolean = false): Command {
        val tokens = tokenize(raw)
        if (tokens.isEmpty()) return Command.Unknown(raw)
        val t = Text(tokens)
        val words = tokens.map { it.norm }

        if (expectingAnswer) {
            if (t.ph.any { it in NO } || t.joined.contains(" kerak emas ")) return Command.No
            if (t.ph.any { it in YES }) return Command.Yes
        }

        // Tartib muhim: "fonarni o'chir", "budilnik qo'y", "ovozni ko'tar" — qo'ng'iroq buyruqlari bilan adashmasin
        if (t.has(FLASH)) {
            return if (t.has(listOf("ochir", "sondir", "yopi", "vykl"))) Command.FlashOff else Command.FlashOn
        }
        if (t.has(ALARM)) return parseAlarm(t)
        if (t.has(TIMER)) return Command.Timer(parseDuration(t).takeIf { it > 0 } ?: 60)

        // "ovozni baland qil" — musiqa buyrug'idan oldin, "musiqani o'chir" esa pauza bo'lishi uchun o'chirish keyinroq
        if (t.has(VOLUME) && t.has(LOUDER)) return Command.VolumeUp
        if (t.has(VOLUME) && t.has(QUIETER)) return Command.VolumeDown

        if (t.has(YOUTUBE)) {
            val q = mediaQuery(tokens)
            return Command.YouTube(q)
        }

        val music = t.has(MUSIC)
        if (music || t.has(listOf("pauza"))) {
            return when {
                t.has(NEXT) -> Command.MusicNext
                t.has(PREV) -> Command.MusicPrev
                t.has(PAUSE) -> Command.MusicPause
                else -> Command.Music(mediaQuery(tokens))
            }
        }
        if (tokens.size <= 3 && t.has(NEXT) && !t.has(CALL)) return Command.MusicNext
        if (tokens.size <= 3 && t.has(PREV) && !t.has(CALL)) return Command.MusicPrev

        if (t.has(VOLUME) && t.has(MUTE)) return Command.VolumeMute

        if (t.has(BATTERY)) return Command.Battery
        if (t.has(CAMERA)) return Command.Camera
        if (t.has(WIFI)) return Command.Wifi
        if (t.has(BLUETOOTH)) return Command.Bluetooth

        if (t.has(NAVIGATE)) {
            val stop = t.ph.indexOfFirst { it.startsWith("yol") || it.startsWith("marshrut") || it.startsWith("navigat") || it.startsWith("karta") || it.startsWith("harita") }
            val skip = setOf("korsat", "korsatib", "och", "ochib", "yol", "yolni", "karta", "kartani", "harita", "haritani")
            val part = if (stop > 0) tokens.subList(0, stop) else tokens.subList(stop + 1, tokens.size)
            val place = part.filter { it.norm !in FILLER && it.ph !in skip }.joinToString(" ") { stripDative(it.norm) }
            return Command.Navigate(place)
        }

        // SMS: aniq "sms/xabar" so'zi bo'lsa — SMS; faqat "yoz" bo'lsa, qo'ng'iroq so'zi yo'qligida SMS
        val callHit = t.has(CALL)
        val explicitSms = t.indexOf(SMS)
        val smsIdx = when {
            explicitSms >= 0 -> explicitSms
            !callHit -> t.ph.indexOfFirst { it in WRITE }
            else -> -1
        }
        if (smsIdx >= 0) parseSms(tokens, smsIdx)?.let { return it }

        if (t.has(ANSWER)) return Command.Answer
        val shortHangup = tokens.size <= 2 && t.ph.any { it == "koy" || it == "koyib" }
        if ((t.has(HANGUP) || shortHangup) && words.none { isDative(it) }) return Command.HangUp

        if (callHit) {
            val target = extractTarget(tokens)
            return if (target.isEmpty()) Command.Unknown(raw) else Command.Call(target)
        }

        if (t.has(listOf("soat", "vakt", "kotoriy chas", "skolko vremen"))) return Command.Time
        if (t.has(listOf("sana", "nechanchi", "kaysi kun", "kakoye chislo"))) return Command.Date

        if (t.has(SEARCH)) {
            val q = mediaQuery(tokens)
            if (q != null) return Command.Search(q)
        }

        val openIdx = t.ph.indexOfFirst { it in OPEN }
            .let { if (it < 0 && t.joined.contains(" ishga tushir")) t.ph.indexOf("ishga") else it }
        if (openIdx >= 0) {
            val skip = setOf("ilova", "ilovani", "dastur", "dasturini", "dasturni", "prilojeniye")
            val before = words.subList(0, openIdx).filter { it !in FILLER && it !in skip }
            val after = words.subList(openIdx + 1, words.size).filter { it !in FILLER && it !in skip && phonetic(it) !in OPEN && it != "tushir" }
            val name = (before.ifEmpty { after }).joinToString(" ") { stripAccusative(it) }
            if (name.isNotBlank()) return Command.OpenApp(name)
        }

        if (t.has(STOP)) return Command.Stop
        return Command.Unknown(raw)
    }

    // ---------------- Budilnik va taymer ----------------

    private fun parseAlarm(t: Text): Command {
        val nums = numbers(t.tokens.map { it.norm })
        if (nums.isEmpty()) return Command.Alarm(null, 0)
        var hour = nums[0]
        var minute = nums.getOrNull(1) ?: 0
        if (t.has(listOf("yarim", "polovin"))) minute = 30
        if (hour in 1..11 && t.has(listOf("kechkurun", "kechki", "kech ", "tushdan keyin", "kechasi", "vecher"))) hour += 12
        if (hour !in 0..23) hour = 7
        if (minute !in 0..59) minute = 0
        return Command.Alarm(hour, minute)
    }

    private fun parseDuration(t: Text): Int {
        var total = 0
        var pending: Int? = null
        val words = t.tokens.map { it.norm }
        for (i in words.indices) {
            val n = numberOf(words, i)
            if (n != null) {
                pending = (pending?.takeIf { it % 10 == 0 && n < 10 && it >= 10 }?.plus(n)) ?: n
                continue
            }
            val ph = phonetic(words[i])
            val unit = when {
                ph.startsWith("sekund") || ph.startsWith("soniya") -> 1
                ph.startsWith("dakik") || ph.startsWith("minut") -> 60
                ph.startsWith("soat") || ph.startsWith("chas") -> 3600
                ph == "yarim" -> -1
                else -> 0
            }
            if (unit > 0) {
                total += (pending ?: 1) * unit
                pending = null
            } else if (unit == -1) {
                total += 1800
            }
        }
        if (pending != null) total += pending * 60
        return total
    }

    private val NUMBER_WORDS = mapOf(
        "nol" to 0, "bir" to 1, "ikki" to 2, "uch" to 3, "tort" to 4, "besh" to 5, "olti" to 6, "yetti" to 7,
        "sakkiz" to 8, "toqqiz" to 9, "on" to 10, "yigirma" to 20, "ottiz" to 30, "qirq" to 40, "ellik" to 50,
        "oltmish" to 60
    )
    private val NUMBER_SUFFIXES = listOf("gacha", "dagi", "ga", "da", "ta", "ni", "dan", "lik")

    /** [i]-so'z son bo'lsa (raqam yoki so'z bilan: "yettiga", "7ga", "o'n") — qiymatini qaytaradi. */
    private fun numberOf(words: List<String>, i: Int): Int? {
        val w = words[i]
        val digits = w.takeWhile { it.isDigit() }
        if (digits.isNotEmpty() && digits.length <= 4) return digits.toIntOrNull()
        NUMBER_WORDS[w]?.let { return it }
        for (s in NUMBER_SUFFIXES) {
            if (w.endsWith(s)) NUMBER_WORDS[w.dropLast(s.length)]?.let { return it }
        }
        return null
    }

    /** Gapdagi sonlar: "o'n besh" → 15, "7 30" → [7, 30]. */
    fun numbers(words: List<String>): List<Int> {
        val out = mutableListOf<Int>()
        var prevTens = false
        for (i in words.indices) {
            val n = numberOf(words, i)
            if (n == null) {
                prevTens = false
                continue
            }
            if (prevTens && n in 1..9 && out.isNotEmpty()) {
                out[out.size - 1] = out.last() + n
                prevTens = false
            } else {
                out += n
                prevTens = n >= 10 && n % 10 == 0 && words[i].none(Char::isDigit)
            }
        }
        return out
    }

    // ---------------- So'rovlar ----------------

    /** "Shahzodaning qo'shig'ini qo'y" → "shahzoda". Hech narsa qolmasa — null. */
    private fun mediaQuery(tokens: List<Tok>): String? {
        val rest = tokens.filter { tok ->
            tok.ph !in MEDIA_FILLER && MEDIA_FILLER_PREFIX.none { wordMatches(tok.ph, it) } && tok.norm !in FILLER
        }
        val q = rest.joinToString(" ") { stripGenitive(stripAccusative(it.norm)) }.trim()
        return q.ifEmpty { null }
    }

    private fun parseSms(tokens: List<Tok>, idx: Int): Command? {
        val before = tokens.subList(0, idx)
        val after = tokens.subList(idx + 1, tokens.size)
        val debIdx = before.indexOfFirst { it.norm == "deb" }

        var target: String
        var text: List<Tok>

        if (debIdx >= 0) {
            // "Aliga salom qalaysan deb sms yoz"
            val nameEnd = before.indexOfFirst { isDative(it.norm) }.let { if (it < 0 || it >= debIdx) 0 else it }
            target = before.subList(0, nameEnd + 1).filter { it.norm !in FILLER }.joinToString(" ") { it.norm }
            text = before.subList(nameEnd + 1, debIdx)
        } else if (before.any { it.norm !in FILLER }) {
            // "Aliga sms yoz salom qalaysan"
            target = before.filter { it.norm !in FILLER }.joinToString(" ") { it.norm }
            text = after
        } else {
            // "sms yoz Aliga salom qalaysan" / "napishi Ali privet"
            val rest = after.dropWhile { it.norm in FILLER }
            if (rest.isEmpty()) return null
            val nameEnd = rest.indexOfFirst { isDative(it.norm) || it.norm.any(Char::isDigit) }.let { if (it < 0) 0 else it }
            target = rest.subList(0, nameEnd + 1).joinToString(" ") { it.norm }
            text = rest.subList(nameEnd + 1, rest.size)
        }

        val digits = digitsOf(tokens.subList(0, idx).map { it.norm })
        if (digits != null) target = digits

        text = text.dropWhile { it.norm in setOf("yoz", "yozib", "yubor", "jonat", "ber", "qil", "deb", "sms", "xabar", "ki", "yozgin") }
        text = text.dropLastWhile { it.norm in setOf("deb", "yoz", "yubor", "jonat", "yozib") }
        target = target.trim()
        if (target.isEmpty()) return null
        val body = text.joinToString(" ") { it.orig }.trim()
        return Command.Sms(target, body.ifEmpty { null })
    }

    /** Qo'ng'iroq uchun kimga: raqam bo'lsa raqam, aks holda keraksiz so'zlarsiz ism. */
    private fun extractTarget(tokens: List<Tok>): String {
        val words = tokens.map { it.norm }
        digitsOf(words)?.let { return it }
        val kw = tokens.indexOfFirst { tok ->
            CALL.any { k -> !k.contains(' ') && wordMatches(tok.ph, k) } || tok.norm == "tel" || tok.norm == "telefon"
        }
        val before = if (kw >= 0) words.subList(0, kw) else words
        val after = if (kw >= 0) words.subList(kw + 1, words.size) else emptyList()
        val name = before.filter { it !in FILLER }
        if (name.isNotEmpty()) return name.joinToString(" ")
        return after.filter { it !in FILLER }.joinToString(" ")
    }

    private fun digitsOf(words: List<String>): String? {
        val joined = words.filter { w -> w.any(Char::isDigit) }
            .joinToString("") { w -> w.filter { it.isDigit() || it == '+' } }
        return if (joined.count(Char::isDigit) >= 3) joined else null
    }

    fun isDative(w: String) = w.length > 3 && (w.endsWith("ga") || w.endsWith("ka") || w.endsWith("qa"))

    /** "aliga" → "ali", "akamga" → "akam". */
    fun stripDative(w: String): String = if (isDative(w)) w.dropLast(2) else w

    /** "telegramni" → "telegram". */
    fun stripAccusative(w: String): String = if (w.length > 4 && w.endsWith("ni")) w.dropLast(2) else w

    /** "shahzodaning" → "shahzoda". */
    fun stripGenitive(w: String): String = if (w.length > 6 && w.endsWith("ning")) w.dropLast(4) else w

    fun levenshtein(a: String, b: String): Int {
        var prev = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val cur = IntArray(b.length + 1)
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            prev = cur
        }
        return prev[b.length]
    }
}
