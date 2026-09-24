package uz.boshqaruv.ovoz

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
        val q = CommandParser.normalize(spoken)
        val best = pm.queryIntentActivities(launcher, 0)
            .map { it to CommandParser.normalize(it.loadLabel(pm).toString()) }
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
}
