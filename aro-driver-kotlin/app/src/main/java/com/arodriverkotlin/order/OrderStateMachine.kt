package com.arodriverkotlin.order

import android.util.Log
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.TripState
import com.arodriverkotlin.models.ServiceType
import kotlinx.coroutines.*

class OrderStateMachine<S : Enum<S>>(
    private val serviceType: ServiceType,
    private val uid: String,
    private val orderId: String,
    private val stateClass: Class<S>,
    private val onStateChanged: ((newState: S, hasActiveTrip: Boolean) -> Unit)? = null
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile var currentState: S = initialTransitions()
        private set
    @Volatile var currentOrderId: String? = orderId
        private set

    companion object {
        private const val TAG = "OrderStateMachine"
    }

    suspend fun transitionTo(newState: S): Boolean {
        val newStateName = newState.name
        val currentStateName = currentState.name

        val allowed = serviceType.validTransitions[currentStateName] ?: emptyList()
        if (newStateName !in allowed) {
            Log.w(TAG, "Invalid transition: $currentStateName → $newStateName for ${serviceType.key}")
            return false
        }

        currentState = newState
        Log.i(TAG, "Transition: $currentStateName → $newStateName")

        persistState()
        syncState()

        val hasActiveTrip = newStateName !in listOf("COMPLETED", "CANCELLED", "EXPIRED")
        onStateChanged?.invoke(newState, hasActiveTrip)

        return true
    }

    suspend fun cancel(): Boolean {
        return try {
            val cancelledState = stateClass.enumConstants?.find {
                it.name == "CANCELLED"
            } as? S ?: return false
            transitionTo(cancelledState)
        } catch (e: Exception) {
            Log.w(TAG, "Cancel failed", e)
            false
        }
    }

    private fun initialTransitions(): S {
        return stateClass.enumConstants?.find { it.name == "OFFERED" }
            ?: stateClass.enumConstants?.first()
            ?: throw IllegalStateException("No enum constants for ${stateClass.simpleName}")
    }

    private suspend fun persistState() {
        try {
            val db = AppDatabase.getInstance(
                com.arodriverkotlin.AroDriverApplication.instance
            )
            val tripStateDao = db.tripStateDao()
            val currentVersion = tripStateDao.getState(uid)?.version ?: 0
            val state = TripState(
                uid = uid,
                state = currentState.name,
                orderId = orderId,
                serviceType = serviceType.key,
                updatedAt = System.currentTimeMillis(),
                version = currentVersion + 1
            )
            tripStateDao.upsert(state)
        } catch (e: Exception) {
            Log.w(TAG, "Persist failed", e)
        }
    }

    private suspend fun syncState() {
        try {
            com.arodriverkotlin.service.DriverService.updateTripState(
                uid, mutableMapOf(
                    "state" to currentState.name,
                    "orderId" to orderId,
                    "serviceType" to serviceType.key,
                    "updatedAt" to System.currentTimeMillis()
                )
            )
        } catch (e: Exception) {
            Log.w(TAG, "Sync failed", e)
        }
    }

    fun shutdown() {
        scope.cancel()
    }
}
