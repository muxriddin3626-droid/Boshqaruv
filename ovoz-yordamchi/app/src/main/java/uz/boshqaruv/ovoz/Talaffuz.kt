package uz.boshqaruv.ovoz

/**
 * O'zbekcha matnni boshqa tildagi ovoz to'g'ri o'qiydigan yozuvga o'giradi.
 * Telefonda o'zbekcha ovoz bo'lmaganda ishlatiladi: turk ovozi "Qo'ng'iroq"ni
 * "Kong'iroq" deb emas, "Konğırok" kabi buzib o'qimasligi uchun.
 */
object Talaffuz {

    private val APOSTROPHES = charArrayOf('\'', '`', '‘', '’', 'ʻ', 'ʼ')

    private fun unifyApostrophes(text: String): String {
        val sb = StringBuilder(text.length)
        for (c in text) sb.append(if (c in APOSTROPHES) '\'' else c)
        return sb.toString()
    }

    /** Turk ovozi uchun: sh→ş, ch→ç, q→k, x→h, j→c, o'→o, g'→ğ. */
    fun forTurkish(text: String): String {
        var s = unifyApostrophes(text)
        val pairs = listOf(
            "Sh" to "Ş", "SH" to "Ş", "sh" to "ş",
            "Ch" to "Ç", "CH" to "Ç", "ch" to "ç",
            "O'" to "O", "o'" to "o", "G'" to "Ğ", "g'" to "ğ",
            "Q" to "K", "q" to "k", "X" to "H", "x" to "h", "J" to "C", "j" to "c",
            "I" to "İ"
        )
        for ((a, b) in pairs) s = s.replace(a, b)
        // Qolgan tutuq belgisi ("ma'lum") — qisqa pauza o'rniga olib tashlanadi
        return s.replace("'", "")
    }

    private val CYR = listOf(
        "sh" to "ш", "ch" to "ч", "o'" to "о", "g'" to "г",
        "yo" to "ё", "yu" to "ю", "ya" to "я", "ye" to "е",
        "a" to "а", "b" to "б", "d" to "д", "e" to "е", "f" to "ф", "g" to "г", "h" to "х",
        "i" to "и", "j" to "ж", "k" to "к", "l" to "л", "m" to "м", "n" to "н", "o" to "о",
        "p" to "п", "q" to "к", "r" to "р", "s" to "с", "t" to "т", "u" to "у", "v" to "в",
        "x" to "х", "y" to "й", "z" to "з", "'" to ""
    )

    /** Rus ovozi uchun lotin → kirill: "Soat necha" → "Соат неча". */
    fun forRussian(text: String): String {
        val s = unifyApostrophes(text)
        val sb = StringBuilder()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            val lower = s.substring(i).lowercase()
            val hit = CYR.firstOrNull { (lat, _) -> lower.startsWith(lat) }
            if (hit == null || !(c.isLetter() || c == '\'')) {
                sb.append(c)
                i++
                continue
            }
            var cyr = hit.second
            // So'z boshidagi "e" — "э" ("ertaga" → "эртага")
            if (hit.first == "e" && (i == 0 || !s[i - 1].isLetter())) cyr = "э"
            if (c.isUpperCase() && cyr.isNotEmpty()) cyr = cyr.replaceFirstChar { it.uppercase() }
            sb.append(cyr)
            i += hit.first.length
        }
        return sb.toString()
    }

    /** Online ovoz uchun matnni ~[max] belgili bo'laklarga bo'ladi (gap/so'z chegarasida). */
    fun chunks(text: String, max: Int = 180): List<String> {
        val out = mutableListOf<String>()
        var cur = StringBuilder()
        for (word in text.trim().split(Regex("\\s+"))) {
            if (word.isEmpty()) continue
            if (cur.isNotEmpty() && cur.length + 1 + word.length > max) {
                out += cur.toString()
                cur = StringBuilder()
            }
            if (cur.isNotEmpty()) cur.append(' ')
            cur.append(word)
            if (cur.length >= max * 2 / 3 && (word.endsWith('.') || word.endsWith('?') || word.endsWith('!'))) {
                out += cur.toString()
                cur = StringBuilder()
            }
        }
        if (cur.isNotEmpty()) out += cur.toString()
        return out
    }
}
