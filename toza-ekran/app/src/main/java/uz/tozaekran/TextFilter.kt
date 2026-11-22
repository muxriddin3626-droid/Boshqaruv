package uz.tozaekran

import java.util.regex.Pattern

/**
 * Ekrandagi matnda (sayt manzili, kanal nomi, qidiruv so'rovi) 18+ belgilarni qidiradi.
 *
 * "stem" — so'z boshi bilan mos kelsa yetarli (porno -> pornografiya ham).
 * "word" — faqat alohida so'z sifatida (sex -> "Essex" ga tegmaydi).
 */
object TextFilter {

    /** Doim bloklanadigan saytlar (har qanday sezgirlikda). */
    private val SITES = listOf(
        "pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn", "onlyfans",
        "brazzers", "chaturbate", "stripchat", "spankbang", "eporner", "rule34",
        "nhentai", "hentaihaven", "bongacams", "livejasmin", "porntrex", "hqporner",
        "motherless", "fapello", "thothub", "camsoda", "myfreecams", "tnaflix",
        "beeg.com", "txxx.com", "erome.com", "sex.com", "porn.com", "fansly",
    )

    /** O'rta sezgirlik: aniq 18+ so'zlar. */
    private val STRONG_STEMS = listOf(
        "porn", "порн", "hentai", "хентай", "🔞", "sikish", "сикиш", "секс видео",
        "seks video", "sex video", "xxx", "nsfw", "nudes", "голые девушки", "эротическ",
        "проститут", "fohisha", "фохиша", "шлюх", "milf", "blowjob", "минет",
    )

    /** Yuqori sezgirlik: kengroq so'zlar (ba'zan ortiqcha bloklashi mumkin). */
    private val BROAD_WORDS = listOf(
        "sex", "seks", "секс", "sexy", "сексуальн", "18+", "эротика", "erotic", "erotika",
        "nude", "naked", "голая", "голые", "интим", "intim", "yalang'och", "яланғоч",
        "bikini", "бикини", "lingerie", "белье", "stripper", "стриптиз", "striptiz",
    )

    private const val B = "(?<![\\p{L}\\p{N}])" // so'z boshi chegarasi
    private const val E = "(?![\\p{L}\\p{N}])"   // so'z oxiri chegarasi

    @Volatile private var cacheKey: String? = null
    @Volatile private var cachePattern: Pattern? = null

    private fun pattern(sensitivity: Int, custom: String): Pattern {
        val key = "$sensitivity|$custom"
        cachePattern?.let { if (cacheKey == key) return it }

        val parts = ArrayList<String>()
        SITES.forEach { parts += B + Pattern.quote(it) }
        if (sensitivity >= 1) STRONG_STEMS.forEach { parts += B + Pattern.quote(it) }
        if (sensitivity >= 2) BROAD_WORDS.forEach { parts += B + Pattern.quote(it) + E }
        custom.split(',', '\n', ';')
            .map { it.trim() }
            .filter { it.length >= 2 }
            .forEach { parts += B + Pattern.quote(it) }

        val p = Pattern.compile(
            parts.joinToString("|"),
            Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
        )
        cacheKey = key
        cachePattern = p
        return p
    }

    /** Topilgan so'zni qaytaradi yoki null. */
    fun find(text: CharSequence, sensitivity: Int, custom: String): String? {
        if (text.isEmpty()) return null
        val m = pattern(sensitivity, custom).matcher(text)
        return if (m.find()) m.group() else null
    }
}
