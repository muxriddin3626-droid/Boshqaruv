package uz.boshqaruv.ovoz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TalaffuzTest {

    @Test fun turkcha() {
        assertEquals("Aliga kong'irok kilyapman", Talaffuz.forTurkish("Aliga qo'ng'iroq qilyapman").replace("ğ", "g'"))
        assertEquals("Şahzoda çiroyli", Talaffuz.forTurkish("Shahzoda chiroyli"))
        assertEquals("Hop, yuborildi", Talaffuz.forTurkish("Xop, yuborildi"))
    }

    @Test fun ruscha() {
        assertEquals("Соат неча", Talaffuz.forRussian("Soat necha"))
        assertEquals("Шахзода", Talaffuz.forRussian("Shahzoda"))
        assertEquals("эртага ёзинг", Talaffuz.forRussian("ertaga yozing"))
    }

    @Test fun bolaklar() {
        val long = List(60) { "so'z" }.joinToString(" ")
        val parts = Talaffuz.chunks(long, 50)
        assertTrue(parts.all { it.length <= 50 })
        assertEquals(long, parts.joinToString(" "))
    }
}
