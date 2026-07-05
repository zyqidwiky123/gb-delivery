package com.arodriverkotlin.order.handler

import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.order.TransportState
import com.arodriverkotlin.service.DriverService
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class TransportHandler {

    private val db = FirebaseFirestore.getInstance()

    suspend fun onPassengerBoarded(orderId: String) {
        db.collection("orders")
            .document(orderId)
            .update(
                "status", "en_route",
                "pickedUpAt", FieldValue.serverTimestamp()
            )
            .await()
    }

    suspend fun onTripStarted(orderId: String, driverUid: String) {
        DriverService.updateTripState(driverUid, mutableMapOf(
            "state" to TransportState.EN_ROUTE.name,
            "orderId" to orderId,
            "updatedAt" to System.currentTimeMillis()
        ))
    }

    suspend fun onTripCompleted(orderId: String, driverUid: String, profile: DriverProfile) {
    }
}
