/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Native Android Module (FIXED)                      ║
 * ║                                                              ║
 * ║  FIXES:                                                      ║
 * ║  • Foreground service that survives app close                ║
 * ║  • Floating overlay (SYSTEM_ALERT_WINDOW) persists           ║
 * ║  • Wake word detection via continuous microphone loop        ║
 * ║  • Bridges detected commands back to JS via RCTDeviceEventEmitter║
 * ╚══════════════════════════════════════════════════════════════╝
 */
package com.avant

import android.app.*
import android.content.*
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.speech.*
import android.util.Log
import android.view.*
import android.view.WindowManager.LayoutParams.*
import android.widget.*
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class AvantModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "AvantModule"
        const val CHANNEL_ID = "avant_service"
        const val NOTIF_ID = 1001
        var instance: AvantModule? = null
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var overlayShowing = false

    override fun getName() = "AvantModule"

    override fun initialize() {
        super.initialize()
        instance = this
    }

    // ── Called from App.js boot ───────────────────────────────
    @ReactMethod
    fun startVoiceKernel() {
        Log.d(TAG, "startVoiceKernel called")
        val ctx = reactApplicationContext
        // Start foreground service
        val intent = Intent(ctx, AvantForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }

    // ── Start floating overlay ────────────────────────────────
    @ReactMethod
    fun startFloatingOverlay() {
        if (overlayShowing) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactApplicationContext)) {
            Log.w(TAG, "SYSTEM_ALERT_WINDOW permission not granted — overlay not shown")
            return
        }
        val handler = Handler(Looper.getMainLooper())
        handler.post {
            try {
                windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager

                // Small AVANT badge floating widget
                val view = FrameLayout(reactApplicationContext)
                val tvIcon = TextView(reactApplicationContext).apply {
                    text = "⚡"
                    textSize = 18f
                    setTextColor(Color.parseColor("#40AAFF"))
                    setPadding(16, 12, 16, 12)
                    setBackgroundColor(Color.parseColor("#CC050510"))
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor("#CC050510"))
                        setStroke(2, Color.parseColor("#40AAFF"))
                    }
                }
                view.addView(tvIcon)

                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    TYPE_APPLICATION_OVERLAY else TYPE_PHONE

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    type,
                    FLAG_NOT_FOCUSABLE or FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.END
                    x = 24; y = 200
                }

                // Drag to move
                var initX = 0; var initY = 0; var initTX = 0; var initTY = 0
                view.setOnTouchListener { v, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            initX = params.x; initY = params.y
                            initTX = event.rawX.toInt(); initTY = event.rawY.toInt(); false
                        }
                        MotionEvent.ACTION_MOVE -> {
                            params.x = initX + (initTX - event.rawX.toInt())
                            params.y = initY + (event.rawY.toInt() - initTY)
                            windowManager?.updateViewLayout(view, params); true
                        }
                        MotionEvent.ACTION_UP -> {
                            // Tap — trigger voice session
                            if (Math.abs(event.rawX - initTX) < 10 && Math.abs(event.rawY - initTY) < 10) {
                                sendEventToJS("AVANT_WAKE", "overlay_tap")
                            }
                            false
                        }
                        else -> false
                    }
                }

                windowManager?.addView(view, params)
                overlayView = view
                overlayShowing = true
                Log.d(TAG, "Floating overlay started")
            } catch (e: Exception) {
                Log.e(TAG, "Overlay error: ${e.message}")
            }
        }
    }

    // ── Update overlay appearance from JS ────────────────────
    @ReactMethod
    fun updateOverlay(state: String) {
        val handler = Handler(Looper.getMainLooper())
        handler.post {
            try {
                val tv = (overlayView as? FrameLayout)?.getChildAt(0) as? TextView ?: return@post
                when (state) {
                    "listening" -> { tv.text = "🎙"; tv.setTextColor(Color.parseColor("#00FF9F")) }
                    "thinking"  -> { tv.text = "⚙";  tv.setTextColor(Color.parseColor("#FFB344")) }
                    "speaking"  -> { tv.text = "💬"; tv.setTextColor(Color.parseColor("#40AAFF")) }
                    else        -> { tv.text = "⚡"; tv.setTextColor(Color.parseColor("#40AAFF")) }
                }
            } catch (e: Exception) {}
        }
    }

    // ── Send JS event ─────────────────────────────────────────
    fun sendEventToJS(eventName: String, data: String) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, data)
        } catch (e: Exception) {
            Log.e(TAG, "sendEventToJS error: ${e.message}")
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        instance = null
    }
}

// ══════════════════════════════════════════════════════════════
// ── Foreground Service (survives app close) ───────────────────
// ══════════════════════════════════════════════════════════════
class AvantForegroundService : Service() {

    private var speechRecognizer: SpeechRecognizer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isListening = false

    // Wake word patterns
    private val WAKE_PATTERNS = listOf(
        Regex("\\b(hey|hi|hello|yo|ok|okay|whats up|what's up)\\s+avant\\b", RegexOption.IGNORE_CASE),
        Regex("^avant[,\\s!.?]", RegexOption.IGNORE_CASE),
        Regex("\\bavant\\b", RegexOption.IGNORE_CASE),
    )

    override fun onBind(intent: Intent?) = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(AvantModule.NOTIF_ID, buildNotification())
        startWakeWordLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY // FIX: restarts automatically if killed
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                AvantModule.CHANNEL_ID,
                "AVANT Voice Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "AVANT is listening for your voice" }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, AvantModule.CHANNEL_ID)
            .setContentTitle("AVANT is active")
            .setContentText("Say \"Hey Avant\" to get started")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun startWakeWordLoop() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w("AvantService", "Speech recognition not available on this device")
            return
        }
        handler.post { listenForWakeWord() }
    }

    private fun listenForWakeWord() {
        if (isListening) return
        isListening = true

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: emptyList()
                for (match in matches) {
                    if (WAKE_PATTERNS.any { it.containsMatchIn(match) }) {
                        Log.d("AvantService", "Wake word detected: $match")
                        AvantModule.instance?.sendEventToJS("AVANT_WAKE", match)
                        // Brief pause before relisten
                        handler.postDelayed({ listenForWakeWord() }, 3000)
                        return
                    }
                }
                // No wake word — keep listening
                handler.postDelayed({ listenForWakeWord() }, 100)
            }

            override fun onPartialResults(partial: Bundle?) {
                val partials = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: emptyList()
                for (p in partials) {
                    if (WAKE_PATTERNS.any { it.containsMatchIn(p) }) {
                        Log.d("AvantService", "Wake word (partial): $p")
                        AvantModule.instance?.sendEventToJS("AVANT_WAKE", p)
                        speechRecognizer?.cancel()
                        handler.postDelayed({ listenForWakeWord() }, 2500)
                        return
                    }
                }
            }

            override fun onError(error: Int) {
                isListening = false
                // Retry after delay
                handler.postDelayed({ listenForWakeWord() }, 800)
            }

            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, p: Bundle?) {}
        })

        try { speechRecognizer?.startListening(intent) }
        catch (e: Exception) { isListening = false; handler.postDelayed({ listenForWakeWord() }, 1000) }
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        // Restart the service if killed
        val broadcastIntent = Intent("com.avant.restart")
        sendBroadcast(broadcastIntent)
    }
}

// ── Boot receiver — restart AVANT on device reboot ───────────
class AvantBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "com.avant.restart") {
            val svc = Intent(context, AvantForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc)
            } else {
                context.startService(svc)
            }
        }
    }
}
