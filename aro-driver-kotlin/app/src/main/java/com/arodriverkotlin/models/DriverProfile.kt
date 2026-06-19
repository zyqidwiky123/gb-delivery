package com.arodriverkotlin.models

data class BankAccount(
    val bankName: String = "",
    val accountNumber: String = "",
    val accountHolder: String = "",
)

data class DriverProfile(
    val id: String = "",
    val name: String = "Driver",
    val email: String = "",
    val phone: String = "",
    val displayName: String = "",
    val vehicleType: String = "-",
    val plateNumber: String = "-",
    val level: String = "Mitra",
    val rating: Double = 0.0,
    val balance: Long = 0,
    val isOnline: Boolean = false,
    val completedOrders: Int = 0,
    val status: String = "offline",
    val photoUrl: String = "",
    val qrisUrl: String = "",
    val bankAccounts: List<BankAccount> = emptyList(),
    val onlineTimestamp: Long? = null,
    val offlineTimestamp: Long? = null,
    val lastActiveTimestamp: Long? = null,
    val lastLocationUpdateTimestamp: Long? = null,
    val todayOnlineMs: Long = 0,
    val onlineSessionStartTimestamp: Long? = null,
)

data class Transaction(
    val id: String,
    val type: String,
    val description: String,
    val amount: Long,
    val createdAt: String,
)
