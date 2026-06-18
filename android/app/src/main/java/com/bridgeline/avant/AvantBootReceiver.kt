package com.bridgeline.avant

import android.content.*
import android.os.Build
import android.util.Log

/**
 * AVANT — Boot Receiver
 *
 * Restarts the AVANT Voice Kernel automatically after:
 *   • Device reboot
 *   • System update
 *   • App update
 *
 * This is what makes AVANT behave like Siri — it wakes up
 * as soon as the phone boots, without user intervention.
 */
class AvantBootReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "AVANT_BOOT"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON" -> {
                Log.i(TAG, "Boot detected — starting AVANT kernel")
                val serviceIntent = Intent(context, AvantVoiceKernelService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }
}
