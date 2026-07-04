package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.TripState
import com.arodriverkotlin.service.OrderService
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await

class TripStateMachine(
    private val context: Context,
    private val uid: String,
    private val orderTimeoutManager: OrderTimeoutManager? = null,
    private val geofenceManager: GeofenceManager? = null,
    private val onTripStateChanged: ((hasActiveTrip: Boolean) -> Unit)? = null
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db = AppDatabase.getInstance(context)
    private val tripStateDao = db.tripStateDao()
    private val firestore = FirebaseFirestore.getInstance()
    private val rtdbRef = FirebaseDatabase.getInstance().reference

    private val mutex = Mutex()

    companion object {
        private const val TAG = "TripStateMachine"
        const val STATE_IDLE = "IDLE"
        const val STATE_OFFERED = "OFFERED"
        const val STATE_ACCEPTED = "ACCEPTED"
        const val STATE_ARRIVING = "ARRIVING"
        const val STATE_AT_PICKUP = "AT_PICKUP"
        const val STATE_PICKED_UP = "PICKED_UP"
        const val STATE_EN_ROUTE = "EN_ROUTE"
        const val STATE_AT_DROPOFF = "AT_DROPOFF"
        const val STATE_COMPLETED = "COMPLETED"
    }

    @Volatile private var currentState = STATE_IDLE
    @Volatile private var currentOrderId: String? = null
    @Volatile private var pickupLat: Double? = null
    @Volatile private var pickupLng: Double? = null
    @Volatile private var dropoffLat: Double? = null
    @Volatile private var dropoffLng: Double? = null

    fun getCurrentState(): String = currentState
    fun getCurrentOrderId(): String? = currentOrderId

    suspend fun transitionToOffered(orderId: String, pickupLat: Double, pickupLng: Double, dropoffLat: Double, dropoffLng: Double) = mutex.withLock {
        currentState = STATE_OFFERED
        currentOrderId = orderId
        this.pickupLat = pickupLat
        this.pickupLng = pickupLng
        this.dropoffLat = dropoffLat
        this.dropoffLng = dropoffLng
        awaitUpdateState()
    }

    suspend fun transitionToAccepted() = mutex.withLock {
        currentState = STATE_ACCEPTED
        currentOrderId?.let { orderTimeoutManager?.cancelTimeout(it) }
        awaitUpdateState()

        val orderId = currentOrderId ?: return@withLock
        pickupLat?.let { lat -> pickupLng?.let { lng -> geofenceManager?.addPickupGeofence(orderId, lat, lng) } }
        dropoffLat?.let { lat -> dropoffLng?.let { lng -> geofenceManager?.addDropoffGeofence(orderId, lat, lng) } }
        acknowledgeOrder(orderId)
        onTripStateChanged?.invoke(true)
    }

    suspend fun transitionToArriving() = mutex.withLock {
        currentState = STATE_ARRIVING
        awaitUpdateState()
    }

    suspend fun transitionToAtPickup() = mutex.withLock {
        currentState = STATE_AT_PICKUP
        awaitUpdateState()
    }

    suspend fun transitionToPickedUp() = mutex.withLock {
        currentState = STATE_PICKED_UP
        awaitUpdateState()
    }

    suspend fun transitionToEnRoute() = mutex.withLock {
        currentState = STATE_EN_ROUTE
        awaitUpdateState()
    }

    suspend fun transitionToAtDropoff() = mutex.withLock {
        currentState = STATE_AT_DROPOFF
        awaitUpdateState()
    }

    suspend fun transitionToCompleted() = mutex.withLock {
        currentOrderId?.let { geofenceManager?.removeGeofencesForOrder(it) }
        currentState = STATE_COMPLETED
        awaitUpdateState()
        onTripStateChanged?.invoke(false)
        clearOrder()
    }

    suspend fun transitionToCancelled() = mutex.withLock {
        currentOrderId?.let {
            orderTimeoutManager?.cancelTimeout(it)
            geofenceManager?.removeGeofencesForOrder(it)
            acknowledgeOrder(it)
        }
        currentState = STATE_IDLE
        clearOrder()
        awaitUpdateState()
        onTripStateChanged?.invoke(false)
    }

    private suspend fun awaitUpdateState() {
        val currentVersion = tripStateDao.getState(uid)?.version ?: 0
        val state = TripState(
            uid = uid,
            state = currentState,
            orderId = currentOrderId,
            pickupLat = pickupLat,
            pickupLng = pickupLng,
            dropoffLat = dropoffLat,
            dropoffLng = dropoffLng,
            updatedAt = System.currentTimeMillis(),
            version = currentVersion + 1
        )
        tripStateDao.upsert(state)
        syncToRtdb(state)
    }

    private suspend fun syncToRtdb(state: TripState) {
        try {
            com.arodriverkotlin.service.DriverService.updateTripState(uid, state.toMap())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to sync trip state to RTDB", e)
        }
    }

    private suspend fun acknowledgeOrder(orderId: String) {
        try {
            rtdbRef.child("drivers/$uid/incoming/$orderId").removeValue().await()
        } catch (_: Exception) {}
    }

    private fun clearOrder() {
        currentOrderId = null
        pickupLat = null
        pickupLng = null
        dropoffLat = null
        dropoffLng = null
    }

    fun handleGeofenceTransition(geofenceId: String, transitionType: Int) {
        scope.launch {
            val orderId = geofenceId.substringAfter("_")
            if (orderId != currentOrderId) return@launch

            when {
                geofenceId.startsWith("pickup_") && transitionType == com.google.android.gms.location.Geofence.GEOFENCE_TRANSITION_ENTER -> {
                    if (currentState == STATE_ARRIVING || currentState == STATE_ACCEPTED) {
                        transitionToAtPickup()
                        triggerAutoArrive()
                    }
                }
                geofenceId.startsWith("dropoff_") && transitionType == com.google.android.gms.location.Geofence.GEOFENCE_TRANSITION_ENTER -> {
                    if (currentState == STATE_EN_ROUTE || currentState == STATE_PICKED_UP) {
                        transitionToAtDropoff()
                        Log.i(TAG, "Arrived at dropoff for $orderId — manual confirmation required")
                    }
                }
            }
        }
    }

    private suspend fun triggerAutoArrive() {
        try {
            currentOrderId?.let { orderId ->
                OrderService.arriveAtPickup(orderId)
                Log.i(TAG, "Auto-arrive triggered for $orderId")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Auto-arrive failed", e)
        }
    }

    suspend fun loadPersistedState() {
        val localState = tripStateDao.getState(uid)
        var rtdbState: TripState? = null
        try {
            val snap = rtdbRef.child("drivers/$uid/tripState").get().await()
            if (snap.exists()) {
                rtdbState = TripState(
                    uid = uid,
                    state = snap.child("state").getValue(String::class.java) ?: STATE_IDLE,
                    orderId = snap.child("orderId").getValue(String::class.java),
                    pickupLat = snap.child("pickupLat").getValue(Double::class.java),
                    pickupLng = snap.child("pickupLng").getValue(Double::class.java),
                    dropoffLat = snap.child("dropoffLat").getValue(Double::class.java),
                    dropoffLng = snap.child("dropoffLng").getValue(Double::class.java),
                    updatedAt = snap.child("updatedAt").getValue(Long::class.java) ?: 0L,
                    version = snap.child("version").getValue(Int::class.java) ?: 0
                )
            }
        } catch (_: Exception) {}

        val stateToUse = when {
            rtdbState != null && localState != null && rtdbState.version > localState.version -> rtdbState
            rtdbState != null && localState == null -> rtdbState
            localState != null -> localState
            else -> return
        }
        applyState(stateToUse)
    }

    private fun applyState(state: TripState) {
        currentState = state.state
        currentOrderId = state.orderId
        pickupLat = state.pickupLat
        pickupLng = state.pickupLng
        dropoffLat = state.dropoffLat
        dropoffLng = state.dropoffLng
        if (currentState != STATE_IDLE && currentOrderId != null) {
            scope.launch { tripStateDao.upsert(state) }
        }
        Log.d(TAG, "Loaded persisted state: $currentState for order $currentOrderId")
    }

    fun shutdown() {
        scope.cancel()
    }

    private fun TripState.toMap(): MutableMap<String, Any> {
        return mutableMapOf<String, Any>().apply {
            put("state", state)
            put("orderId", orderId ?: "")
            put("pickupLat", pickupLat ?: 0.0)
            put("pickupLng", pickupLng ?: 0.0)
            put("dropoffLat", dropoffLat ?: 0.0)
            put("dropoffLng", dropoffLng ?: 0.0)
            put("updatedAt", updatedAt)
            put("version", version)
        }
    }
}
