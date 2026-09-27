package uz.boshqaruv.maxfiyekran;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;

/**
 * Ekran ustida chiziladigan filtr. Umumiy shaffoflikni oyna (window) alpha'si
 * boshqaradi, bu yerda faqat naqsh chiziladi.
 */
final class PrivacyView extends View {
    private final Paint paint = new Paint();
    private final Paint gradientPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private int pattern = Prefs.PATTERN_LINES;

    PrivacyView(Context context) {
        super(context);
        paint.setColor(Color.BLACK);
        paint.setStyle(Paint.Style.FILL);
    }

    void setPattern(int pattern) {
        this.pattern = pattern;
        invalidate();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        float radius = (float) Math.hypot(w, h) / 2f;
        gradientPaint.setShader(new RadialGradient(w / 2f, h / 2f, radius,
                new int[] {0x33000000, 0x66000000, Color.BLACK},
                new float[] {0f, 0.45f, 1f},
                Shader.TileMode.CLAMP));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        int w = getWidth();
        int h = getHeight();
        switch (pattern) {
            case Prefs.PATTERN_DIM:
                canvas.drawColor(Color.BLACK);
                break;
            case Prefs.PATTERN_EDGES:
                canvas.drawRect(0, 0, w, h, gradientPaint);
                break;
            case Prefs.PATTERN_GRID:
                canvas.drawColor(0x80000000);
                for (int y = 0; y < h; y += 3) {
                    canvas.drawRect(0, y, w, y + 1, paint);
                }
                for (int x = 0; x < w; x += 3) {
                    canvas.drawRect(x, 0, x + 1, h, paint);
                }
                break;
            case Prefs.PATTERN_LINES:
            default:
                // Mayda gorizontal chiziqlar — "jalyuzi" plyonkasiga o'xshash:
                // yaqindan ko'z ularni birlashtiradi, qiya burchakdan matn yo'qoladi.
                canvas.drawColor(0x80000000);
                for (int y = 0; y < h; y += 3) {
                    canvas.drawRect(0, y, w, y + 2, paint);
                }
                break;
        }
    }
}
