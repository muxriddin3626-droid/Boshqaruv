package uz.boshqaruv.maxfiyekran;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.RadioGroup;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;

public class MainActivity extends Activity {
    static final String EXTRA_AUTO_START = "auto_start";

    private TextView permText;
    private Button permButton;
    private Switch toggle;
    private TextView strengthLabel;
    private boolean updatingUi;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        permText = findViewById(R.id.permText);
        permButton = findViewById(R.id.permButton);
        toggle = findViewById(R.id.toggle);
        strengthLabel = findViewById(R.id.strengthLabel);
        SeekBar strength = findViewById(R.id.strength);
        RadioGroup patternGroup = findViewById(R.id.patternGroup);

        permButton.setOnClickListener(v -> startActivity(new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName()))));

        toggle.setOnCheckedChangeListener((b, checked) -> {
            if (updatingUi) return;
            if (checked) {
                if (!Settings.canDrawOverlays(this)) {
                    permButton.performClick();
                    setToggle(false);
                    return;
                }
                PrivacyOverlayService.start(this);
            } else {
                PrivacyOverlayService.stop(this);
            }
        });

        strength.setProgress(Prefs.strength(this));
        updateStrengthLabel(Prefs.strength(this));
        strength.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar s, int value, boolean fromUser) {
                if (!fromUser) return;
                Prefs.setStrength(MainActivity.this, value);
                updateStrengthLabel(value);
                PrivacyOverlayService.update(MainActivity.this);
            }

            @Override public void onStartTrackingTouch(SeekBar s) {}
            @Override public void onStopTrackingTouch(SeekBar s) {}
        });

        patternGroup.check(radioIdFor(Prefs.pattern(this)));
        patternGroup.setOnCheckedChangeListener((g, id) -> {
            Prefs.setPattern(this, patternFor(id));
            PrivacyOverlayService.update(this);
        });

        findViewById(R.id.displayButton).setOnClickListener(v -> openDisplaySettings());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 1);
        }

        if (getIntent().getBooleanExtra(EXTRA_AUTO_START, false)
                && Settings.canDrawOverlays(this)) {
            PrivacyOverlayService.start(this);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        boolean granted = Settings.canDrawOverlays(this);
        permText.setText(granted ? R.string.perm_ok : R.string.perm_needed);
        permButton.setEnabled(!granted);
        toggle.setEnabled(granted);
        setToggle(PrivacyOverlayService.isRunning());
    }

    private void setToggle(boolean on) {
        updatingUi = true;
        toggle.setChecked(on);
        updatingUi = false;
    }

    private void updateStrengthLabel(int value) {
        strengthLabel.setText(getString(R.string.strength) + ": " + value + "%");
    }

    private void openDisplaySettings() {
        try {
            startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS));
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    private static int radioIdFor(int pattern) {
        switch (pattern) {
            case Prefs.PATTERN_GRID: return R.id.patternGrid;
            case Prefs.PATTERN_EDGES: return R.id.patternEdges;
            case Prefs.PATTERN_DIM: return R.id.patternDim;
            default: return R.id.patternLines;
        }
    }

    private static int patternFor(int radioId) {
        if (radioId == R.id.patternGrid) return Prefs.PATTERN_GRID;
        if (radioId == R.id.patternEdges) return Prefs.PATTERN_EDGES;
        if (radioId == R.id.patternDim) return Prefs.PATTERN_DIM;
        return Prefs.PATTERN_LINES;
    }
}
