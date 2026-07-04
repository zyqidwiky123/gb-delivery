package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arodriverkotlin.database.AppDatabase
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

class BackgroundSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val TAG = "BackgroundSyncWorker"
        const val WORK_NAME = "background_sync"
        private const val SYNC_TIMEOUT_MS = 30_000L
    }

    private val db = AppDatabase.getInstance(context)
    private val locationDao = db.locationDao()
    private val actionDao = db.actionQueueDao()

    override suspend fun doWork(): Result {
        return try {
            Log.i(TAG, "Starting background sync")

            val firestoreHealthy = checkFirestoreHealth()
            val rtdbHealthy = checkRtdbHealth()

            if (!firestoreHealthy || !rtdbHealthy) {
                Log.w(TAG, "Health check failed: firestore=$firestoreHealthy, rtdb=$rtdbHealthy")
                return Result.retry()
            }

            val uid = inputData.getString("uid")
            if (uid != null) {
                syncPendingLocations(uid)
                syncPendingActions(uid)
            }

            Log.i(TAG, "Background sync completed successfully")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Background sync failed", e)
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }

    private suspend fun checkFirestoreHealth(): Boolean = withTimeoutOrNull(SYNC_TIMEOUT_MS) {
        FirebaseFirestore.getInstance()
            .collection("settings")
            .document("platform")
            .get()
            .await()
        true
    } ?: false

    private suspend fun checkRtdbHealth(): Boolean = withTimeoutOrNull(SYNC_TIMEOUT_MS) {
        FirebaseDatabase.getInstance()
            .reference
            .child(".info/connected")
            .get()
            .await()
        true
    } ?: false

    private suspend fun syncPendingLocations(uid: String) {
        val locations = locationDao.getPendingLocations(uid, 50)
        if (locations.isEmpty()) return

        val syncedIds = mutableListOf<Long>()
        
        for (loc in locations) {
            try {
                com.arodriverkotlin.service.DriverService.updateLocation(uid, loc.lat, loc.lng)
                if (loc.orderId != null) {
                    com.arodriverkotlin.service.DriverService.updateOrderLocation(loc.orderId!!, loc.lat, loc.lng)
                }
                syncedIds.add(loc.id!!)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to sync location ${loc.id}", e)
                locationDao.incrementRetry(loc.id!!, System.currentTimeMillis())
            }
        }

        if (syncedIds.isNotEmpty()) {
            locationDao.deleteByIds(syncedIds)
        }
    }

    private suspend fun syncPendingActions(uid: String) {
        val actions = actionDao.getUnsyncedActions(uid)
        if (actions.isEmpty()) return

        for (action in actions) {
            try {
                val success = when (action.actionType) {
                    "accept" -> {
                        val driverSnap = FirebaseFirestore.getInstance()
                            .collection("drivers").document(uid).get().await()
                        val profile = com.arodriverkotlin.models.DriverProfile(
                            id = uid,
                            name = driverSnap.getString("name") ?: driverSnap.getString("displayName") ?: "Driver",
                            phone = driverSnap.getString("phone") ?: "",
                            email = driverSnap.getString("email") ?: "",
                            photoUrl = driverSnap.getString("photoUrl") ?: "",
                            vehicleType = driverSnap.getString("vehicleType") ?: "motorcycle",
                            plateNumber = driverSnap.getString("plateNumber") ?: "",
                            balance = driverSnap.getLong("balance") ?: 0,
                            isOnline = driverSnap.getBoolean("isOnline") ?: true,
                            status = driverSnap.getString("status") ?: "online"
                        )
                        com.arodriverkotlin.service.OrderService.acceptOrder(action.orderId, uid, profile)
                        true
                    }
                    "reject" -> {
                        com.arodriverkotlin.service.OrderService.rejectOrder(action.orderId, uid)
                        true
                    }
                    "arrive" -> {
                        com.arodriverkotlin.service.OrderService.arriveAtPickup(action.orderId)
                        true
                    }
                    "pickup" -> {
                        com.arodriverkotlin.service.OrderService.pickupOrder(action.orderId, 0, 1)
                        true
                    }
                    "complete" -> {
                        val orderSnap = FirebaseFirestore.getInstance()
                            .collection("orders").document(action.orderId).get().await()
                        val driverSnap = FirebaseFirestore.getInstance()
                            .collection("drivers").document(uid).get().await()
                        val deliveryFee = orderSnap.getLong("deliveryFee") ?: 0
                        val appServiceFee = orderSnap.getLong("appServiceFee") ?: 0
                        val subsidizedFee = orderSnap.getLong("subsidizedFee") ?: 0
                        val serviceType = orderSnap.getString("serviceType") ?: "jek"
                        val serviceFee = orderSnap.getLong("serviceFee") ?: 0
                        val balance = driverSnap.getLong("balance") ?: 0
                        val profile = com.arodriverkotlin.models.DriverProfile(
                            id = uid, balance = balance, isOnline = true, status = "busy"
                        )
                        com.arodriverkotlin.service.OrderService.completeOrder(
                            action.orderId, uid, profile,
                            deliveryFee, appServiceFee, subsidizedFee, serviceType, serviceFee
                        )
                        true
                    }
                    else -> false
                }
                
                if (success) {
                    actionDao.markSynced(action.id!!)
                } else {
                    actionDao.incrementRetry(action.id!!, System.currentTimeMillis())
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to sync action ${action.id}", e)
                actionDao.incrementRetry(action.id!!, System.currentTimeMillis())
            }
        }
    }
}