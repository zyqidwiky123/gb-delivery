package com.arodriverkotlin.order.handler

import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.order.ShopState
import com.arodriverkotlin.service.DriverService
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class ShopHandler {

    private val db = FirebaseFirestore.getInstance()

    suspend fun onAtMerchant(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "at_merchant",
                "atMerchantAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onShopping(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "shopping",
                "shoppingAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onItemsPickedUp(orderId: String, driverUid: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "picked_up",
                "pickedUpAt", FieldValue.serverTimestamp()
            )
            .await()
        DriverService.updateTripState(driverUid, mutableMapOf(
            "state" to ShopState.EN_ROUTE.name,
            "orderId" to orderId,
            "updatedAt" to System.currentTimeMillis()
        ))
    }

    suspend fun onItemsDelivered(orderId: String, driverUid: String) {
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
