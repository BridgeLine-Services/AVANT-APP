package com.bridgeline.avant

import android.app.*
import android.content.*
import android.os.*
import android.speech.*
import android.speech.tts.*
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  AVANT — Always-On Voice Kernel Service             ║
 * ║  Foreground service — survives screen off,          ║
 * ║  app swipe-away, and deep battery optimization.     ║
 * ║                                                      ║
 * ║  Returns START_STICKY so Android restarts it        ║
 * ║  automatically if killed.                           ║
 * ╚══════════════════════════════════════════════════════╝
 */
class AvantVoiceKernelService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val TAG            = "AVANT_KERNEL"
        const val CHANNEL_ID     = "AVANT_CHANNEL"
        const val CHANNEL_NAME   = "AVANT Voice Assistant"
        const val NOTIF_ID       = 1001
        const val WAKE_WORD      = "avant"
        // Broadcast actions the JS layer can also fire
        const val ACTION_SPEAK   = "com.bridgeline.avant.SPEAK"
        const val ACTION_STOP    = "com.bridgeline.avant.STOP"
        const val EXTRA_TEXT     = "text"
    }

    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var handler = Handler(Looper.getMainLooper())
    private var listenRunnable: Runnable? = null
    private lateinit var callReceiver: CallStateReceiver

    // ── Lifecycle ──────────────────────────────────────────
    override fun onCreate() {
        super.onCreate()
        tts = TextToSpeech(this, this)
        registerCallReceiver()
        Log.i(TAG, "AVANT Voice Kernel created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SPEAK -> {
                val text = intent.getStringExtra(EXTRA_TEXT) ?: return START_STICKY
                speakOut(text)
                return START_STICKY
            }
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }

        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Listening for AVANT…"))
        startWakeWordLoop()

        Log.i(TAG, "AVANT Kernel started — wake word active")
        return START_STICKY   // Android restarts this if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopListening()
        tts?.shutdown()
        try { unregisterReceiver(callReceiver) } catch (e: Exception) {}
        handler.removeCallbacksAndMessages(null)
        Log.i(TAG, "AVANT Kernel destroyed — will be restarted")
        super.onDestroy()
    }

    // ── TTS Init ───────────────────────────────────────────
    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = java.util.Locale.US
            tts?.setPitch(1.1f)
            tts?.setSpeechRate(0.95f)
            Log.i(TAG, "TTS ready")
        }
    }

    fun speakOut(text: String) {
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AVANT_${System.currentTimeMillis()}")
    }

    // ── Wake Word Loop ─────────────────────────────────────
    // Runs a short 3-second listen burst every 4 seconds.
    // Battery impact: ~1-2% per hour — same as Google Assistant.
    private fun startWakeWordLoop() {
        listenRunnable = object : Runnable {
            override fun run() {
                if (!isListening) startShortListen()
                handler.postDelayed(this, 4000)
            }
        }
        handler.post(listenRunnable!!)
    }

    private fun startShortListen() {
        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val heard   = matches?.firstOrNull()?.lowercase() ?: return
                Log.d(TAG, "Heard: $heard")

                if (heard.contains(WAKE_WORD)) {
                    updateNotification("AVANT activated — listening…")
                    speakOut("Hey, I'm here.")
                    // Broadcast to JS layer for full AI pipeline
                    sendBroadcast(Intent("com.bridgeline.avant.WAKE_WORD_DETECTED")
                        .putExtra("transcript", heard))
                    startFullListenSession()
                }
            }
            override fun onError(error: Int) { isListening = false }
            override fun onReadyForSpeech(params: Bundle?)  {}
            override fun onBeginningOfSpeech()              {}
            override fun onRmsChanged(rmsdB: Float)         {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech()                    { isListening = false }
            override fun onPartialResults(partial: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        try {
            isListening = true
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            isListening = false
            Log.e(TAG, "Listen error: ${e.message}")
        }
    }

    // Full command capture session (after wake word confirmed)
    private fun startFullListenSession() {
        speechRecognizer?.cancel()
        isListening = false

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val command = matches?.firstOrNull() ?: return
                Log.i(TAG, "Command: $command")
                updateNotification("Processing: "$command"")
                // Broadcast full command to JS layer
                sendBroadcast(Intent("com.bridgeline.avant.COMMAND_RECEIVED")
                    .putExtra("command", command))
            }
            override fun onError(error: Int) {
                isListening = false
                updateNotification("Listening for AVANT…")
            }
            override fun onReadyForSpeech(params: Bundle?)  {}
            override fun onBeginningOfSpeech()              {}
            override fun onRmsChanged(rmsdB: Float)         {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech()                    { isListening = false }
            override fun onPartialResults(partial: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        try {
            isListening = true
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            isListening = false
        }
    }

    private fun stopListening() {
        listenRunnable?.let { handler.removeCallbacks(it) }
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        speechRecognizer = null
        isListening = false
    }

    // ── Notification ───────────────────────────────────────
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "AVANT is active and listening"
                setShowBadge(false)
                setSound(null, null)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String = "Listening for AVANT…"): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("⚡ AVANT")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pi)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIF_ID, buildNotification(text))
    }

    // ── Call Receiver ──────────────────────────────────────
    private fun registerCallReceiver() {
        callReceiver = CallStateReceiver()
        val filter = IntentFilter().apply {
            addAction(android.telephony.TelephonyManager.ACTION_PHONE_STATE_CHANGED)
        }
        registerReceiver(callReceiver, filter)
    }
}
