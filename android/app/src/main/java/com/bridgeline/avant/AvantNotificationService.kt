package com.bridgeline.avant

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Intent
import android.util.Log

/**
 * AVANT — Notification Listener
 *
 * Gives AVANT awareness of ALL system notifications:
 *   • WhatsApp / SMS messages
 *   • Calendar reminders
 *   • Missed calls
 *   • App alerts
 *
 * User must grant in:
 *   Settings → Apps → Special app access → Notification access → AVANT
 */
class AvantNotificationService : NotificationListenerService() {

    companion object {
        const val TAG = "AVANT_NOTIF"
        // Packages AVANT pays special attention to
        val PRIORITY_PACKAGES = setOf(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "com.google.android.apps.messaging",  // Google Messages
            "com.samsung.android.messaging",       // Samsung Messages
            "com.android.dialer",
            "com.google.android.dialer",
            "com.google.android.calendar",
            "com.facebook.orca",                   // Messenger
            "org.telegram.messenger",
            "com.instagram.android",
            "com.twitter.android",
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val pkg     = sbn.packageName ?: return
        val extras  = sbn.notification.extras
        val title   = extras.getString("android.title") ?: ""
        val text    = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: text

        if (title.isBlank() && bigText.isBlank()) return

        Log.d(TAG, "[$pkg] $title: $bigText")

        val broadcast = Intent("com.bridgeline.avant.NOTIFICATION_RECEIVED").apply {
            putExtra("package",   pkg)
            putExtra("title",     title)
            putExtra("text",      bigText.take(500))
            putExtra("isPriority", pkg in PRIORITY_PACKAGES)
            putExtra("timestamp", sbn.postTime)
        }
        sendBroadcast(broadcast)

        // For priority apps, also trigger AVANT TTS if relevant
        if (pkg in PRIORITY_PACKAGES && text.isNotBlank()) {
            val appLabel = getAppLabel(pkg)
            val speakText = when {
                title.isNotBlank() -> "New $appLabel from $title"
                else               -> "New $appLabel notification"
            }
            val speakIntent = Intent(this, AvantVoiceKernelService::class.java).apply {
                action = AvantVoiceKernelService.ACTION_SPEAK
                putExtra(AvantVoiceKernelService.EXTRA_TEXT, speakText)
            }
            // Don't auto-speak unless in active mode — let JS layer decide
            // Uncomment to enable automatic reading:
            // startService(speakIntent)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        sbn ?: return
        sendBroadcast(Intent("com.bridgeline.avant.NOTIFICATION_DISMISSED")
            .putExtra("package", sbn.packageName))
    }

    private fun getAppLabel(pkg: String): String {
        return when (pkg) {
            "com.whatsapp"                          -> "WhatsApp message"
            "com.whatsapp.w4b"                      -> "WhatsApp Business message"
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging"         -> "text message"
            "com.android.dialer",
            "com.google.android.dialer"             -> "missed call"
            "com.google.android.calendar"           -> "calendar reminder"
            "com.facebook.orca"                     -> "Messenger message"
            "org.telegram.messenger"                -> "Telegram message"
            "com.instagram.android"                 -> "Instagram notification"
            else                                    -> "notification"
        }
    }
}
