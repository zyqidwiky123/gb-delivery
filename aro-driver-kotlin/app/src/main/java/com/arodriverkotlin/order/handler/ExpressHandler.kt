package com.arodriverkotlin.order.handler

import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.order.ExpressState
import com.arodriverkotlin.service.DriverService
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class ExpressHandler {

    private val db = FirebaseFirestore.getInstance()

    suspend fun onAtWarehouse(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "at_warehouse",
                "atWarehouseAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onPackagePickedUp(orderId: String, driverUid: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "picked_up",
                "pickedUpAt", FieldValue.serverTimestamp()
            )
            .await()
        DriverService.updateTripState(driverUid, mutableMapOf(
            "state" to ExpressState.EN_ROUTE.name,
            "orderId" to orderId,
            "updatedAt" to System.currentTimeMillis()
        ))
    }

    suspend fun onPackageDelivered(orderId: String, driverUid: String) {
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
