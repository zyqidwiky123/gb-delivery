package com.arodriverkotlin.background

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import com.arodriverkotlin.service.OrderService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class OrderTimeoutManager(
    private val context: Context,
    private val uid: String,
    private val acceptTimeoutMs: Long = 20_000L
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private const val TAG = "OrderTimeoutManager"
    private val FALLBACK_TIMEOUT_MS = acceptTimeoutMs + 15_000L   // 15s buffer after alarm
    private const val ALARM_ACTION = "com.arodriverkotlin.ORDER_TIMEOUT"
    private const val WORK_NAME = "order_timeout_fallback"

    private val pendingAlarms = mutableMapOf<String, PendingIntent>()

    fun startAcceptanceTimeout(orderId: String, timeoutMs: Long = acceptTimeoutMs) {
        Log.i(TAG, "Starting acceptance timeout for order $orderId (${timeoutMs}ms alarm + fallback)")

        // 1. Exact AlarmManager (API 23+)
        scheduleExactAlarm(orderId, timeoutMs)

        // 2. WorkManager fallback (for Doze mode / alarm failures)
        scheduleFallbackWork(orderId, timeoutMs)
    }

    fun cancelTimeout(orderId: String) {
        Log.d(TAG, "Cancelling timeout for order $orderId")
        
        // Cancel alarm
        pendingAlarms.remove(orderId)?.let { pendingIntent ->
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(pendingIntent)
        }

        // Cancel WorkManager
        WorkManager.getInstance(context).cancelUniqueWork("$WORK_NAME_$orderId")
    }

    private fun scheduleExactAlarm(orderId: String, timeoutMs: Long = acceptTimeoutMs) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        val intent = Intent(context, OrderTimeoutReceiver::class.java).apply {
            action = ALARM_ACTION
            putExtra("orderId", orderId)
            putExtra("uid", uid)
        }
        
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ALLOW_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        }
        
        val pendingIntent = PendingIntent.getBroadcast(context, orderId.hashCode(), intent, flags)
        pendingAlarms[orderId] = pendingIntent

        val triggerAt = System.currentTimeMillis() + timeoutMs
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        }
    }

    private fun scheduleFallbackWork(orderId: String, timeoutMs: Long = acceptTimeoutMs) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val work = OneTimeWorkRequest.Builder(OrderTimeoutFallbackWorker::class.java)
            .setConstraints(constraints)
            .setInputData(androidx.work.Data.Builder()
                .putString("orderId", orderId)
                .putString("uid", uid)
                .build())
            .setInitialDelay(timeoutMs + 15_000L, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork("$WORK_NAME_$orderId", ExistingWorkPolicy.REPLACE, work)
    }

    fun shutdown() {
        pendingAlarms.values.forEach { intent ->
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(intent)
        }
        pendingAlarms.clear()
        scope.cancel()
    }
}