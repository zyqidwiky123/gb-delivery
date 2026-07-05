package com.arodriverkotlin.background

enum class QueuePriority(val value: Int) {
    ORDER_ACTION(0),
    LOCATION_UPDATE(1),
    DIAGNOSTICS(2)
}
