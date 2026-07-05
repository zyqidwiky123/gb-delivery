package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import com.arodriverkotlin.service.ForegroundService
import java.util.concurrent.TimeUnit

class WatchdogWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("foreground_service", Context.MODE_PRIVATE)
        val uid = prefs.getString("driver_uid", null)
        if (uid != null) {
            ForegroundService.start(applicationContext, uid)
            Log.i(TAG, "Health check: service restarted for $uid")
        }
        return Result.success()
    }

    companion object {
        private const val TAG = "WatchdogWorker"
        private const val WORK_NAME = "watchdog_health_check"
        private const val INTERVAL_MINUTES = 15L

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            val work = PeriodicWorkRequest.Builder(WatchdogWorker::class.java, INTERVAL_MINUTES, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, work)

            Log.i(TAG, "Watchdog scheduled every ${INTERVAL_MINUTES}min with CONNECTED constraint")
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.i(TAG, "Watchdog cancelled")
        }
    }
}
