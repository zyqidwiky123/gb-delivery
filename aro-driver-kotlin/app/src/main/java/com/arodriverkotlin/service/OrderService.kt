package com.arodriverkotlin.service

import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.DriverProfile
import kotlinx.coroutines.tasks.await
import kotlin.math.max
import kotlin.math.roundToLong

object OrderService {
    private val db = FirebaseFirestore.getInstance()
    private val rtdb = FirebaseDatabase.getInstance().reference

    fun listenIncoming(uid: String, onResult: (List<DriverOrder>) -> Unit): ListenerRegistration {
        return db.collection("orders")
            .whereEqualTo("status", "searching")
            .whereEqualTo("dispatch.offeredTo", uid)
            .addSnapshotListener { snap, _ ->
                onResult(snap?.documents?.map { it.toOrder() } ?: emptyList())
            }
    }

    fun listenActive(uid: String, onResult: (List<DriverOrder>) -> Unit): ListenerRegistration {
        return db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereIn("status", listOf("accepted", "picked_up"))
            .addSnapshotListener { snap, _ ->
                onResult(snap?.documents?.map { it.toOrder() } ?: emptyList())
            }
    }

    fun listenAllOrders(uid: String, onResult: (List<DriverOrder>) -> Unit): ListenerRegistration {
        return db.collection("orders")
            .whereEqualTo("driverId", uid)
            .orderBy("acceptedAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snap, _ ->
                onResult(snap?.documents?.map { it.toOrder() } ?: emptyList())
            }
    }

    fun listenCompletedToday(uid: String, onResult: (List<DriverOrder>) -> Unit): ListenerRegistration {
        return db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereEqualTo("status", "completed")
            .addSnapshotListener { snap, _ ->
                onResult(snap?.documents?.map { it.toOrder() } ?: emptyList())
            }
    }

    suspend fun acceptOrder(orderId: String, uid: String, profile: DriverProfile) {
        try {
            db.runTransaction { tx ->
                val orderRef = db.collection("orders").document(orderId)
                val driverRef = db.collection("drivers").document(uid)
                val snap = tx.get(orderRef)
                val driverSnap = tx.get(driverRef)
                val balance = driverSnap.getLong("balance") ?: 0
                if (balance < 0) error("Saldo tidak mencukupi. Silakan top up.")
                if (snap.getString("status") != "searching") error("Order sudah diambil.")
                if (snap.getString("dispatch.offeredTo") != uid) error("Order ini bukan untuk Anda.")
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
        } catch (e: Exception) {
            throw e
        }
    }

    suspend fun arriveAtPickup(orderId: String) {
        db.collection("orders").document(orderId).update(
            mapOf(
                "status" to "arriving",
                "arrivingAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }

    suspend fun rejectOrder(orderId: String) {
        db.collection("orders").document(orderId).update(
            mapOf(
                "dispatch.status" to "rejected",
                "dispatch.rejectedAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }

    suspend fun cancelOrder(orderId: String, uid: String, profile: DriverProfile, reason: String) {
        db.runTransaction { tx ->
            val orderRef = db.collection("orders").document(orderId)
            val driverRef = db.collection("drivers").document(uid)
            tx.update(orderRef, mapOf(
                "status" to "cancelled",
                "reason" to reason,
                "driverId" to uid,
                "cancelledAt" to FieldValue.serverTimestamp(),
            ))
            tx.update(driverRef, mapOf(
                "status" to "online",
                "isOnline" to true,
                "onlineAt" to FieldValue.serverTimestamp(),
            ))
        }.await()
        rtdb.child("drivers/$uid").updateChildren(hashMapOf(
            "isOnline" to true,
            "status" to "online",
            "onlineAt" to ServerValue.TIMESTAMP,
            "lastActive" to ServerValue.TIMESTAMP,
        )).await()

        // Cancellation penalty
        try {
            val scoreSnap = db.collection("drivers").document(uid).get().await()
            val totalTrips = scoreSnap.getLong("totalTrips") ?: 0
            if (totalTrips > 10) {
                val cancellations = scoreSnap.getLong("cancellations") ?: 0
                val rate = if (totalTrips > 0) cancellations.toDouble() / totalTrips else 0.0
                if (rate > 0.2) {
                    val penalty = DriverScoreService.getCancellationPenalty(uid)
                    db.collection("drivers").document(uid)
                        .update("balance", FieldValue.increment(-penalty)).await()
                    db.collection("drivers").document(uid)
                        .collection("penalties").add(mapOf(
                            "amount" to penalty,
                            "reason" to "cancellation_rate_exceeded",
                            "orderId" to orderId,
                            "createdAt" to FieldValue.serverTimestamp()
                        )).await()
                }
            }
        } catch (_: Exception) {}
    }

    suspend fun pickupOrder(orderId: String, pickupsDone: Long, pickupCount: Int) {
        val nextDone = pickupsDone + 1
        val updates = mutableMapOf<String, Any>("pickupsDone" to nextDone)
        if (nextDone >= kotlin.math.max(1, pickupCount).toLong()) {
            updates["status"] = "picked_up"
            updates["pickedUpAt"] = FieldValue.serverTimestamp()
        }
        db.collection("orders").document(orderId).update(updates).await()
    }

    suspend fun pickupOrderWithCost(orderId: String, pickupsDone: Long, pickupCount: Int, actualCost: Long) {
        val nextDone = pickupsDone + 1
        val updates = mutableMapOf<String, Any>("pickupsDone" to nextDone)
        if (actualCost > 0) {
            val snap = db.collection("orders").document(orderId).get().await()
            val currentShoppingCost = snap.getLong("actualShoppingCost") ?: 0
            val newShoppingCost = currentShoppingCost + actualCost
            updates["actualShoppingCost"] = newShoppingCost

            val deliveryFee = snap.getLong("deliveryFee") ?: 0
            val pickupFee = snap.getLong("pickupFee") ?: 0
            updates["total"] = newShoppingCost + deliveryFee + pickupFee
        }
        if (nextDone >= kotlin.math.max(1, pickupCount).toLong()) {
            updates["status"] = "picked_up"
            updates["pickedUpAt"] = FieldValue.serverTimestamp()
        }
        db.collection("orders").document(orderId).update(updates).await()
    }

    suspend fun completeOrder(
        orderId: String,
        uid: String,
        profile: DriverProfile,
        deliveryFee: Long,
        appServiceFee: Long = 0,
        subsidizedFee: Long = 0,
        serviceType: String = "jek",
        serviceFee: Long = 0,
    ) {
        // Hitung platform fee
        val platformFee = if (serviceFee > 0) {
            serviceFee
        } else {
            // Baca rate dari settings/pricing
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
            } catch (_: Exception) {}
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
}
