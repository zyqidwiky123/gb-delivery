package com.arodriverkotlin.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.ServiceType

@Composable
fun OrderCardProvider(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val serviceType = remember(order.serviceType) {
        ServiceType.fromString(order.serviceType)
    }

    when (serviceType) {
        is ServiceType.Transport -> TransportOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Food -> FoodOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Express -> ExpressOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Send -> SendOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Shop -> ShopOrderCard(order, onAccept, onReject, modifier)
    }
}

@Composable
fun TransportOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    OrderCard(
        order = order,
        primary = null,
        secondary = null,
    )
}

@Composable
fun FoodOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    OrderCard(
        order = order,
        primary = null,
        secondary = null,
    )
}

@Composable
fun ExpressOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    OrderCard(
        order = order,
        primary = null,
        secondary = null,
    )
}

@Composable
fun SendOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    OrderCard(
        order = order,
        primary = null,
        secondary = null,
    )
}

@Composable
fun ShopOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit = {},
    onReject: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    OrderCard(
        order = order,
        primary = null,
        secondary = null,
    )
}
