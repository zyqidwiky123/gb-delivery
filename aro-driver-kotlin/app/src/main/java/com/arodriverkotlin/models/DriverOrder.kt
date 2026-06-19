package com.arodriverkotlin.models

import com.google.firebase.Timestamp

data class OrderItem(
    val name: String = "",
    val qty: Int = 1,
    val price: Long = 0,
    val desc: String = "",
    val isManual: Boolean = false,
)

data class CustomerInfo(
    val name: String = "",
    val phone: String = "",
    val wa: String = "",
    val isGuest: Boolean = false,
)

data class SenderInfo(
    val name: String = "",
    val phone: String = "",
)

data class ReceiverInfo(
    val name: String = "",
    val phone: String = "",
)

data class PickupPoint(
    val address: String = "",
    val lat: Double? = null,
    val lng: Double? = null,
)

data class DriverOrder(
    val id: String,
    val status: String,
    val serviceType: String,
    val total: Long,
    val deliveryFee: Long,
    val shoppingCost: Long = 0,
    val actualShoppingCost: Long = 0,
    val subtotal: Long = 0,
    val platformFee: Long = 0,
    val serviceFee: Long = 0,
    val appServiceFee: Long = 0,
    val pickupFee: Long = 0,
    val pickupDistance: Double = 0.0,
    val subsidizedFee: Long = 0,
    val customerName: String,
    val customerPhone: String = "",
    val customer: CustomerInfo = CustomerInfo(),
    val sender: SenderInfo? = null,
    val receiver: ReceiverInfo? = null,
    val pickupAddress: String,
    val destinationAddress: String,
    val merchantName: String = "",
    val offeredTo: String?,
    val expiresAt: Timestamp?,
    val pickupsDone: Long,
    val pickupCount: Int,
    val pickups: List<PickupPoint> = emptyList(),
    val items: List<OrderItem> = emptyList(),
    val itemsRaw: List<String> = emptyList(),
    val note: String = "",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val dropLat: Double? = null,
    val dropLng: Double? = null,
    val paymentMethod: String = "TUNAI",
    val voucherUsed: Boolean = false,
    val balanceBefore: Long = 0,
    val balanceAfter: Long = 0,
    val completedAt: Timestamp? = null,
    val acceptedAt: Timestamp? = null,
)
