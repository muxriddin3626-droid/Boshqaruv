package uz.boshqaruv.maxfiyekran;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.hardware.input.InputManager;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.service.quicksettings.TileService;
import android.view.WindowManager;

/** Ekran ustida doimiy filtr oynasini ushlab turuvchi foreground servis. */
public class PrivacyOverlayService extends Service {
    static final String ACTION_START = "uz.boshqaruv.maxfiyekran.START";
    static final String ACTION_STOP = "uz.boshqaruv.maxfiyekran.STOP";
    static final String ACTION_UPDATE = "uz.boshqaruv.maxfiyekran.UPDATE";

    private static final String CHANNEL_ID = "privacy_filter";
    private static final int NOTIFICATION_ID = 1;

    private static volatile boolean running;

    private WindowManager windowManager;
    private PrivacyView overlay;
    private WindowManager.LayoutParams params;

    static boolean isRunning() {
        return running;
    }

    static void start(Context c) {
        Intent i = new Intent(c, PrivacyOverlayService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            c.startForegroundService(i);
        } else {
            c.startService(i);
        }
    }

    static void stop(Context c) {
        c.startService(new Intent(c, PrivacyOverlayService.class).setAction(ACTION_STOP));
    }

    /** Sozlamalar o'zgarganda (servis ishlayotgan bo'lsa) qayta chizish. */
    static void update(Context c) {
        if (running) {
            c.startService(new Intent(c, PrivacyOverlayService.class).setAction(ACTION_UPDATE));
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_UPDATE.equals(action) && overlay != null) {
            applySettings();
            return START_STICKY;
        }

        startInForeground();
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (overlay == null) {
            addOverlay();
        } else {
            applySettings();
        }
        running = true;
        refreshTile();
        return START_STICKY;
    }

    private void addOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        overlay = new PrivacyView(this);

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        params.setTitle("MaxfiyEkranFilter");
        params.alpha = windowAlpha();
        overlay.setPattern(Prefs.pattern(this));
        windowManager.addView(overlay, params);
    }

    private void applySettings() {
        overlay.setPattern(Prefs.pattern(this));
        params.alpha = windowAlpha();
        windowManager.updateViewLayout(overlay, params);
    }

    /**
     * Oyna shaffofligi. Android 12+ da bosishlar qoplama orqali o'tishi uchun
     * u tizim chegarasidan (odatda 0.8) oshmasligi shart.
     */
    private float windowAlpha() {
        float alpha = Prefs.strength(this) / 100f;
        float max = Prefs.MAX_STRENGTH / 100f;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            InputManager im = (InputManager) getSystemService(INPUT_SERVICE);
            max = Math.min(max, im.getMaximumObscuringOpacityForTouch());
        }
        return Math.min(alpha, max);
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }

        int piFlags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent openApp = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), piFlags);
        PendingIntent stopIntent = PendingIntent.getService(this, 1,
                new Intent(this, PrivacyOverlayService.class).setAction(ACTION_STOP), piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = b
                .setSmallIcon(R.drawable.ic_shield)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(getString(R.string.notif_text))
                .setContentIntent(openApp)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null,
                        getString(R.string.notif_off), stopIntent).build())
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void refreshTile() {
        TileService.requestListeningState(this,
                new android.content.ComponentName(this, PrivacyTileService.class));
    }

    @Override
    public void onDestroy() {
        running = false;
        if (overlay != null && windowManager != null) {
            windowManager.removeView(overlay);
            overlay = null;
        }
        refreshTile();
        super.onDestroy();
    }
}
