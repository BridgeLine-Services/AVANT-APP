package com.bridgeline.avant

import android.content.*
import android.telephony.TelephonyManager
import android.util.Log

/**
 * AVANT — Call State Receiver
 *
 * Detects incoming/outgoing calls and broadcasts them
 * to the JS layer so AVANT can:
 *   • Announce the caller via TTS
 *   • Suggest "Answer?" via voice
 *   • Pause music / mute audio
 *   • Take voice notes after calls
 */
class CallStateReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "AVANT_CALL"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state  = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Unknown"

        Log.i(TAG, "Call state: $state | Number: $number")

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                Log.i(TAG, "Incoming call from $number")
                // Broadcast to JS layer
                context.sendBroadcast(
                    Intent("com.bridgeline.avant.CALL_EVENT")
                        .putExtra("state", "ringing")
                        .putExtra("number", number)
                )
                // Speak caller ID via TTS service
                val speakIntent = Intent(context, AvantVoiceKernelService::class.java).apply {
                    action = AvantVoiceKernelService.ACTION_SPEAK
                    putExtra(AvantVoiceKernelService.EXTRA_TEXT,
                        "Incoming call from ${formatNumber(number)}")
                }
                context.startService(speakIntent)
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                Log.i(TAG, "Call answered")
                context.sendBroadcast(
                    Intent("com.bridgeline.avant.CALL_EVENT")
                        .putExtra("state", "offhook")
                        .putExtra("number", number)
                )
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                Log.i(TAG, "Call ended")
                context.sendBroadcast(
                    Intent("com.bridgeline.avant.CALL_EVENT")
                        .putExtra("state", "idle")
                        .putExtra("number", number)
                )
            }
        }
    }

    private fun formatNumber(number: String): String {
        if (number == "Unknown" || number.isBlank()) return "an unknown number"
        // Format: 4155551234 → "415 555 1234"
        return if (number.length == 10) {
            "${number.substring(0,3)} ${number.substring(3,6)} ${number.substring(6)}"
        } else number
    }
}
