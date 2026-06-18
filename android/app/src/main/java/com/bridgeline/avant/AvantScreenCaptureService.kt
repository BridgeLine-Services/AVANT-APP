package com.bridgeline.avant

import android.app.*
import android.content.*
import android.graphics.*
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream

/**
 * AVANT — Screen Capture Service
 *
 * Uses Android MediaProjection API to capture a single screen frame.
 * Converts it to Base64 JPEG and broadcasts it to the JS layer.
 *
 * USER CONSENT REQUIRED:
 *   Android shows a system dialog: "AVANT will start capturing your screen."
 *   User must tap "Start now". This cannot be bypassed — it's OS-enforced.
 *
 * Usage from JS:
 *   Capacitor plugin calls startCapture() → broadcasts base64 via intent.
 *
 * IMPORTANT: This is NOT silent surveillance.
 * Android shows a persistent notification during capture.
 */
class AvantScreenCaptureService : Service() {

    companion object {
        const val TAG                   = "AVANT_SCREEN"
        const val CHANNEL_ID            = "AVANT_SCREEN_CHANNEL"
        const val NOTIF_ID              = 1002
        const val ACTION_START          = "com.bridgeline.avant.SCREEN_START"
        const val ACTION_STOP           = "com.bridgeline.avant.SCREEN_STOP"
        const val EXTRA_RESULT_CODE     = "result_code"
        const val EXTRA_RESULT_DATA     = "result_data"
        const val BROADCAST_FRAME       = "com.bridgeline.avant.SCREEN_FRAME"
        const val BROADCAST_FRAME_B64   = "frame_base64"

        // Singleton access for Capacitor plugin
        var instance: AvantScreenCaptureService? = null
    }

    private var mediaProjection:  MediaProjection? = null
    private var virtualDisplay:   VirtualDisplay?  = null
    private var imageReader:      ImageReader?      = null
    private val handler = Handler(Looper.getMainLooper())

    private val screenWidth  get() = resources.displayMetrics.widthPixels
    private val screenHeight get() = resources.displayMetrics.heightPixels
    private val screenDpi    get() = resources.displayMetrics.densityDpi

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
        Log.i(TAG, "Screen Capture Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                    intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                else @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_RESULT_DATA)

                if (resultCode == Activity.RESULT_OK && resultData != null) {
                    startCapture(resultCode, resultData)
                } else {
                    Log.w(TAG, "Screen capture permission not granted")
                    stopSelf()
                }
            }
            ACTION_STOP -> {
                stopCapture()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        stopCapture()
        super.onDestroy()
    }

    // ── Start capture session ──────────────────────────────
    private fun startCapture(resultCode: Int, data: Intent) {
        val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mgr.getMediaProjection(resultCode, data)

        // Capture at half resolution for faster AI processing
        val capWidth  = screenWidth  / 2
        val capHeight = screenHeight / 2

        imageReader = ImageReader.newInstance(capWidth, capHeight, PixelFormat.RGBA_8888, 2)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "AVANT_SCREEN",
            capWidth, capHeight, screenDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, handler
        )

        Log.i(TAG, "Screen capture started — ${capWidth}x${capHeight}")
    }

    // ── Capture a single frame → Base64 ───────────────────
    fun captureFrame(): String? {
        val reader = imageReader ?: run { Log.w(TAG, "No ImageReader"); return null }

        // Allow up to 3 retries for the frame to be available
        repeat(3) { attempt ->
            val image = reader.acquireLatestImage()
            if (image != null) {
                try {
                    val planes = image.planes
                    val buffer = planes[0].buffer
                    val pStride = planes[0].pixelStride
                    val rStride = planes[0].rowStride
                    val w = image.width; val h = image.height
                    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                    // Copy buffer respecting padding
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    val pixBuf = ByteArray(w * h * 4)
                    for (row in 0 until h) {
                        for (col in 0 until w) {
                            val idx    = row * rStride + col * pStride
                            val pIdx   = (row * w + col) * 4
                            if (idx + 3 < bytes.size && pIdx + 3 < pixBuf.size) {
                                pixBuf[pIdx]     = bytes[idx]
                                pixBuf[pIdx + 1] = bytes[idx + 1]
                                pixBuf[pIdx + 2] = bytes[idx + 2]
                                pixBuf[pIdx + 3] = bytes[idx + 3]
                            }
                        }
                    }
                    val intBuf = java.nio.IntBuffer.allocate(w * h)
                    for (i in 0 until w * h) {
                        val r = pixBuf[i * 4].toInt() and 0xFF
                        val g = pixBuf[i * 4 + 1].toInt() and 0xFF
                        val b = pixBuf[i * 4 + 2].toInt() and 0xFF
                        intBuf.put(i, android.graphics.Color.rgb(r, g, b))
                    }
                    bmp.copyPixelsFromBuffer(intBuf)

                    val out = ByteArrayOutputStream()
                    bmp.compress(Bitmap.CompressFormat.JPEG, 70, out)
                    val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                    Log.d(TAG, "Frame captured — ${b64.length} chars")

                    // Broadcast to JS layer
                    sendBroadcast(Intent(BROADCAST_FRAME).putExtra(BROADCAST_FRAME_B64, b64))

                    return b64
                } finally {
                    image.close()
                }
            }
            Thread.sleep(150)  // wait for next frame
        }

        Log.w(TAG, "No frame available after 3 attempts")
        return null
    }

    private fun stopCapture() {
        virtualDisplay?.release(); virtualDisplay   = null
        imageReader?.close();      imageReader      = null
        mediaProjection?.stop();   mediaProjection  = null
        Log.i(TAG, "Screen capture stopped")
    }

    // ── Notification ───────────────────────────────────────
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "AVANT Screen Capture", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "AVANT is analyzing your screen"; setSound(null, null) }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("⚡ AVANT — Screen Analysis")
            .setContentText("AVANT is reading your screen to assist you")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
}
