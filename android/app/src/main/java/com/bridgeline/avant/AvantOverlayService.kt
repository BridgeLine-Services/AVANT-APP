package com.bridgeline.avant

import android.app.*
import android.content.*
import android.graphics.*
import android.os.*
import android.view.*
import android.widget.*
import android.util.Log

/**
 * AVANT — Floating Overlay (Lock Screen + Always-On Bubble)
 *
 * Creates a floating AVANT orb that:
 *   • Appears on lock screen
 *   • Floats above all apps (system alert window)
 *   • Shows AVANT's listening/speaking state visually
 *   • Tap to activate full voice session
 *
 * Requires: android.permission.SYSTEM_ALERT_WINDOW
 * User grants via: Settings → Apps → AVANT → Display over other apps
 */
class AvantOverlayService : Service() {

    companion object {
        const val TAG    = "AVANT_OVERLAY"
        const val ACTION_SHOW = "com.bridgeline.avant.SHOW_OVERLAY"
        const val ACTION_HIDE = "com.bridgeline.avant.HIDE_OVERLAY"
        const val ACTION_PULSE = "com.bridgeline.avant.PULSE_OVERLAY"
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isShowing = false
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW  -> showOverlay()
            ACTION_HIDE  -> hideOverlay()
            ACTION_PULSE -> pulseOverlay(intent.getStringExtra("state") ?: "idle")
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        hideOverlay()
        super.onDestroy()
    }

    // ── Overlay UI ─────────────────────────────────────────
    private fun showOverlay() {
        if (isShowing) return

        val view = FrameLayout(this).apply {
            val orb = TextView(context).apply {
                text      = "⚡"
                textSize  = 24f
                gravity   = Gravity.CENTER
                setPadding(12, 12, 12, 12)
                setBackgroundColor(Color.argb(200, 0, 10, 30))
                setTextColor(Color.argb(255, 64, 170, 255))
            }
            orb.setOnClickListener {
                // Activate voice when orb is tapped
                sendBroadcast(Intent("com.bridgeline.avant.WAKE_WORD_DETECTED")
                    .putExtra("transcript", "avant"))
                Log.i(TAG, "Orb tapped — activating voice")
            }
            addView(orb)
        }

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = 32; y = 160
        }

        try {
            windowManager?.addView(view, params)
            overlayView = view
            isShowing   = true
            Log.i(TAG, "Overlay shown")
        } catch (e: Exception) {
            Log.e(TAG, "Overlay error: ${e.message}")
        }
    }

    private fun hideOverlay() {
        if (!isShowing || overlayView == null) return
        try {
            windowManager?.removeView(overlayView)
            overlayView = null
            isShowing   = false
        } catch (e: Exception) { Log.e(TAG, "Hide error: ${e.message}") }
    }

    private fun pulseOverlay(state: String) {
        val orb = (overlayView as? FrameLayout)?.getChildAt(0) as? TextView ?: return
        handler.post {
            when (state) {
                "listening" -> { orb.text = "🎙"; orb.setTextColor(Color.argb(255, 0, 255, 160)) }
                "thinking"  -> { orb.text = "🧠"; orb.setTextColor(Color.argb(255, 170, 64, 255)) }
                "speaking"  -> { orb.text = "🔊"; orb.setTextColor(Color.argb(255, 64, 170, 255)) }
                else        -> { orb.text = "⚡"; orb.setTextColor(Color.argb(255, 64, 170, 255)) }
            }
        }
    }
}
