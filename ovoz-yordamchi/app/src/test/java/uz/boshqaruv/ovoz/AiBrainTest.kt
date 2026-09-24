package uz.boshqaruv.ovoz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AiBrainTest {

    @Test fun qongiroq() {
        val r = AiBrain.parse("""{"action":"call","target":"Ali","text":null,"query":null,"hour":null,"minute":null,"seconds":null,"reply":"Aliga qoʻngʻiroq qilyapman"}""")!!
        assertEquals(Command.Call("Ali"), r.command)
    }

    @Test fun smsVaSuhbat() {
        assertEquals(
            Command.Sms("onam", "Uyga kechroq boraman"),
            AiBrain.parse("""{"action":"sms","target":"onam","text":"Uyga kechroq boraman","reply":"Yuboraymi?"}""")!!.command
        )
        val chat = AiBrain.parse("```json\n{\"action\":\"chat\",\"reply\":\"Toshkent Oʻzbekiston poytaxti.\"}\n```")!!
        assertNull(chat.command)
        assertEquals("Toshkent Oʻzbekiston poytaxti.", chat.reply)
    }

    @Test fun budilnikVaFonar() {
        assertEquals(Command.Alarm(19, 30), AiBrain.parse("""{"action":"alarm","hour":19,"minute":30,"reply":"ok"}""")!!.command)
        assertEquals(Command.FlashOn, AiBrain.parse("""{"action":"flash_on","reply":"Fonar yoqildi"}""")!!.command)
    }

    @Test fun notogriJavob() {
        assertNull(AiBrain.parse("salom"))
        assertNull(AiBrain.parse("{buzilgan"))
    }

    @Test fun geminiJavobi() {
        val json = org.json.JSONObject(
            """{"candidates":[{"content":{"role":"model","parts":[
                {"text":"o'ylash","thought":true},
                {"text":"{\"action\":\"music\",\"query\":\"Shahzoda\",\"reply\":\"Qo'yyapman\"}"}
            ]}}]}"""
        )
        val text = AiBrain.geminiText(json)!!
        assertEquals(Command.Music("Shahzoda"), AiBrain.parse(text)!!.command)
        assertNull(AiBrain.geminiText(org.json.JSONObject("{}")))
    }

    @Test fun geminiXatosi() {
        assertEquals("API key not valid. Please pass a valid API key.",
            AiBrain.geminiError("""{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}"""))
        assertEquals("oddiy matn", AiBrain.geminiError("oddiy matn"))
    }
}
