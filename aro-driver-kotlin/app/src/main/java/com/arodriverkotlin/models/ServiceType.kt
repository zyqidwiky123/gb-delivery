package com.arodriverkotlin.models

sealed class ServiceType(val key: String, val displayName: String) {

    object Transport : ServiceType("transport", "Transport") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("ARRIVING", "CANCELLED"),
            "ARRIVING" to listOf("ON_BOARD", "CANCELLED"),
            "ON_BOARD" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DROPPED_OFF", "CANCELLED"),
            "DROPPED_OFF" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Food : ServiceType("food", "Food") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("ARRIVING", "CANCELLED"),
            "ARRIVING" to listOf("WAITING_FOOD", "PICKED_UP", "CANCELLED"),
            "WAITING_FOOD" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Express : ServiceType("express", "Express") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_WAREHOUSE", "CANCELLED"),
            "AT_WAREHOUSE" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Send : ServiceType("send", "Send") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_PICKUP", "CANCELLED"),
            "AT_PICKUP" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Shop : ServiceType("shop", "Shop & Deliver") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_MERCHANT", "CANCELLED"),
            "AT_MERCHANT" to listOf("SHOPPING", "CANCELLED"),
            "SHOPPING" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    abstract val validTransitions: Map<String, List<String>>

    companion object {
        fun fromString(s: String): ServiceType = when (s.lowercase()) {
            "transport", "jek", "car", "ride", "ojek" -> Transport
            "food", "makanan" -> Food
            "express" -> Express
            "send", "kirim" -> Send
            "shop", "belanja" -> Shop
            else -> Transport
        }

        val allTypes: List<ServiceType> = listOf(Transport, Food, Express, Send, Shop)
    }
}
