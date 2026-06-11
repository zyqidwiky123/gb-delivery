package com.arodriverkotlin.service

import com.arodriverkotlin.models.BankAccount
import com.arodriverkotlin.models.CustomerInfo
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.models.OrderItem
import com.arodriverkotlin.models.PickupPoint
import com.arodriverkotlin.models.ReceiverInfo
import com.arodriverkotlin.models.SenderInfo
import com.arodriverkotlin.models.Transaction
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot

fun DocumentSnapshot.toProfile(): DriverProfile {
    val raw = get("bankAccounts")
    val accounts = when (raw) {
        is List<*> -> raw.mapNotNull { item ->
            when (item) {
                is Map<*, *> -> BankAccount(
                    bankName = item["bankName"] as? String ?: "",
                    accountNumber = item["accountNumber"] as? String ?: "",
                    accountHolder = item["accountHolder"] as? String ?: "",
                )
                else -> null
            }
        }
        else -> emptyList()
    }
    return DriverProfile(
        id = id,
        name = getString("name") ?: "Driver",
        email = getString("email") ?: "",
        phone = getString("phone") ?: getString("whatsapp") ?: "",
        displayName = getString("displayName") ?: getString("name") ?: "Driver",
        vehicleType = getString("vehicleType") ?: "-",
        plateNumber = getString("plateNumber") ?: "-",
        level = getString("level") ?: "Mitra",
        rating = getDouble("rating") ?: 0.0,
        balance = getLong("balance") ?: 0,
        isOnline = getBoolean("isOnline") ?: false,
        completedOrders = (getLong("completedOrders") ?: getLong("totalCompleted") ?: 0).toInt(),
        status = getString("status") ?: "offline",
        photoUrl = getString("photoUrl") ?: "",
        qrisUrl = getString("qrisUrl") ?: "",
        bankAccounts = accounts,
        onlineTimestamp = getTimestamp("onlineAt")?.toDate()?.time,
        offlineTimestamp = getTimestamp("offlineAt")?.toDate()?.time,
    )
}

@Suppress("UNCHECKED_CAST")
fun DocumentSnapshot.toOrder(): DriverOrder {
    val dispatch = get("dispatch") as? Map<String, Any?>
    val pickupsRaw = get("pickups") as? List<Map<String, Any?>>
    val pickups = pickupsRaw?.map { p ->
        val loc = p["location"] as? Map<String, Double>
        PickupPoint(
            address = p["address"] as? String ?: "",
            lat = loc?.get("lat") ?: loc?.get("latitude"),
            lng = loc?.get("lng") ?: loc?.get("longitude"),
        )
    } ?: emptyList()
    val pickupCount = (pickupsRaw ?: (get("shopLocations") as? List<*>))?.size ?: 1

    val itemsRaw = get("items") as? List<Map<String, Any?>>
    val items = itemsRaw?.map { i ->
        OrderItem(
            name = i["name"] as? String ?: i["itemName"] as? String ?: "",
            qty = (i["qty"] as? Long)?.toInt() ?: (i["quantity"] as? Long)?.toInt() ?: 1,
            price = i["price"] as? Long ?: i["itemPrice"] as? Long ?: 0,
            desc = i["desc"] as? String ?: i["description"] as? String ?: "",
            isManual = i["isManual"] as? Boolean ?: false,
        )
    } ?: emptyList()

    val customer = get("customer") as? Map<String, Any?>
    val customerInfo = if (customer != null) CustomerInfo(
        name = customer["name"] as? String ?: "",
        phone = customer["phone"] as? String ?: customer["wa"] as? String ?: "",
        wa = customer["wa"] as? String ?: customer["phone"] as? String ?: "",
        isGuest = customer["isGuest"] as? Boolean ?: false,
    ) else CustomerInfo()

    val sender = get("sender") as? Map<String, Any?>
    val receiver = get("receiver") as? Map<String, Any?>

    val pickupLoc = get("pickupLocation") as? Map<String, Double>
    val dropLoc = get("destinationLocation") as? Map<String, Double>
    val merchantLoc = get("merchantLocation") as? Map<String, Double>
    val sourceLoc = pickupLoc ?: merchantLoc

    return DriverOrder(
        id = id,
        status = getString("status") ?: "-",
        serviceType = getString("serviceType") ?: "jek",
        total = getLong("total") ?: getDouble("total")?.toLong() ?: 0,
        deliveryFee = getLong("deliveryFee") ?: getDouble("deliveryFee")?.toLong() ?: 0,
        shoppingCost = getLong("shoppingCost") ?: 0,
        actualShoppingCost = getLong("actualShoppingCost") ?: 0,
        subtotal = getLong("subtotal") ?: 0,
        platformFee = getLong("platformFee") ?: 0,
        serviceFee = getLong("serviceFee") ?: 0,
        appServiceFee = getLong("appServiceFee") ?: 0,
        pickupFee = getLong("pickupFee") ?: 0,
        pickupDistance = getDouble("pickupDistance") ?: 0.0,
        subsidizedFee = getLong("subsidizedFee") ?: 0,
        customerName = customerInfo.name.ifEmpty { getString("customerName") ?: getString("userName") ?: "Customer" },
        customerPhone = customerInfo.phone.ifEmpty { getString("customerPhone") ?: getString("userPhone") ?: "" },
        customer = customerInfo,
        sender = if (sender != null) SenderInfo(
            name = sender["name"] as? String ?: "",
            phone = sender["phone"] as? String ?: "",
        ) else null,
        receiver = if (receiver != null) ReceiverInfo(
            name = receiver["name"] as? String ?: "",
            phone = receiver["phone"] as? String ?: "",
        ) else null,
        pickupAddress = getString("pickupAddress") ?: getString("merchantAddress") ?: "-",
        destinationAddress = getString("destinationAddress") ?: getString("dropoffAddress") ?: "-",
        merchantName = getString("merchantName") ?: "",
        offeredTo = dispatch?.get("offeredTo") as? String,
        expiresAt = dispatch?.get("offerExpiresAt") as? Timestamp,
        pickupsDone = getLong("pickupsDone") ?: 0,
        pickupCount = pickupCount,
        pickups = pickups,
        items = items,
        itemsRaw = (get("items") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
        note = getString("note") ?: getString("instructions") ?: getString("notes") ?: "",
        pickupLat = sourceLoc?.get("lat") ?: sourceLoc?.get("latitude"),
        pickupLng = sourceLoc?.get("lng") ?: sourceLoc?.get("longitude"),
        dropLat = dropLoc?.get("lat") ?: dropLoc?.get("latitude"),
        dropLng = dropLoc?.get("lng") ?: dropLoc?.get("longitude"),
        paymentMethod = getString("paymentMethod") ?: "TUNAI",
        voucherUsed = getBoolean("voucherUsed") ?: false,
        balanceBefore = getLong("balanceBefore") ?: 0,
        balanceAfter = getLong("balanceAfter") ?: 0,
        completedAt = getTimestamp("completedAt"),
    )
}

fun DocumentSnapshot.toTransaction(): Transaction {
    return Transaction(
        id = id,
        type = getString("type") ?: getString("transactionType") ?: "debit",
        description = getString("description") ?: getString("note") ?: "-",
        amount = getLong("amount") ?: 0,
        createdAt = getTimestamp("createdAt")?.toDate()?.toString() ?: "-",
    )
}

fun Long.rupiah(): String = "Rp %,d".format(this).replace(',', '.')
