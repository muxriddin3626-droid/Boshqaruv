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

    private val ANSWER = listOf("kotar", "javob ber", "qabul qil", "trubkani ol", "trubka ol")
    private val HANGUP = listOf("rad et", "tugat", "ochir", "qoy", "sbros", "otboy", "tashla", "uzib qoy")
    private val CALL = listOf("qongiroq", "qongroq", "qongiro", "qungiroq", "zvon", "chaqir", "call", "tel qil", "telefon qil", "tel qilib", "telefon qilib")
    private val SMS_WORDS = setOf("sms", "smska", "smsni", "esemes", "xabar", "xabarni", "message", "yoz", "yozib", "yozing", "yozgin")
    private val YES = setOf("ha", "xa", "haa", "albatta", "yubor", "yuborish", "mayli", "ok", "okey", "tasdiqla", "togri", "jonat", "da")
    private val NO = setOf("yoq", "bekor", "kerakmas", "net", "yuborma", "toxta")
    private val STOP = listOf("toxta", "bas", "jim bol", "yetadi")

    /** Ism/raqam atrofida keladigan, ammo o'zi ism bo'lmagan so'zlar. */
    private val FILLER = setOf(
        "iltimos", "menga", "hozir", "tezda", "qil", "qilib", "qilgin", "qiling", "ber", "bering",
        "yubor", "yuborgin", "jonat", "kerak", "ga", "raqamiga", "raqamga", "nomerga", "nomeriga",
        "telefoniga", "telefonga", "tel", "telefon", "deb", "shu", "unga", "manga", "bir", "bitta",
        "sms", "smska", "xabar", "yoz", "yozib", "yozgin", "yozing", "ni", "qongiroq", "chaqir"
    )

    private data class Tok(val orig: String, val norm: String)

    private fun tokenize(text: String): List<Tok> =
        text.trim().split(Regex("\\s+")).mapNotNull { w ->
            val n = normalize(w)
            if (n.isEmpty()) null else Tok(w, n)
        }

    private fun String.hasAny(keys: Collection<String>): Boolean {
        val padded = " $this "
        return keys.any { k -> if (k.endsWith(" ")) padded.contains(" $k") else contains(k) }
    }

    /**
     * [expectingAnswer] — yordamchi "ha/yo'q" kutayotgan bo'lsa true.
     * [ringing] — telefon jiringlayotgan bo'lsa, "o'chir" qo'ng'iroqni rad etadi.
     */
    fun parse(raw: String, expectingAnswer: Boolean = false): Command {
        val tokens = tokenize(raw)
        val norm = tokens.joinToString(" ") { it.norm }
        if (norm.isEmpty()) return Command.Unknown(raw)
        val words = tokens.map { it.norm }

        if (expectingAnswer) {
            if (words.any { it in NO } || norm.contains("kerak emas")) return Command.No
            if (words.any { it in YES }) return Command.Yes
        }

        // Fonar — "o'chir" so'zi qo'ng'iroqni tugatish bilan adashmasligi uchun birinchi tekshiriladi
        if (norm.hasAny(listOf("fonar", "chiroq", "fanar", "fonarik"))) {
            return if (norm.hasAny(listOf("ochir", "sondir", "yopi"))) Command.FlashOff else Command.FlashOn
        }

        // Aniq "sms/xabar" so'zi bo'lsa — SMS; faqat "yoz" bo'lsa, qo'ng'iroq so'zi yo'qligida SMS
        val explicitSms = words.indexOfFirst { it.startsWith("sms") || it.startsWith("xabar") || it == "esemes" || it == "message" }
        val callHit = norm.hasAny(CALL)
        val smsIdx = when {
            explicitSms >= 0 -> explicitSms
            !callHit -> words.indexOfFirst { it in SMS_WORDS }
            else -> -1
        }
        if (smsIdx >= 0) parseSms(tokens, smsIdx)?.let { return it }

        if (norm.hasAny(ANSWER) || norm.contains("javob")) return Command.Answer
        if (norm.hasAny(HANGUP) && words.none { isDative(it) }) return Command.HangUp

        if (callHit) {
            val target = extractTarget(tokens)
            return if (target.isEmpty()) Command.Unknown(raw) else Command.Call(target)
        }

        if (norm.contains("soat") || norm.contains("vaqt")) return Command.Time
        if (norm.contains("sana") || norm.contains("nechanchi") || norm.contains("qaysi kun")) return Command.Date

        val ochIdx = words.indexOfFirst { it == "och" || it == "ochib" || it == "ochgin" || it == "ishga" }
        if (ochIdx > 0) {
            val name = words.subList(0, ochIdx).filter { it !in FILLER && it != "ilova" && it != "ilovani" && it != "dastur" && it != "dasturini" }
                .joinToString(" ") { stripAccusative(it) }
            if (name.isNotBlank()) return Command.OpenApp(name)
        }

        if (norm.hasAny(STOP)) return Command.Stop
        return Command.Unknown(raw)
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
            // "sms yoz Aliga salom qalaysan"
            val rest = after.dropWhile { it.norm in FILLER }
            val nameEnd = rest.indexOfFirst { isDative(it.norm) || it.norm.any(Char::isDigit) }
            if (nameEnd < 0) return null
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
        val kw = words.indexOfFirst { w -> CALL.any { k -> !k.contains(' ') && w.startsWith(k) } || w == "tel" || w == "telefon" }
        val before = if (kw >= 0) words.subList(0, kw) else words
        val after = if (kw >= 0) words.subList(kw + 1, words.size) else emptyList()
        val name = before.filter { it !in FILLER }
        if (name.isNotEmpty()) return name.joinToString(" ")
        return after.filter { it !in FILLER }.joinToString(" ")
    }

    private fun digitsOf(words: List<String>): String? {
        val joined = words.filter { w -> w.all { it.isDigit() || it == '+' } || w.any(Char::isDigit) }
            .joinToString("") { w -> w.filter { it.isDigit() || it == '+' } }
        return if (joined.count(Char::isDigit) >= 3) joined else null
    }

    fun isDative(w: String) = w.length > 3 && (w.endsWith("ga") || w.endsWith("ka") || w.endsWith("qa"))

    /** "aliga" → "ali", "akamga" → "akam". */
    fun stripDative(w: String): String = if (isDative(w)) w.dropLast(2) else w

    /** "telegramni" → "telegram". */
    fun stripAccusative(w: String): String = if (w.length > 4 && w.endsWith("ni")) w.dropLast(2) else w
}
