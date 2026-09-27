package uz.boshqaruv.maxfiyekran;

import android.content.Context;
import android.content.SharedPreferences;

/** Sozlamalarni saqlash. */
final class Prefs {
    static final int PATTERN_LINES = 0;
    static final int PATTERN_GRID = 1;
    static final int PATTERN_EDGES = 2;
    static final int PATTERN_DIM = 3;

    /** Android 12+ da 80% dan yuqori qoplama ostidagi bosishlarni bloklaydi. */
    static final int MAX_STRENGTH = 80;

    private static final String NAME = "maxfiy_ekran";
    private static final String KEY_STRENGTH = "strength";
    private static final String KEY_PATTERN = "pattern";

    private Prefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static int strength(Context c) {
        return Math.min(MAX_STRENGTH, sp(c).getInt(KEY_STRENGTH, 60));
    }

    static void setStrength(Context c, int value) {
        sp(c).edit().putInt(KEY_STRENGTH, Math.max(0, Math.min(MAX_STRENGTH, value))).apply();
    }

    static int pattern(Context c) {
        return sp(c).getInt(KEY_PATTERN, PATTERN_LINES);
    }

    static void setPattern(Context c, int value) {
        sp(c).edit().putInt(KEY_PATTERN, value).apply();
    }
}
