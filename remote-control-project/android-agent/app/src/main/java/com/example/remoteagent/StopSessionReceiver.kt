package com.example.remoteagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Foydalanuvchi bildirishnomadagi "To'xtatish" tugmasini bosganda
 * seansni DARHOL yakunlaydi. Bu foydalanuvchining istalgan vaqtda
 * nazoratni to'xtatish huquqini kafolatlaydi.
 */
class StopSessionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        context.stopService(Intent(context, ScreenCaptureService::class.java))
    }
}
