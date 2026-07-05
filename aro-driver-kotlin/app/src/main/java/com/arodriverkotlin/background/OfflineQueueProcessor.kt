package com.arodriverkotlin.background

import android.content.Context
import android.net.ConnectivityManager
import android.util.Log
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.SyncCoordinator
import com.arodriverkotlin.database.dao.ActionQueueDao
import com.arodriverkotlin.database.dao.LocationDao
import com.arodriverkotlin.background.QueuePriority
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.database.entity.PendingAction
import com.arodriverkotlin.database.entity.PendingLocation
import com.arodriverkotlin.service.DriverService
import com.arodriverkotlin.service.OrderService
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlin.math.pow

class OfflineQueueProcessor(
    private val context: Context,
    private val uid: String
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db = AppDatabase.getInstance(context)
    private val locationDao = db.locationDao()
    private val actionDao = db.actionQueueDao()

    fun onStart() {
        scope.launch { observeConnectivity() }
        scope.launch {
            while (true) {
                delay(SYNC_INTERVAL_MS)
                processQueue()
            }
        }
    }

    fun onStop() {
        scope.cancel()
    }

    private fun observeConnectivity() = callbackFlow {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                trySend(true)
            }

            override fun onLost(network: android.net.Network) {
                trySend(false)
            }
        }
        cm.registerDefaultNetworkCallback(callback)
        trySend(cm.activeNetwork != null)
        awaitClose { cm.unregisterNetworkCallback(callback) }
    }.distinctUntilChanged().onEach { isConnected ->
        if (isConnected) {
            scope.launch { processQueue() }
        }
    }.launchIn(scope)

    suspend fun processQueue() {
        SyncCoordinator.syncMutex.withLock {
            Log.i(TAG, "Starting queue processing for $uid")

            syncOrderActions()

            syncLocations()

            cleanupStaleEntries()

            Log.i(TAG, "Queue processing completed for $uid")
        }
    }

    private suspend fun syncOrderActions() {
        val actions = actionDao.getUnsyncedActionsByPriority(uid, QueuePriority.ORDER_ACTION.value)
        if (actions.isEmpty()) return

        for (action in actions) {
            val success = executeActionWithBackoff(action)
            if (success) {
                actionDao.markSynced(action.id!!)
            } else {
                actionDao.incrementRetry(action.id!!, System.currentTimeMillis())
                delay(calculateBackoff(action.retryCount))
            }
        }
    }

    private suspend fun cleanupStaleEntries() {
        val cutoff = System.currentTimeMillis() - TTL_MS
        locationDao.deleteOldLocations(uid, cutoff)
        actionDao.deleteOldSynced(uid, cutoff)
        Log.i(TAG, "Cleaned up stale entries older than ${TTL_MS / 86_400_000} days")
    }

    private suspend fun syncLocations() {
        var hasMore = true
        while (hasMore) {
            val locations = locationDao.getPendingLocations(uid, BATCH_SIZE)
            if (locations.isEmpty()) {
                hasMore = false
                break
            }

            val batch = locations.take(BATCH_SIZE)
            var allSynced = true

            for (loc in batch) {
                val success = uploadLocationWithBackoff(loc)
                if (success) {
                    locationDao.deleteByIds(listOf(loc.id!!))
                } else {
                    allSynced = false
                    locationDao.incrementRetry(loc.id!!, System.currentTimeMillis())
                }
            }

            if (!allSynced) {
                delay(calculateBackoff(batch.first().retryCount))
            }
        }
    }

    private suspend fun uploadLocationWithBackoff(loc: PendingLocation): Boolean {
        var retries = loc.retryCount
        while (retries < MAX_RETRY_ATTEMPTS) {
            try {
                DriverService.updateLocation(uid, loc.lat, loc.lng)
                if (loc.orderId != null) {
                    DriverService.updateOrderLocation(loc.orderId!!, loc.lat, loc.lng)
                }
                return true
            } catch (e: Exception) {
                Log.w(TAG, "Location upload failed for ${loc.id}, retry $retries", e)
                retries++
                delay(calculateBackoff(retries))
            }
        }
        Log.e(TAG, "Location ${loc.id} exceeded max retries ($MAX_RETRY_ATTEMPTS), removing from queue")
        locationDao.deleteByIds(listOf(loc.id!!))
        return false
    }

    private suspend fun executeActionWithBackoff(action: PendingAction): Boolean {
        var retries = action.retryCount
        while (retries < MAX_RETRY_ATTEMPTS) {
            try {
                return when (action.actionType) {
                    "accept" -> {
                        OrderService.acceptOrder(action.orderId, uid, getProfileFromPayload(action.payload))
                        true
                    }
                    "reject" -> {
                        OrderService.rejectOrder(action.orderId, uid)
                        true
                    }
                    "arrive" -> {
                        OrderService.arriveAtPickup(action.orderId)
                        true
                    }
                    "pickup" -> {
                        val orderSnap = FirebaseFirestore.getInstance()
                            .collection("orders").document(action.orderId).get().await()
                        val pickupsDone = orderSnap.getLong("pickupsDone") ?: 0L
                        val pickupCount = orderSnap.getLong("pickupCount")?.toInt() ?: 1
                        OrderService.pickupOrder(action.orderId, pickupsDone, pickupCount)
                        true
                    }
                    "complete" -> {
                        val profile = getProfileFromPayload(action.payload)
                        val orderSnap = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                            .collection("orders").document(action.orderId).get().await()
                        val deliveryFee = orderSnap.getLong("deliveryFee") ?: 0
                        val appServiceFee = orderSnap.getLong("appServiceFee") ?: 0
                        val subsidizedFee = orderSnap.getLong("subsidizedFee") ?: 0
                        val serviceType = orderSnap.getString("serviceType") ?: "jek"
                        val serviceFee = orderSnap.getLong("serviceFee") ?: 0
                        OrderService.completeOrder(
                            action.orderId, uid, profile,
                            deliveryFee, appServiceFee, subsidizedFee, serviceType, serviceFee
                        )
                        true
                    }
                    "cancel" -> {
                        OrderService.cancelOrder(action.orderId, uid, getProfileFromPayload(action.payload), "Offline cancel")
                        true
                    }
                    else -> false
                }
            } catch (e: Exception) {
                Log.w(TAG, "Action ${action.actionType} failed for ${action.id}, retry $retries", e)
                retries++
                delay(calculateBackoff(retries))
            }
        }
        Log.e(TAG, "Action ${action.id} (${action.actionType}) exceeded max retries ($MAX_RETRY_ATTEMPTS), marking as dead letter")
        actionDao.markSynced(action.id!!)
        return false
    }

    private fun calculateBackoff(retryCount: Int): Long {
        val backoff = (BASE_BACKOFF_MS * (2.0).pow(retryCount)).toLong()
        val jitter = (Math.random() * 0.2 - 0.1) * backoff
        return (backoff + jitter).toLong().coerceAtMost(MAX_BACKOFF_MS)
    }

    private fun getProfileFromPayload(payload: String): com.arodriverkotlin.models.DriverProfile {
        if (payload.isBlank()) {
            return defaultProfile()
        }
        return try {
            val json = org.json.JSONObject(payload)
            com.arodriverkotlin.models.DriverProfile(
                id = uid,
                name = json.optString("name", "Driver"),
                phone = json.optString("phone", ""),
                email = json.optString("email", ""),
                photoUrl = json.optString("photoUrl", ""),
                vehicleType = json.optString("vehicleType", "motorcycle"),
                plateNumber = json.optString("plateNumber", ""),
                balance = json.optLong("balance", 0),
                isOnline = json.optBoolean("isOnline", true),
                status = json.optString("status", "online")
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse profile payload, using default", e)
            defaultProfile()
        }
    }

    private fun defaultProfile() = com.arodriverkotlin.models.DriverProfile(
        id = uid, name = "Driver", phone = "", email = "",
        photoUrl = "", vehicleType = "motorcycle", plateNumber = "",
        balance = 0, isOnline = true, status = "online"
    )

    companion object {
        private const val TAG = "OfflineQueueProcessor"
        private const val BASE_BACKOFF_MS = 1000L
        private const val MAX_BACKOFF_MS = 120_000L
        private const val BATCH_SIZE = 20
        private const val SYNC_INTERVAL_MS = 30_000L
        private const val MAX_RETRY_ATTEMPTS = 50
        private const val TTL_MS = 86_400_000L // 24 jam
    }
}
