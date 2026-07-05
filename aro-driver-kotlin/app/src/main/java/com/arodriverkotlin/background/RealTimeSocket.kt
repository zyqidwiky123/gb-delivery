package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.arodriverkotlin.service.ConfigService
import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.pow
import kotlin.random.Random
import okhttp3.*
import org.json.JSONObject

class RealTimeSocket(
    private val context: Context,
    private val uid: String
) {
    enum class ConnectionState {
        DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
    }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private var retryCount = 0
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var okHttpClient: OkHttpClient? = null
    private var webSocket: WebSocket? = null
    private var rtdbListener: ChildEventListener? = null
    private var rtdbRef: com.google.firebase.database.DatabaseReference? = null
    private var useWebSocket = false
    private var wsUrl: String = ""

    var onOrderReceived: ((orderId: String) -> Unit)? = null
    var onConnected: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null
    var onReconnected: (() -> Unit)? = null

    companion object {
        private const val TAG = "RealTimeSocket"
        private const val BASE_RETRY_MS = 1000L
        private const val MAX_RETRY_MS = 30_000L
        private const val WS_PING_INTERVAL_MS = 30_000L

        private val instances = mutableMapOf<String, RealTimeSocket>()

        @Synchronized
        fun getInstance(context: Context, uid: String): RealTimeSocket {
            return instances.getOrPut(uid) { RealTimeSocket(context, uid) }
        }

        @Synchronized
        fun removeInstance(uid: String) {
            instances.remove(uid)?.disconnect()
        }
    }

    fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTED ||
            _connectionState.value == ConnectionState.CONNECTING) return

        _connectionState.value = ConnectionState.CONNECTING
        Log.i(TAG, "Connecting for uid=$uid")

        wsUrl = try {
            ConfigService.getString("websocket_url")
        } catch (_: Exception) { "" }

        useWebSocket = wsUrl.isNotBlank()
        if (useWebSocket) {
            connectWebSocket()
        } else {
            startRtdbListener()
        }
    }

    fun disconnect() {
        reconnectJob?.cancel()
        _connectionState.value = ConnectionState.DISCONNECTED
        retryCount = 0
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        okHttpClient?.dispatcher?.executorService?.shutdown()
        okHttpClient = null
        stopRtdbListener()
    }

    fun sendLocation(lat: Double, lng: Double) {
        if (useWebSocket && _connectionState.value == ConnectionState.CONNECTED) {
            val msg = JSONObject().apply {
                put("type", "location")
                put("uid", uid)
                put("lat", lat)
                put("lng", lng)
                put("timestamp", System.currentTimeMillis())
            }
            webSocket?.send(msg.toString())
        }
    }

    fun sendMessage(type: String, payload: Map<String, Any>) {
        if (!useWebSocket || _connectionState.value != ConnectionState.CONNECTED) return
        val msg = JSONObject(payload).apply {
            put("type", type)
            put("uid", uid)
            put("timestamp", System.currentTimeMillis())
        }
        webSocket?.send(msg.toString())
    }

    fun shutdown() {
        disconnect()
        scope.cancel()
    }

    private fun connectWebSocket() {
        try {
            val client = OkHttpClient.Builder()
                .pingInterval(WS_PING_INTERVAL_MS, java.util.concurrent.TimeUnit.MILLISECONDS)
                .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
                .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            okHttpClient = client

            val request = Request.Builder()
                .url("$wsUrl?uid=$uid")
                .build()

            webSocket = client.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(ws: WebSocket, response: Response) {
                    Log.i(TAG, "WebSocket connected for uid=$uid")
                    _connectionState.value = ConnectionState.CONNECTED
                    retryCount = 0
                    if (retryCount > 0) onReconnected?.invoke()
                    else onConnected?.invoke()
                    sendMessage("auth", mapOf("uid" to uid))
                }

                override fun onMessage(ws: WebSocket, text: String) {
                    handleWebSocketMessage(text)
                }

                override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                    Log.w(TAG, "WebSocket closing: code=$code reason=$reason")
                    ws.close(code, reason)
                }

                override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                    Log.i(TAG, "WebSocket closed: code=$code reason=$reason")
                    _connectionState.value = ConnectionState.DISCONNECTED
                    onDisconnected?.invoke()
                    scheduleReconnect()
                }

                override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                    Log.e(TAG, "WebSocket failure: ${t.message}", t)
                    _connectionState.value = ConnectionState.DISCONNECTED
                    onDisconnected?.invoke()
                    webSocket = null
                    scheduleReconnect()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create WebSocket", e)
            _connectionState.value = ConnectionState.DISCONNECTED
            startRtdbListener()
        }
    }

    private fun handleWebSocketMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.optString("type", "")
            when (type) {
                "new_order" -> {
                    val orderId = json.optString("orderId", "")
                    if (orderId.isNotBlank()) onOrderReceived?.invoke(orderId)
                }
                "order_update" -> {
                    val orderId = json.optString("orderId", "")
                    if (orderId.isNotBlank()) onOrderReceived?.invoke(orderId)
                }
                "location_ack" -> {
                    Log.d(TAG, "Location acknowledged by server")
                }
                "pong" -> {
                    Log.d(TAG, "Pong received")
                }
                "error" -> {
                    Log.w(TAG, "Server error: ${json.optString("message")}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse WebSocket message", e)
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            val delayMs = calculateBackoff()
            Log.w(TAG, "Reconnecting in ${delayMs}ms (attempt ${retryCount + 1})")
            _connectionState.value = ConnectionState.RECONNECTING
            delay(delayMs)
            retryCount++
            connect()
        }
    }

    private fun calculateBackoff(): Long {
        val base = BASE_RETRY_MS * (2.0).pow(retryCount).toLong()
        val jitter = (Random.nextDouble() * 0.2 - 0.1) * base
        return (base + jitter).toLong().coerceIn(BASE_RETRY_MS, MAX_RETRY_MS)
    }

    private fun startRtdbListener() {
        stopRtdbListener()
        rtdbRef = FirebaseDatabase.getInstance().reference
            .child("drivers").child(uid).child("incoming")

        val listener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val orderId = snapshot.key ?: return
                Log.i(TAG, "RTDB order received: $orderId")
                onOrderReceived?.invoke(orderId)
                snapshot.ref.removeValue()
            }
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {
                Log.w(TAG, "RTDB listener cancelled: ${error.message}")
                scheduleReconnect()
            }
        }
        rtdbListener = listener
        rtdbRef?.addChildEventListener(listener)

        _connectionState.value = ConnectionState.CONNECTED
        onConnected?.invoke()
        retryCount = 0
        Log.i(TAG, "RTDB listener started for uid=$uid")
    }

    private fun stopRtdbListener() {
        rtdbListener?.let { rtdbRef?.removeEventListener(it) }
        rtdbListener = null
        rtdbRef = null
    }
}
