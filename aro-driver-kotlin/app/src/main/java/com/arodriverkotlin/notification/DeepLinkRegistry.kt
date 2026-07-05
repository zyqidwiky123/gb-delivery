package com.arodriverkotlin.notification

import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.MainActivity

object DeepLinkRegistry {

    private val TAG = "DeepLinkRegistry"

    fun navigate(context: Context, deepLink: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val parts = deepLink.split("/", limit = 2)
        when (parts.getOrNull(0)) {
            "order" -> {
                intent.putExtra("navigate_to", "order_detail")
                intent.putExtra("orderId", parts.getOrNull(1) ?: "")
            }
            "chat" -> {
                intent.putExtra("navigate_to", "chat")
                intent.putExtra("chatId", parts.getOrNull(1) ?: "")
            }
            "wallet" -> {
                intent.putExtra("navigate_to", "wallet")
            }
            "profile" -> {
                intent.putExtra("navigate_to", "profile")
            }
            "history" -> {
                intent.putExtra("navigate_to", "history")
            }
            else -> {
                intent.putExtra("navigate_to", "home")
            }
        }

        context.startActivity(intent)
    }
}
