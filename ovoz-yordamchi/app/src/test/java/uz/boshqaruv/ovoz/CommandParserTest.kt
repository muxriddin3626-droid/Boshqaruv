package uz.boshqaruv.ovoz

import org.junit.Assert.assertEquals
import org.junit.Test

class CommandParserTest {

    private fun p(s: String, yesNo: Boolean = false) = CommandParser.parse(s, yesNo)

    @Test fun qongiroq() {
        assertEquals(Command.Call("aliga"), p("Aliga qo'ng'iroq qil"))
        assertEquals(Command.Call("akamga"), p("akamga tel qil"))
        assertEquals(Command.Call("onamga"), p("Onamga telefon qilib ber"))
        assertEquals(Command.Call("aliga"), p("qo'ng'iroq qil Aliga"))
        assertEquals(Command.Call("901234567"), p("90 123 45 67 ga qo'ng'iroq qil"))
        assertEquals(Command.Call("dadamga"), p("Дадамга қўнғироқ қил"))
    }

    @Test fun sms() {
        assertEquals(Command.Sms("aliga", "salom qalaysan"), p("Aliga sms yoz salom qalaysan"))
        assertEquals(Command.Sms("aliga", "uyga kel"), p("Aliga uyga kel deb sms yoz"))
        assertEquals(Command.Sms("onamga", null), p("onamga xabar yubor"))
        assertEquals(Command.Sms("akamga", "Ertaga boraman"), p("sms yoz akamga Ertaga boraman"))
        assertEquals(Command.Sms("aliga", "kechikaman"), p("Aliga yozib yubor kechikaman"))
    }

    @Test fun kotarish() {
        assertEquals(Command.Answer, p("telimni ko'tar"))
        assertEquals(Command.Answer, p("javob ber"))
        assertEquals(Command.HangUp, p("o'chir"))
        assertEquals(Command.HangUp, p("rad et"))
        assertEquals(Command.HangUp, p("qo'ng'iroqni o'chir"))
    }

    @Test fun boshqa() {
        assertEquals(Command.FlashOn, p("fonarni yoq"))
        assertEquals(Command.FlashOff, p("fonarni o'chir"))
        assertEquals(Command.Time, p("soat necha bo'ldi"))
        assertEquals(Command.OpenApp("telegram"), p("telegramni och"))
        assertEquals(Command.Yes, p("ha yubor", true))
        assertEquals(Command.No, p("yo'q kerak emas", true))
    }

    @Test fun kelishik() {
        assertEquals("ali", CommandParser.stripDative("aliga"))
        assertEquals("akam", CommandParser.stripDative("akamga"))
    }
}
