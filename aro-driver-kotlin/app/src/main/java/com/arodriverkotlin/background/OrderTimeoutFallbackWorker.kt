package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arodriverkotlin.service.OrderService
import kotlinx.coroutines.delay

class OrderTimeoutFallbackWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val TAG = "OrderTimeoutFallbackWorker"
    }

    override suspend fun doWork(): Result = try {
        val orderId = inputData.getString("orderId") ?: return Result.failure()
        val uid = inputData.getString("uid") ?: return Result.failure()

        Log.i(TAG, "Fallback worker executing for order $orderId")

        // Small delay to allow alarm to fire first if it hasn't
        delay(1000)

        // Check if order is still in "searching" state
        // If already accepted/rejected, skip
        val stillPending = checkOrderStillPending(orderId)
        if (!stillPending) {
            Log.d(TAG, "Order $orderId no longer pending, skipping fallback")
            return Result.success()
        }

        // Auto-reject and trigger re-dispatch
        OrderService.rejectOrder(orderId)
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

    private suspend fun checkOrderStillPending(orderId: String): Boolean {
        try {
            val snap = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("orders").document(orderId).get().await()
            return snap.exists() && snap.getString("status") == "searching"
        } catch (_: Exception) {
            return false
        }
    }
}