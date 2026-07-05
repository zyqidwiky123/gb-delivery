package com.arodriverkotlin.order.handler

import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.order.FoodState
import com.arodriverkotlin.service.DriverService
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class FoodHandler {

    private val db = FirebaseFirestore.getInstance()

    suspend fun onArrivedAtMerchant(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "arriving",
                "arrivingAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onWaitingFood(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "waiting_food",
                "waitingFoodAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onFoodPickedUp(orderId: String, driverUid: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "picked_up",
                "pickedUpAt", FieldValue.serverTimestamp()
            )
            .await()
        DriverService.updateTripState(driverUid, mutableMapOf(
            "state" to FoodState.EN_ROUTE.name,
            "orderId" to orderId,
            "updatedAt" to System.currentTimeMillis()
        ))
    }

    suspend fun onFoodDelivered(orderId: String, driverUid: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "delivered",
                "deliveredAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onTripCompleted(orderId: String, driverUid: String, profile: DriverProfile) {
    }
}
