package uz.boshqaruv.ovoz

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract

data class Contact(val name: String, val number: String)

/** Kontaktlar ichidan ovozda aytilgan ismga eng yaqinini topadi ("Aliga" → "Ali Valiyev"). */
class ContactFinder(private val context: Context) {

    fun find(target: String): Contact? {
        val digits = target.filter { it.isDigit() || it == '+' }
        if (digits.count(Char::isDigit) >= 3) return Contact(digits, digits)
        if (context.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null

        val queries = variants(CommandParser.normalize(target)).map(CommandParser::phonetic)
        var best: Contact? = null
        var bestScore = 0.0
        val cursor = context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            ),
            null, null, null
        ) ?: return null
        cursor.use { c ->
            while (c.moveToNext()) {
                val name = c.getString(0) ?: continue
                val number = c.getString(1) ?: continue
                val norm = CommandParser.phonetic(CommandParser.normalize(name))
                val score = queries.maxOf { q -> score(q, norm) }
                if (score > bestScore) {
                    bestScore = score
                    best = Contact(name, number)
                }
            }
        }
        return if (bestScore >= 55) best else null
    }

    /** Raqam bo'yicha kontakt nomini topadi (kiruvchi qo'ng'iroqni e'lon qilish uchun). */
    fun nameFor(number: String?): String? {
        if (number.isNullOrBlank()) return null
        if (context.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
        return context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
            ?.use { if (it.moveToFirst()) it.getString(0) else null }
    }

    companion object {
        /** "akamga" → ["akamga", "akam", "aka"]: kelishik va egalik qo'shimchalarsiz variantlar. */
        fun variants(q: String): List<String> {
            val out = linkedSetOf(q)
            val words = q.split(' ').filter { it.isNotEmpty() }
            if (words.isEmpty()) return out.toList()
            val last = CommandParser.stripDative(words.last())
            val base = (words.dropLast(1) + last).joinToString(" ")
            out += base
            // egalik: "akam" → "aka", "opam" → "opa", "dadam" → "dada", "ukamga" → "uka"
            if (last.length > 3 && last.endsWith("im")) out += (words.dropLast(1) + last.dropLast(2)).joinToString(" ")
            if (last.length > 3 && last.endsWith("m")) out += (words.dropLast(1) + last.dropLast(1)).joinToString(" ")
            // ruscha: "mame" → "mam" ("Mama" bilan boshlanishi mos keladi)
            if (last.length > 3 && (last.endsWith("e") || last.endsWith("u"))) out += (words.dropLast(1) + last.dropLast(1)).joinToString(" ")
            return out.toList()
        }

        fun score(q: String, name: String): Double {
            if (q.isEmpty() || name.isEmpty()) return 0.0
            if (q == name) return 100.0
            val tokens = name.split(' ').filter { it.isNotEmpty() }
            if (tokens.any { it == q }) return 92.0
            if (name.startsWith(q) && q.length >= 3) return 82.0
            if (tokens.any { it.startsWith(q) } && q.length >= 3) return 78.0
            if (q.contains(name) && name.length >= 3) return 70.0
            val ratio = maxOf(similarity(q, name), tokens.maxOfOrNull { similarity(q, it) } ?: 0.0)
            return if (ratio >= 0.7) 75.0 * ratio else 0.0
        }

        fun similarity(a: String, b: String): Double {
            val d = levenshtein(a, b)
            return 1.0 - d.toDouble() / maxOf(a.length, b.length)
        }

        private fun levenshtein(a: String, b: String) = CommandParser.levenshtein(a, b)
    }
}
