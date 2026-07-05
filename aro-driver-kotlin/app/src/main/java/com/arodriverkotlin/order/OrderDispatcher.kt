package com.arodriverkotlin.order

import android.util.Log
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.service.DriverService
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import kotlin.math.max
import kotlin.math.roundToLong

object OrderDispatcher {

    private const val TAG = "OrderDispatcher"
    private val db = FirebaseFirestore.getInstance()
    private val rtdb = FirebaseDatabase.getInstance().reference
    private val activeMachines = mutableMapOf<String, OrderStateMachine<*>>()

    fun createStateMachine(
        serviceType: ServiceType,
        uid: String,
        orderId: String,
        onStateChanged: ((state: Enum<*>, hasActiveTrip: Boolean) -> Unit)? = null
    ): OrderStateMachine<*> {
        val stateClass = when (serviceType) {
            is ServiceType.Transport -> TransportState::class.java
            is ServiceType.Food -> FoodState::class.java
            is ServiceType.Express -> ExpressState::class.java
            is ServiceType.Send -> SendState::class.java
            is ServiceType.Shop -> ShopState::class.java
        }

        @Suppress("UNCHECKED_CAST")
        val machine = OrderStateMachine(
            serviceType = serviceType,
            uid = uid,
            orderId = orderId,
            stateClass = stateClass as Class<Enum<*>>,
            onStateChanged = onStateChanged as? ((Enum<*>, Boolean) -> Unit)
        )
        activeMachines[orderId] = machine
        return machine
    }

    fun getStateMachine(orderId: String): OrderStateMachine<*>? = activeMachines[orderId]

    suspend fun acceptOrder(order: DriverOrder, uid: String, profile: DriverProfile) {
        val serviceType = ServiceType.fromString(order.serviceType)
        createStateMachine(serviceType, uid, order.id)
        Log.i(TAG, "Accepting ${serviceType.key} order ${order.id}")

        when (serviceType) {
            is ServiceType.Food -> handleFoodAccept(order, uid, profile)
            is ServiceType.Express -> handleExpressAccept(order, uid, profile)
            is ServiceType.Send -> handleSendAccept(order, uid, profile)
            is ServiceType.Shop -> handleShopAccept(order, uid, profile)
            else -> executeAcceptCore(order, uid, profile)
        }
    }

    suspend fun completeOrder(
        orderId: String, uid: String, profile: DriverProfile,
        deliveryFee: Long, appServiceFee: Long, subsidizedFee: Long,
        serviceType: String, serviceFee: Long
    ) {
        val type = ServiceType.fromString(serviceType)
        val finalServiceFee = when (type) {
            is ServiceType.Food -> serviceFee + calculateFoodExtraFee(orderId)
            is ServiceType.Shop -> serviceFee + calculateShoppingFee(orderId)
            else -> serviceFee
        }
        executeCompleteCore(orderId, uid, profile, deliveryFee, appServiceFee, subsidizedFee, serviceType, finalServiceFee)
    }

    suspend fun transitionOrder(orderId: String, action: String) {
        val machine = activeMachines[orderId] ?: return
        val targetState = findActionTargetState(machine.currentState.name, action) ?: return
        val target = machine.currentState::class.java.enumConstants?.find {
            (it as Enum<*>).name == targetState
        } as? Enum<*> ?: return
        @Suppress("UNCHECKED_CAST")
        (machine as OrderStateMachine<Enum<*>>).transitionTo(target as Enum<*>)
    }

    fun shutdown() {
        activeMachines.values.forEach { it.shutdown() }
        activeMachines.clear()
    }

