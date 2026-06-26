package com.arodriverkotlin.models

data class UiState(
    val loading: Boolean = true,
    val userId: String? = null,
    val profile: DriverProfile? = null,
    val incoming: List<DriverOrder> = emptyList(),
    val active: List<DriverOrder> = emptyList(),
    val allOrders: List<DriverOrder> = emptyList(),
    val completedToday: List<DriverOrder> = emptyList(),
    val todayEarnings: Long = 0,
    val monthlyEarnings: Long = 0,
    val message: String? = null,
    val currentLat: Double? = null,
    val currentLng: Double? = null,
    val allTransactions: List<Transaction> = emptyList(),
    val isConnected: Boolean = true,
    val showDisconnectDialog: Boolean = false,
)
