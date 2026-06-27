package com.arodriverkotlin.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.AuthService
import com.arodriverkotlin.service.DriverService
import com.arodriverkotlin.service.ForegroundService
import com.arodriverkotlin.service.OrderService
import com.arodriverkotlin.service.WalletService
import com.arodriverkotlin.service.toOrder
import com.arodriverkotlin.service.toProfile
import com.arodriverkotlin.service.toTransaction
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.google.firebase.messaging.FirebaseMessaging
import android.util.Log
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.Calendar

class DriverViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var profileListener: ListenerRegistration? = null
    private var incomingListener: ListenerRegistration? = null
    private var activeListener: ListenerRegistration? = null
    private var allOrdersListener: ListenerRegistration? = null
    private var todayListener: ListenerRegistration? = null
    private var transactionsListener: ListenerRegistration? = null

    private var rtdbProfileRef: DatabaseReference? = null
    private var rtdbProfileListener: ValueEventListener? = null
    private var prevRtdbIsOnline: Boolean? = null

    private var prevIncomingCount = 0
    private var sessionJob: kotlinx.coroutines.Job? = null

    private var connectedRef: DatabaseReference? = null
    private var connectedListener: ValueEventListener? = null
    private var disconnectJob: kotlinx.coroutines.Job? = null
    private var retryDelay = 1_000L

    init {
        val user = AuthService.currentUser
        if (user == null) {
            _state.value = UiState(loading = false)
        } else {
            bindUser(user.uid)
        }
    }

    fun hadNewIncomingOrder(): Boolean {
        val current = _state.value.incoming.size
        val hadNew = current > prevIncomingCount
        prevIncomingCount = current
        return hadNew
    }

    fun login(email: String, password: String) = viewModelScope.launch {
        if (email.isBlank() || password.isBlank()) {
            postMessage("Email dan kata sandi wajib diisi.")
            return@launch
        }
        _state.value = _state.value.copy(loading = true, message = null)
        try {
            val user = AuthService.login(email, password)
            AuthService.ensureDriverProfile(user.uid, email)
            bindUser(user.uid)
        } catch (e: Exception) {
            _state.value = UiState(loading = false, message = AuthService.getErrorMessage(e))
        }
    }

    fun logout() {
        ForegroundService.stop(getApplication())
        clearListeners()
        AuthService.logout()
        _state.value = UiState(loading = false)
    }

    fun toggleOnline() = viewModelScope.launch {
        val uid = _state.value.userId
        if (uid == null) {
            _state.value = _state.value.copy(message = "Sesi tidak ditemukan")
            return@launch
        }
        val wasOnline = _state.value.profile?.isOnline ?: false
        val newOnline = !wasOnline
        _state.value = _state.value.copy(loading = true)
        try {
            DriverService.toggleOnline(uid, wasOnline)
            if (newOnline) {
                ForegroundService.start(getApplication(), uid)
            } else {
                ForegroundService.stop(getApplication())
            }
        } catch (e: Exception) {
            postMessage("Gagal: ${e.localizedMessage ?: "Error tidak dikenal"}")
        } finally {
            _state.value = _state.value.copy(loading = false)
        }
    }

    fun acceptOrder(orderId: String) = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        val profile = _state.value.profile ?: return@launch
        try {
            OrderService.acceptOrder(orderId, uid, profile)
            postMessage("Pesanan diterima.")
        } catch (e: Exception) {
            postMessage(e.message ?: "Gagal menerima pesanan.")
        }
    }

    fun arriveOrder(orderId: String) = viewModelScope.launch {
        try {
            OrderService.arriveAtPickup(orderId)
            postMessage("Status tiba diperbarui.")
        } catch (_: Exception) {}
    }

    fun cancelOrder(orderId: String, reason: String) = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        val profile = _state.value.profile ?: return@launch
        try {
            OrderService.cancelOrder(orderId, uid, profile, reason)
            postMessage("Pesanan dibatalkan.")
        } catch (e: Exception) {
            postMessage("Gagal membatalkan: ${e.message}")
        }
    }

    fun pickupOrder(orderId: String) = viewModelScope.launch {
        val order = _state.value.active.find { it.id == orderId } ?: return@launch
        try {
            OrderService.pickupOrder(orderId, order.pickupsDone, order.pickupCount)
            postMessage("Status pickup diperbarui.")
        } catch (_: Exception) {}
    }

    fun pickupWithCost(orderId: String, actualCost: Long) = viewModelScope.launch {
        val order = _state.value.active.find { it.id == orderId } ?: return@launch
        try {
            OrderService.pickupOrderWithCost(orderId, order.pickupsDone, order.pickupCount, actualCost)
            postMessage("Status pickup diperbarui.")
        } catch (_: Exception) {}
    }

    fun completeOrder(orderId: String) = viewModelScope.launch {
        val order = _state.value.active.find { it.id == orderId }
            ?: _state.value.allOrders.find { it.id == orderId }
            ?: return@launch
        val uid = _state.value.userId ?: return@launch
        val profile = _state.value.profile ?: return@launch
        try {
            OrderService.completeOrder(
                orderId = orderId,
                uid = uid,
                profile = profile,
                deliveryFee = order.deliveryFee,
                appServiceFee = order.appServiceFee,
                subsidizedFee = order.subsidizedFee,
                serviceType = order.serviceType,
                serviceFee = order.serviceFee,
            )
            postMessage("Pesanan selesai.")
        } catch (_: Exception) {}
    }

    fun rejectOrder(orderId: String) = viewModelScope.launch {
        try {
            OrderService.rejectOrder(orderId)
            postMessage("Pesanan ditolak.")
        } catch (e: Exception) {
            postMessage("Gagal menolak pesanan: ${e.message}")
        }
    }

    fun requestTopup(amount: Long, method: String = "manual") = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        val name = _state.value.profile?.name ?: "Driver"
        try {
            WalletService.requestTopup(uid, name, amount, method)
            postMessage("Top up diajukan.")
        } catch (_: Exception) {}
    }

    fun updateProfile(data: Map<String, Any>) = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        try {
            DriverService.updateProfile(uid, data)
            postMessage("Profile diperbarui.")
        } catch (_: Exception) {}
    }

    fun updateProfileFields(
        name: String? = null,
        whatsapp: String? = null,
        vehicleType: String? = null,
        plateNumber: String? = null,
        photoUrl: String? = null,
        qrisUrl: String? = null,
        bankAccounts: List<Map<String, String>>? = null,
    ) = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        val data = mutableMapOf<String, Any>()
        name?.let { data["name"] = it; data["displayName"] = it }
        whatsapp?.let { data["whatsapp"] = it; data["phone"] = it }
        vehicleType?.let { data["vehicleType"] = it }
        plateNumber?.let { data["plateNumber"] = it }
        photoUrl?.let { data["photoUrl"] = it }
        qrisUrl?.let { data["qrisUrl"] = it }
        bankAccounts?.let { data["bankAccounts"] = it }
        if (data.isNotEmpty()) {
            try {
                DriverService.updateProfile(uid, data)
                postMessage("Profile diperbarui.")
            } catch (_: Exception) {}
        }
    }

    fun dismissMessage() {
        _state.value = _state.value.copy(message = null)
    }

    fun dismissDisconnectDialog() {
        _state.value = _state.value.copy(showDisconnectDialog = false)
    }

    fun reconnect() {
        FirebaseDatabase.getInstance().goOnline()
        val uid = _state.value.userId
        if (uid != null) {
            clearListeners()
            bindListeners(uid)
            ForegroundService.start(getApplication(), uid)
        }
        retryDelay = 1_000L
        disconnectJob?.cancel()
        disconnectJob = null
        _state.value = _state.value.copy(showDisconnectDialog = false)
    }

    fun relogin() {
        _state.value = _state.value.copy(showDisconnectDialog = false)
        logout()
    }

    private fun bindUser(uid: String) {
        clearListeners()
        _state.value = _state.value.copy(loading = false, userId = uid)

        saveFcmToken(uid)

        val db = FirebaseFirestore.getInstance()

        startSessionWatcher(uid)

        db.collection("users").document(uid).get().addOnSuccessListener { userDoc ->
            val role = userDoc.getString("role")
            if (role != "driver") {
                _state.value = _state.value.copy(message = "ROLE_BLOCKED")
                logout()
            }
        }

        bindListeners(uid)
    }

    private fun bindListeners(uid: String) {
        val db = FirebaseFirestore.getInstance()

        profileListener = db.collection("drivers").document(uid)
            .addSnapshotListener { snap, error ->
                if (error != null) {
                    Log.w("PROFILE", "Snapshot listener error", error)
                    return@addSnapshotListener
                }
                if (snap == null || !snap.exists()) {
                    logout()
                    _state.value = _state.value.copy(message = "Sesi berakhir. Akun driver dihapus.")
                    return@addSnapshotListener
                }
                val current = _state.value.profile
                val fsProfile = snap.toProfile()
                val profile = fsProfile.copy(
                    isOnline = current?.isOnline ?: fsProfile.isOnline,
                    todayOnlineMs = current?.todayOnlineMs ?: fsProfile.todayOnlineMs,
                    onlineSessionStartTimestamp = current?.onlineSessionStartTimestamp
                        ?: fsProfile.onlineSessionStartTimestamp,
                    onlineTimestamp = current?.onlineTimestamp ?: fsProfile.onlineTimestamp,
                    offlineTimestamp = current?.offlineTimestamp ?: fsProfile.offlineTimestamp,
                    lastActiveTimestamp = current?.lastActiveTimestamp
                        ?: fsProfile.lastActiveTimestamp,
                    lastLocationUpdateTimestamp = current?.lastLocationUpdateTimestamp
                        ?: fsProfile.lastLocationUpdateTimestamp,
                )
                _state.value = _state.value.copy(profile = profile)
                if (profile.isOnline && profile.status == "busy") {
                    db.collection("orders")
                        .whereEqualTo("driverId", uid)
                        .whereIn("status", listOf("accepted", "arriving", "picked_up"))
                        .get().addOnSuccessListener { orderSnap ->
                            if (orderSnap.isEmpty) {
                                db.collection("drivers").document(uid).update(
                                    "status", "online",
                                    "updatedAt", FieldValue.serverTimestamp(),
                                )
                            }
                        }
                }
            }

        val rtdb = FirebaseDatabase.getInstance().reference
        rtdbProfileRef = rtdb.child("drivers/$uid")
        rtdbProfileListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val currentProfile = _state.value.profile
                val isOnline = snapshot.child("isOnline").getValue(Boolean::class.java)
                    ?: currentProfile?.isOnline ?: false
                val status = snapshot.child("status").getValue(String::class.java)
                    ?: currentProfile?.status ?: "offline"
                val todayOnlineMs = snapshot.child("todayOnlineMs").getValue(Long::class.java)
                    ?: currentProfile?.todayOnlineMs ?: 0
                val onlineTs = snapshot.child("onlineAt").getValue(Long::class.java)
                val offlineTs = snapshot.child("offlineAt").getValue(Long::class.java)
                val lastActiveTs = snapshot.child("lastActive").getValue(Long::class.java)
                val lastLocUpdateTs = snapshot.child("lastLocationUpdate").getValue(Long::class.java)
                val sessionStartTs = snapshot.child("onlineSessionStartAt").getValue(Long::class.java)
                val lat = snapshot.child("location/lat").getValue(Double::class.java)
                val lng = snapshot.child("location/lng").getValue(Double::class.java)

                if (prevRtdbIsOnline == null) {
                    prevRtdbIsOnline = isOnline
                    listenIncoming(uid, isOnline)
                    if (isOnline) {
                        ForegroundService.start(getApplication(), uid)
                    }
                } else if (isOnline != prevRtdbIsOnline) {
                    listenIncoming(uid, isOnline)
                    prevRtdbIsOnline = isOnline
                }

                val profile = currentProfile ?: return
                _state.value = _state.value.copy(
                    profile = profile.copy(
                        isOnline = isOnline,
                        status = status,
                        todayOnlineMs = todayOnlineMs,
                        onlineTimestamp = onlineTs,
                        offlineTimestamp = offlineTs,
                        lastActiveTimestamp = lastActiveTs,
                        lastLocationUpdateTimestamp = lastLocUpdateTs,
                        onlineSessionStartTimestamp = sessionStartTs,
                    ),
                    currentLat = lat ?: _state.value.currentLat,
                    currentLng = lng ?: _state.value.currentLng,
                )
            }

            override fun onCancelled(error: DatabaseError) {
                Log.w("RTDB", "Profile listener error", error.toException())
            }
        }
        rtdbProfileRef?.addValueEventListener(rtdbProfileListener!!)

        connectedRef = FirebaseDatabase.getInstance().getReference(".info/connected")
        connectedListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val connected = snapshot.getValue(Boolean::class.java) ?: false
                val isOnline = _state.value.profile?.isOnline == true
                _state.value = _state.value.copy(isConnected = connected)

                if (!connected && isOnline) {
                    viewModelScope.launch {
                        delay(retryDelay)
                        retryDelay = (retryDelay * 2).coerceAtMost(30_000L)
                        FirebaseDatabase.getInstance().goOnline()
                        val uid = _state.value.userId
                        if (uid != null) {
                            rtdbProfileRef?.let { ref ->
                                rtdbProfileListener?.let { ref.removeEventListener(it) }
                            }
                            listenIncoming(uid, true)
                        }
                    }

                    if (disconnectJob?.isActive != true) {
                        disconnectJob = viewModelScope.launch {
                            var elapsed = 0L
                            while (elapsed < 30_000) {
                                delay(5_000)
                                elapsed += 5_000
                                if (_state.value.isConnected) break
                            }
                            if (!_state.value.isConnected && _state.value.profile?.isOnline == true) {
                                _state.value = _state.value.copy(showDisconnectDialog = true)
                            }
                        }
                    }
                } else if (connected) {
                    retryDelay = 1_000L
                    disconnectJob?.cancel()
                    disconnectJob = null
                    if (_state.value.showDisconnectDialog) {
                        _state.value = _state.value.copy(showDisconnectDialog = false)
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {}
        }
        connectedRef?.addValueEventListener(connectedListener!!)

        activeListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereIn("status", listOf("accepted", "arriving", "picked_up"))
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() } ?: emptyList()
                _state.value = _state.value.copy(active = list)
                ForegroundService.currentOrderId = list.firstOrNull()?.id
            }

        todayListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereEqualTo("status", "completed")
            .addSnapshotListener { snap, _ ->
                val allCompleted = snap?.documents?.map { it.toOrder() } ?: emptyList()
                val cal = Calendar.getInstance()
                val currentDay = cal.get(Calendar.DAY_OF_YEAR)
                val currentYear = cal.get(Calendar.YEAR)
                val todayOrders = allCompleted.filter { order ->
                    order.completedAt?.toDate()?.let { date ->
                        val c = Calendar.getInstance().apply { time = date }
                        c.get(Calendar.DAY_OF_YEAR) == currentDay && c.get(Calendar.YEAR) == currentYear
                    } ?: false
                }
                val currentMonth = cal.get(Calendar.MONTH)
                val monthlyOrders = allCompleted.filter { order ->
                    order.completedAt?.toDate()?.let { date ->
                        val c = Calendar.getInstance().apply { time = date }
                        c.get(Calendar.MONTH) == currentMonth && c.get(Calendar.YEAR) == currentYear
                    } ?: false
                }
                _state.value = _state.value.copy(
                    completedToday = todayOrders,
                    todayEarnings = todayOrders.sumOf { it.deliveryFee },
                    monthlyEarnings = monthlyOrders.sumOf { it.deliveryFee },
                )
            }

        allOrdersListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() }
                    ?.sortedByDescending { it.acceptedAt?.toDate()?.time ?: 0L }
                    ?: emptyList()
                _state.value = _state.value.copy(allOrders = list)
            }

        transactionsListener = db.collection("drivers").document(uid)
            .collection("transactions")
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toTransaction() } ?: emptyList()
                _state.value = _state.value.copy(allTransactions = list)
            }

        listenIncoming(uid, _state.value.profile?.isOnline == true)
    }

    private fun listenIncoming(uid: String, online: Boolean) {
        incomingListener?.remove()
        incomingListener = null
        if (!online) {
            _state.value = _state.value.copy(incoming = emptyList())
            return
        }
        incomingListener = FirebaseFirestore.getInstance().collection("orders")
            .whereEqualTo("status", "searching")
            .whereEqualTo("dispatch.offeredTo", uid)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() } ?: emptyList()
                _state.value = _state.value.copy(incoming = list)
            }
    }

    private fun startSessionWatcher(uid: String) {
        sessionJob?.cancel()
        sessionJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                val profile = _state.value.profile ?: continue
                val now = System.currentTimeMillis()

                // Firestore health check
                try {
                    FirebaseFirestore.getInstance()
                        .collection("settings").document("platform")
                        .get()
                        .await()
                } catch (_: Exception) {
                    if (_state.value.profile?.isOnline == true) {
                        reconnect()
                    }
                    continue
                }

                if (profile.isOnline) {
                    // Daily limit check: >=12 jam hari ini
                    if (profile.todayOnlineMs >= 12 * 3600_000L) {
                        try {
                            DriverService.toggleOnline(uid, true)
                            postMessage("Batas online 12 jam hari ini tercapai.")
                        } catch (_: Exception) {}
                        continue
                    }

                } else {
                    // Auto-logout after 10 minutes offline
                    val offlineSince = profile.offlineTimestamp
                    if (offlineSince != null && (now - offlineSince) > 10 * 60_000L) {
                        postMessage("Offline terlalu lama, logout otomatis.")
                        logout()
                    }
                }
            }
        }
    }

    private fun clearListeners() {
        sessionJob?.cancel()
        sessionJob = null
        disconnectJob?.cancel()
        disconnectJob = null
        listOf(profileListener, incomingListener, activeListener, todayListener, allOrdersListener, transactionsListener)
            .forEach { it?.remove() }
        profileListener = null
        incomingListener = null
        activeListener = null
        todayListener = null
        allOrdersListener = null
        transactionsListener = null
        rtdbProfileRef?.let { ref ->
            rtdbProfileListener?.let { ref.removeEventListener(it) }
        }
        rtdbProfileRef = null
        rtdbProfileListener = null
        prevRtdbIsOnline = null
        connectedRef?.let { ref ->
            connectedListener?.let { ref.removeEventListener(it) }
        }
        connectedRef = null
        connectedListener = null
    }

    private fun postMessage(message: String) {
        _state.value = _state.value.copy(message = message)
    }

    private fun saveFcmToken(uid: String) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                FirebaseFirestore.getInstance().collection("drivers").document(uid)
                    .set(mapOf("fcmToken" to token, "updatedAt" to FieldValue.serverTimestamp()), SetOptions.merge())
            } else {
                android.util.Log.w("FCM", "Gagal ambil token", task.exception)
            }
        }
    }

    override fun onCleared() {
        clearListeners()
    }
}
