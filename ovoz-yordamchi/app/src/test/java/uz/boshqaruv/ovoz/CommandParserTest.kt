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

    @Test fun musiqa() {
        assertEquals(Command.Music(null), p("muzika qo'y"))
        assertEquals(Command.Music(null), p("Musiqa qo'y"))
        assertEquals(Command.Music(null), p("музыку включи"))
        assertEquals(Command.Music("shahzoda"), p("Shahzodaning qo'shig'ini qo'y"))
        assertEquals(Command.MusicPause, p("musiqani to'xtat"))
        assertEquals(Command.MusicPause, p("muzikani o'chir"))
        assertEquals(Command.MusicNext, p("keyingi qo'shiq"))
        assertEquals(Command.MusicNext, p("keyingisi"))
        assertEquals(Command.MusicPrev, p("oldingi qo'shiqni qo'y"))
        assertEquals(Command.VolumeUp, p("ovozni baland qil"))
        assertEquals(Command.VolumeUp, p("ovozni ko'tar"))
        assertEquals(Command.VolumeDown, p("ovozni pasaytir"))
        assertEquals(Command.YouTube("shahzoda"), p("YouTubedan Shahzoda qo'shiqlarini och"))
    }

    @Test fun xatoTanilsaHam() {
        // ovoz tanish xizmati harflarni biroz boshqacha yozsa ham
        assertEquals(Command.Call("aliga"), p("aliga kongirok qil"))
        assertEquals(Command.Call("aliga"), p("aliga qo'ng'iroq qi"))
        assertEquals(Command.Call("ali"), p("позвони Али"))
        assertEquals(Command.Answer, p("ko'tar"))
        assertEquals(Command.MusicPause, p("musiqani toxtat"))
    }

    @Test fun budilnikVaTaymer() {
        assertEquals(Command.Alarm(7, 0), p("soat 7 ga budilnik qo'y"))
        assertEquals(Command.Alarm(6, 30), p("ertalab 6:30 da uyg'ot"))
        assertEquals(Command.Alarm(7, 0), p("yettiga budilnik qo'y"))
        assertEquals(Command.Alarm(null, 0), p("budilnikni och"))
        assertEquals(Command.Timer(300), p("5 daqiqaga taymer qo'y"))
        assertEquals(Command.Timer(900), p("o'n besh minutga taymer"))
    }

    @Test fun boshqaBuyruqlar() {
        assertEquals(Command.Battery, p("batareya necha foiz"))
        assertEquals(Command.Camera, p("kamerani och"))
        assertEquals(Command.Wifi, p("wifi ni yoq"))
        assertEquals(Command.Navigate("chorsu"), p("Chorsuga yo'l ko'rsat"))
        assertEquals(Command.Search("ob havo"), p("ob havo ni qidir"))
        assertEquals(Command.OpenApp("telegram"), p("telegramni ochib ber"))
        assertEquals(Command.HangUp, p("qo'y"))
    }
}
