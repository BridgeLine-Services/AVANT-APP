package com.bridgeline.avant

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * AVANT — Accessibility Layer
 *
 * Gives AVANT "system awareness":
 *   • Knows which app is open
 *   • Detects screen content changes
 *   • Can read on-screen text for AI context
 *   • Enables "what am I looking at?" vision mode
 *
 * User must grant this in:
 *   Settings → Accessibility → AVANT → Enable
 */
class AvantAccessibilityService : AccessibilityService() {

    companion object {
        const val TAG = "AVANT_A11Y"
        var instance: AvantAccessibilityService? = null
    }

    private var lastPackage = ""
    private var lastEventTime = 0L

    override fun onServiceConnected() {
        instance = this
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = (
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED or
                AccessibilityEvent.TYPE_VIEW_CLICKED
            )
            feedbackType    = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags           = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                              AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 300L
        }
        Log.i(TAG, "AVANT Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val event = event ?: return
        val pkg   = event.packageName?.toString() ?: return

        // Debounce rapid events
        val now = System.currentTimeMillis()
        if (now - lastEventTime < 300) return
        lastEventTime = now

        when (event.eventType) {

            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                if (pkg != lastPackage && !pkg.contains("android")) {
                    lastPackage = pkg
                    val appName = getAppName(pkg)
                    Log.d(TAG, "Foreground app: $appName ($pkg)")
                    sendBroadcast(Intent("com.bridgeline.avant.APP_CHANGED")
                        .putExtra("package", pkg)
                        .putExtra("appName", appName))
                }
            }

            AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED -> {
                val text = event.text.joinToString(" ")
                if (text.isNotBlank()) {
                    Log.d(TAG, "Notification from $pkg: $text")
                    sendBroadcast(Intent("com.bridgeline.avant.NOTIFICATION_SEEN")
                        .putExtra("package", pkg)
                        .putExtra("text", text))
                }
            }

            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                // Only read content for specific trigger packages or when AVANT requests it
                if (isAvantFocused()) {
                    val screenText = readScreenText(rootInActiveWindow)
                    if (screenText.isNotBlank()) {
                        sendBroadcast(Intent("com.bridgeline.avant.SCREEN_CONTENT")
                            .putExtra("package", pkg)
                            .putExtra("content", screenText.take(1000)))
                    }
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "AVANT Accessibility interrupted")
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    // ── Screen Reader ──────────────────────────────────────
    fun readScreenText(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val builder = StringBuilder()
        if (!node.text.isNullOrBlank())             builder.append("${node.text} ")
        if (!node.contentDescription.isNullOrBlank()) builder.append("${node.contentDescription} ")
        for (i in 0 until node.childCount) {
            builder.append(readScreenText(node.getChild(i)))
        }
        return builder.toString().trim()
    }

    // Called by JS layer to get current screen content
    fun getCurrentScreenText(): String = readScreenText(rootInActiveWindow)

    private fun isAvantFocused(): Boolean = lastPackage == packageName

    private fun getAppName(pkg: String): String {
        return try {
            val pm = packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: Exception) { pkg }
    }

    // ── Broadcast sender helper ────────────────────────────
    private fun sendBroadcast(intent: Intent) {
        applicationContext.sendBroadcast(intent)
    }
}
