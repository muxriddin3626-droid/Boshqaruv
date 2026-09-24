package uz.boshqaruv.ovoz

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telephony.TelephonyManager

/**
 * Fonda ishlaydigan xizmat:
 *  - telefon jiringlasa, kim qo'ng'iroq qilayotganini aytadi va "ko'tar" / "o'chir" buyrug'ini tinglaydi;
 *  - "doimiy tinglash" yoqilgan bo'lsa, "Yordamchi, ..." deb boshlangan buyruqlarni doim eshitib turadi.
 */
class AssistantService : Service(), VoiceAssistant.Listener {

    private val main = Handler(Looper.getMainLooper())
    private lateinit var assistant: VoiceAssistant
    private var callActive = false
    private var ringingNumber: String? = null
    private var manualListen = false

    private val continuous get() = Prefs.continuous(this)

    private val phoneReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            @Suppress("DEPRECATION")
            val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
            when (state) {
                TelephonyManager.EXTRA_STATE_RINGING -> {
                    if (number != null) ringingNumber = number
                    // Android bu xabarni ikki marta yuboradi (raqamli va raqamsiz) — biroz kutamiz
                    main.removeCallbacks(announce)
                    main.postDelayed(announce, 700)
                }
                TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                    main.removeCallbacks(announce)
                    callActive = true
                    assistant.stopListening()
                    assistant.onCallStateIdleOrOffhook()
                }
                TelephonyManager.EXTRA_STATE_IDLE -> {
                    main.removeCallbacks(announce)
                    callActive = false
                    ringingNumber = null
                    assistant.onCallStateIdleOrOffhook()
                    scheduleListen(1500)
                }
            }
        }
    }

    private val announce = Runnable {
        if (Prefs.callControl(this)) {
            assistant.stopListening()
            assistant.requireWakeWord = false
            assistant.onIncomingCall(ringingNumber)
        }
    }

    private val loop = Runnable {
        if (continuous && !callActive && !assistant.isBusy) {
            assistant.requireWakeWord = true
            assistant.listen()
        }
    }

    override fun onCreate() {
        super.onCreate()
        running = true
        assistant = VoiceAssistant(this, this)
        val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(phoneReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(phoneReceiver, filter)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Prefs.setCallControl(this, false)
                Prefs.setContinuous(this, false)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_LISTEN -> {
                startInForeground()
                manualListen = true
                assistant.requireWakeWord = false
                assistant.listen()
                return START_STICKY
            }
        }
        startInForeground()
        scheduleListen(800)
        return START_STICKY
    }

    private fun startInForeground() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    private fun scheduleListen(delay: Long) {
        main.removeCallbacks(loop)
        if (continuous) main.postDelayed(loop, delay)
    }

    // --- VoiceAssistant.Listener ---

    override fun onIdle() {
        manualListen = false
        scheduleListen(400)
    }

    override fun onStatus(text: String) = updateNotification(text)
    override fun onReply(text: String) = updateNotification(text)

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(text))
    }

    private fun buildNotification(text: String? = null): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Ovozli yordamchi", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), flags)
        val listen = PendingIntent.getService(
            this, 1, Intent(this, AssistantService::class.java).setAction(ACTION_LISTEN), flags
        )
        val stop = PendingIntent.getService(
            this, 2, Intent(this, AssistantService::class.java).setAction(ACTION_STOP), flags
        )
        val body = text ?: if (continuous) "\"Yordamchi, ...\" deb gapiring" else "Qo'ng'iroqlarni ovoz bilan boshqarish yoqilgan"
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Ovozli yordamchi")
            .setContentText(body)
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "Gapirish", listen).build())
            .addAction(Notification.Action.Builder(null, "To'xtatish", stop).build())
            .build()
    }

    override fun onDestroy() {
        running = false
        main.removeCallbacksAndMessages(null)
        unregisterReceiver(phoneReceiver)
        assistant.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_LISTEN = "uz.boshqaruv.ovoz.LISTEN"
        const val ACTION_STOP = "uz.boshqaruv.ovoz.STOP"
        private const val CHANNEL = "yordamchi"
        private const val NOTIF_ID = 7

        @Volatile
        var running = false
            private set
    }
}
