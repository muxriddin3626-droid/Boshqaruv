package uz.boshqaruv.ovoz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ContactFinderTest {

    @Test fun variantlar() {
        assertEquals(listOf("akamga", "akam", "aka"), ContactFinder.variants("akamga"))
        assertTrue("ali" in ContactFinder.variants("aliga"))
    }

    @Test fun moslik() {
        val q = ContactFinder.variants("aliga")
        val ali = q.maxOf { ContactFinder.score(it, "ali valiyev") }
        val vali = q.maxOf { ContactFinder.score(it, "vali") }
        assertTrue(ali > vali)
        assertTrue(ali >= 55)
        // kirillda saqlangan kontakt
        assertTrue(q.maxOf { ContactFinder.score(it, CommandParser.normalize("Али")) } >= 90)
    }

    @Test fun chaqiruvSozi() {
        assertEquals("Aliga qo'ng'iroq qil", VoiceAssistant.stripWakeWord("Yordamchi Aliga qo'ng'iroq qil"))
        assertEquals("", VoiceAssistant.stripWakeWord("yordamchi"))
        assertNull(VoiceAssistant.stripWakeWord("Aliga qo'ng'iroq qil"))
    }
}
