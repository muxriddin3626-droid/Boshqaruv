package uz.tozaekran

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class AdminReceiver : DeviceAdminReceiver() {
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
        "Toza Ekran himoyasini o'chirsangiz, 18+ kontent endi bloklanmaydi."
}
