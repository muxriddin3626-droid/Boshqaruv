package uz.boshqaruv.maxfiyekran;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Tezkor sozlamalar panelidagi "Maxfiy ekran" tugmasi. */
public class PrivacyTileService extends TileService {

    @Override
    public void onStartListening() {
        updateTile(PrivacyOverlayService.isRunning());
    }

    @Override
    public void onClick() {
        if (PrivacyOverlayService.isRunning()) {
            PrivacyOverlayService.stop(this);
            updateTile(false);
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            openApp();
            return;
        }
        try {
            PrivacyOverlayService.start(this);
            updateTile(true);
        } catch (RuntimeException e) {
            // Ba'zi Android versiyalari fonda servis ishga tushirishni cheklaydi —
            // unda ilovani ochib, u yerdan yoqamiz.
            openApp();
        }
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(MainActivity.EXTRA_AUTO_START, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        } else {
            startActivityAndCollapse(intent);
        }
    }

    private void updateTile(boolean active) {
        Tile tile = getQsTile();
        if (tile == null) return;
        tile.setState(active ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        tile.updateTile();
    }
}
