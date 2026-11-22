package uz.tozaekran

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

/**
 * Telefonning o'zida ishlaydigan AI model (MobileNetV2, 224x224).
 * Sinflar: drawings, hentai, neutral, porn, sexy.
 * Rasm hech qayerga yuborilmaydi.
 */
class NsfwClassifier(context: Context) : AutoCloseable {

    data class Result(val porn: Float, val hentai: Float, val sexy: Float) {
        val unsafe: Float get() = porn + hentai
    }

    private val interpreter: Interpreter
    private val input: ByteBuffer =
        ByteBuffer.allocateDirect(SIZE * SIZE * 3 * 4).order(ByteOrder.nativeOrder())
    private val output = Array(1) { FloatArray(5) }
    private val pixels = IntArray(SIZE * SIZE)

    init {
        val options = Interpreter.Options().setNumThreads(2)
        interpreter = Interpreter(loadModel(context), options)
    }

    private fun loadModel(context: Context): MappedByteBuffer {
        val fd = context.assets.openFd("nsfw.tflite")
        FileInputStream(fd.fileDescriptor).use { stream ->
            return stream.channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
        }
    }

    @Synchronized
    fun classify(bitmap: Bitmap): Result {
        val scaled = Bitmap.createScaledBitmap(bitmap, SIZE, SIZE, true)
        scaled.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE)
        if (scaled !== bitmap) scaled.recycle()

        input.rewind()
        for (p in pixels) {
            input.putFloat(((p shr 16) and 0xFF) / 255f)
            input.putFloat(((p shr 8) and 0xFF) / 255f)
            input.putFloat((p and 0xFF) / 255f)
        }
        input.rewind()
        interpreter.run(input, output)
        val o = output[0]
        return Result(porn = o[3], hentai = o[1], sexy = o[4])
    }

    /**
     * Ekran rasmini bir nechta bo'lakka bo'lib tekshiradi (butun ekran + yuqori/pastki yarmi),
     * chunki kichik rasm butun ekranda sezilmay qolishi mumkin.
     */
    fun isUnsafe(screen: Bitmap, sensitivity: Int): Boolean {
        val w = screen.width
        val h = screen.height
        val crops = ArrayList<Bitmap>(3)
        crops += screen
        if (h > w * 1.3f) {
            crops += Bitmap.createBitmap(screen, 0, 0, w, h / 2)
            crops += Bitmap.createBitmap(screen, 0, h / 2, w, h - h / 2)
        }
        try {
            for (c in crops) {
                val r = classify(c)
                if (exceeds(r, sensitivity)) return true
            }
            return false
        } finally {
            for (c in crops) if (c !== screen) c.recycle()
        }
    }

    private fun exceeds(r: Result, sensitivity: Int): Boolean = when (sensitivity) {
        0 -> r.unsafe > 0.85f
        1 -> r.unsafe > 0.70f || r.sexy > 0.90f
        else -> r.unsafe > 0.50f || r.sexy > 0.65f
    }

    override fun close() = interpreter.close()

    companion object {
        const val SIZE = 224
    }
}
