package uz.boshqaruv.ovoz

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.app.SearchManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.os.Build
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Bundle
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.view.KeyEvent
import android.telecom.TelecomManager
import android.telephony.SmsManager

/** Telefonning o'zida bajariladigan amallar: qo'ng'iroq, SMS, ko'tarish, fonar, ilova ochish. */
class PhoneActions(private val context: Context) {

    private val telecom = context.getSystemService(TelecomManager::class.java)

    private fun has(permission: String) =
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun call(number: String): Boolean {
        if (!has(Manifest.permission.CALL_PHONE)) return false
        val uri = Uri.fromParts("tel", number, null)
        return try {
            telecom.placeCall(uri, Bundle())
            true
        } catch (e: Exception) {
            try {
                context.startActivity(Intent(Intent.ACTION_CALL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (e2: Exception) {
                false
            }
        }
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    fun answer(): Boolean {
        if (!has(Manifest.permission.ANSWER_PHONE_CALLS)) return false
        return try {
            telecom.acceptRingingCall()
            true
        } catch (e: Exception) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    fun hangUp(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || !has(Manifest.permission.ANSWER_PHONE_CALLS)) return false
        return try {
            telecom.endCall()
        } catch (e: Exception) {
            false
        }
    }

    @SuppressLint("MissingPermission")
    fun isInCall(): Boolean =
        has(Manifest.permission.READ_PHONE_STATE) && try { telecom.isInCall } catch (e: Exception) { false }

    fun sendSms(number: String, text: String): Boolean {
        if (!has(Manifest.permission.SEND_SMS)) return false
        return try {
            val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION") SmsManager.getDefault()
            }
            val parts = sms.divideMessage(text)
            if (parts.size > 1) sms.sendMultipartTextMessage(number, null, parts, null, null)
            else sms.sendTextMessage(number, null, text, null, null)
            true
        } catch (e: Exception) {
            false
        }
    }

    fun torch(on: Boolean): Boolean {
        val cm = context.getSystemService(CameraManager::class.java)
        return try {
            val id = cm.cameraIdList.firstOrNull {
                cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: return false
            cm.setTorchMode(id, on)
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Ilovani nomi bo'yicha ochadi. Topilgan ilova nomini qaytaradi. */
    fun openApp(spoken: String): String? {
        val pm = context.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val q = CommandParser.phonetic(CommandParser.normalize(spoken))
        val best = pm.queryIntentActivities(launcher, 0)
            .map { it to CommandParser.phonetic(CommandParser.normalize(it.loadLabel(pm).toString())) }
            .maxByOrNull { (_, label) -> ContactFinder.score(q, label) }
            ?.takeIf { (_, label) -> ContactFinder.score(q, label) >= 55 }
            ?: return null
        val info = best.first.activityInfo
        return try {
            context.startActivity(
                Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                    .setClassName(info.packageName, info.name)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            best.first.loadLabel(pm).toString()
        } catch (e: Exception) {
            null
        }
    }

    // ---------------- Musiqa va ovoz balandligi ----------------

    private val audio = context.getSystemService(AudioManager::class.java)

    val isMusicPlaying: Boolean get() = audio.isMusicActive

    private fun mediaKey(code: Int) {
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }

    fun musicResume() = mediaKey(KeyEvent.KEYCODE_MEDIA_PLAY)
    fun musicPause() = mediaKey(KeyEvent.KEYCODE_MEDIA_PAUSE)
    fun musicNext() = mediaKey(KeyEvent.KEYCODE_MEDIA_NEXT)
    fun musicPrev() = mediaKey(KeyEvent.KEYCODE_MEDIA_PREVIOUS)

    /** Qo'shiqni nomi/qo'shiqchisi bo'yicha qo'yadi (YouTube Music, Spotify va h.k. orqali). */
    fun playFromSearch(query: String): Boolean {
        val intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH)
            .putExtra(SearchManager.QUERY, query)
            .putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*")
        return start(intent) || youtube(query)
    }

    /** Musiqa ilovasini ochadi (hech narsa ijro etilmayotgan bo'lsa). */
    fun openMusicApp(): Boolean =
        start(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC)) ||
            playFromSearch("musiqa")

    fun volume(direction: Int) {
        repeat(if (direction == AudioManager.ADJUST_MUTE) 1 else 3) {
            audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI)
        }
    }

    // ---------------- Boshqa amallar ----------------

    fun alarm(hour: Int?, minute: Int): Boolean {
        if (hour == null) return start(Intent(AlarmClock.ACTION_SHOW_ALARMS))
        return start(
            Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, hour)
                .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        )
    }

    fun timer(seconds: Int): Boolean = start(
        Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
    )

    fun search(query: String): Boolean =
        start(Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, query)) ||
            start(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(query))))

    fun youtube(query: String?): Boolean {
        val uri = if (query.isNullOrBlank()) Uri.parse("https://www.youtube.com")
        else Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query))
        return start(Intent(Intent.ACTION_VIEW, uri))
    }

    fun navigate(place: String): Boolean {
        if (place.isBlank()) return start(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0")))
        return start(Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + Uri.encode(place)))) ||
            start(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(place))))
    }

    fun camera(): Boolean = start(Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA))

    fun batteryPercent(): Int =
        context.getSystemService(BatteryManager::class.java).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

    fun wifiSettings(): Boolean =
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && start(Intent(Settings.Panel.ACTION_WIFI))) ||
            start(Intent(Settings.ACTION_WIFI_SETTINGS))

    fun bluetoothSettings(): Boolean = start(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))

    private fun start(intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: Exception) {
        false
    }
}
