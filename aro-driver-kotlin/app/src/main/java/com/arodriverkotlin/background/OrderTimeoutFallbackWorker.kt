package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arodriverkotlin.service.OrderService
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await

class OrderTimeoutFallbackWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val TAG = "OrderTimeoutFallbackWorker"
    }

    override suspend fun doWork(): Result {
        return try {
            val orderId = inputData.getString("orderId") ?: return Result.failure()
            val uid = inputData.getString("uid") ?: return Result.failure()

            Log.i(TAG, "Fallback worker executing for order $orderId")
            delay(1000)

            val stillPending = checkOrderStillPending(orderId)
            if (!stillPending) {
                Log.d(TAG, "Order $orderId no longer pending, skipping fallback")
                return Result.success()
            }

            OrderService.rejectOrder(orderId, uid)
            Log.i(TAG, "Fallback: Order $orderId auto-rejected, re-dispatch triggered")

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Fallback worker failed", e)
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }

    private suspend fun checkOrderStillPending(orderId: String): Boolean {
        try {
            val snap = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("orders").document(orderId).get().await()
            return snap.exists() && snap.getString("status") == "searching"
        } catch (e: Exception) {
            Log.w(TAG, "Gagal cek order pending", e)
            return false
        }
    }
}