    private suspend fun handleFoodAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        executeAcceptCore(order, uid, profile)
    }

    private suspend fun handleExpressAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        executeAcceptCore(order, uid, profile)
    }

    private suspend fun handleSendAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        executeAcceptCore(order, uid, profile)
    }

    private suspend fun handleShopAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        executeAcceptCore(order, uid, profile)
    }

    private suspend fun executeAcceptCore(order: DriverOrder, uid: String, profile: DriverProfile) {
        val orderId = order.id
        db.runTransaction { tx ->
            val orderRef = db.collection("orders").document(orderId)
            val driverRef = db.collection("drivers").document(uid)
            val snap = tx.get(orderRef)
            val driverSnap = tx.get(driverRef)
            val balance = driverSnap.getLong("balance") ?: 0
            if (balance < 0) throw AcceptOrderException("Saldo tidak mencukupi. Silakan top up.")
            if (snap.getString("status") != "searching") throw AcceptOrderException("Order sudah diambil.")
            if (snap.getString("dispatch.offeredTo") != uid) throw AcceptOrderException("Order ini bukan untuk Anda.")
            tx.update(orderRef, mapOf(
                "status" to "accepted",
                "driverId" to uid,
                "driverName" to profile.name,
                "driverPhone" to (profile.phone.ifEmpty { "" }),
                "driverPhoto" to (profile.photoUrl.ifEmpty { "" }),
                "acceptedAt" to FieldValue.serverTimestamp(),
                "pickupsDone" to 0,
                "dispatch.status" to "accepted",
            ))
            tx.update(driverRef, "status", "busy")
        }.await()
        rtdb.child("drivers/$uid").updateChildren(hashMapOf(
            "status" to "busy",
            "lastActive" to ServerValue.TIMESTAMP,
        )).await()
        rtdb.child("drivers/$uid/incoming/$orderId").removeValue().await()
    }

    private suspend fun executeCompleteCore(
        orderId: String, uid: String, profile: DriverProfile,
        deliveryFee: Long, appServiceFee: Long, subsidizedFee: Long,
        serviceType: String, serviceFee: Long
    ) {
        val platformFee = if (serviceFee > 0) {
            serviceFee
        } else {
            var rate = 0.1
            try {
                val pricingSnap = db.collection("settings").document("pricing").get().await()
                if (pricingSnap.exists()) {
                    val pricing = pricingSnap.data ?: emptyMap()
                    val type = pricing[serviceType] as? Map<*, *> ?: pricing["jek"] as? Map<*, *>
                    if (type != null) {
                        val commission = (type["commission"] as? Number)?.toDouble()
                        if (commission != null) rate = commission / 100.0
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Gagal baca commission type", e)
            }
            val commissionBase = max(0.0, (deliveryFee - appServiceFee).toDouble())
            (commissionBase * rate).roundToLong() + appServiceFee
        }

        val newBalance = profile.balance - platformFee + subsidizedFee
        val timestamp = FieldValue.serverTimestamp()

        db.collection("orders").document(orderId).update(
            mapOf(
                "status" to "completed",
                "platformFee" to platformFee,
                "balanceBefore" to profile.balance,
                "balanceAfter" to newBalance,
                "completedAt" to timestamp,
            )
        ).await()

        db.collection("drivers").document(uid).update(
            mapOf(
                "status" to "online",
                "isOnline" to true,
                "balance" to newBalance,
                "onlineAt" to timestamp,
                "lastJobAt" to timestamp,
                "updatedAt" to timestamp,
            )
        ).await()

        rtdb.child("drivers/$uid").updateChildren(hashMapOf(
            "isOnline" to true,
            "status" to "online",
            "onlineAt" to ServerValue.TIMESTAMP,
            "lastActive" to ServerValue.TIMESTAMP,
        )).await()
    }

    private suspend fun calculateFoodExtraFee(orderId: String): Long {
        return 0
    }

    private suspend fun calculateShoppingFee(orderId: String): Long {
        return 0
    }

    private fun findActionTargetState(currentState: String, action: String): String? {
        return when (action.lowercase()) {
            "accept" -> "ACCEPTED"
            "reject", "cancel" -> "CANCELLED"
            "arrive" -> "ARRIVING"
            "on_board" -> "ON_BOARD"
            "start_trip" -> "EN_ROUTE"
            "complete" -> when (currentState) {
                "EN_ROUTE" -> "DROPPED_OFF"
                "DELIVERED" -> "COMPLETED"
                "DROPPED_OFF" -> "COMPLETED"
                "PICKED_UP" -> "EN_ROUTE"
                "WAITING_FOOD" -> "PICKED_UP"
                "SHOPPING" -> "PICKED_UP"
                else -> "COMPLETED"
            }
            "picked_up" -> "PICKED_UP"
            "waiting_food" -> "WAITING_FOOD"
            "shopping" -> "SHOPPING"
            "at_merchant" -> "AT_MERCHANT"
            "at_warehouse" -> "AT_WAREHOUSE"
            "at_pickup" -> "AT_PICKUP"
            "delivered" -> "DELIVERED"
            "dropped_off" -> "DROPPED_OFF"
            else -> null
        }
    }
}

class AcceptOrderException(message: String) : Exception(message)
