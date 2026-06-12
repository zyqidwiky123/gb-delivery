package com.arodriverkotlin.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.AuthService
import com.arodriverkotlin.service.DriverService
import com.arodriverkotlin.service.OrderService
import com.arodriverkotlin.service.WalletService
import com.arodriverkotlin.service.toOrder
import com.arodriverkotlin.service.toProfile
import com.arodriverkotlin.service.toTransaction
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

class DriverViewModel : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var profileListener: ListenerRegistration? = null
    private var incomingListener: ListenerRegistration? = null
    private var activeListener: ListenerRegistration? = null
    private var allOrdersListener: ListenerRegistration? = null
    private var todayListener: ListenerRegistration? = null
    private var transactionsListener: ListenerRegistration? = null

    private var prevIncomingCount = 0
    private var lastLocationWrite = 0L
    private var sessionJob: kotlinx.coroutines.Job? = null

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
            val user = AuthService.loginOrRegister(email, password)
            AuthService.ensureDriverProfile(user.uid, email)
            bindUser(user.uid)
        } catch (e: Exception) {
            _state.value = UiState(loading = false, message = "Akses ditolak: ${e.message}")
        }
    }

    fun logout() {
        clearListeners()
        AuthService.logout()
        _state.value = UiState(loading = false)
    }

    fun toggleOnline() = viewModelScope.launch {
        val uid = _state.value.userId ?: return@launch
        val online = _state.value.profile?.isOnline ?: false
        try {
            DriverService.toggleOnline(uid, online)
        } catch (_: Exception) {}
    }

    fun updateLocation(lat: Double, lng: Double) = viewModelScope.launch {
        _state.value = _state.value.copy(currentLat = lat, currentLng = lng)
        val uid = _state.value.userId ?: return@launch
        val now = System.currentTimeMillis()
        if (now - lastLocationWrite < 20_000) return@launch
        lastLocationWrite = now
        try {
            DriverService.updateLocation(uid, lat, lng)
        } catch (_: Exception) {}
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

    private fun bindUser(uid: String) {
        clearListeners()
        _state.value = _state.value.copy(loading = false, userId = uid)

        saveFcmToken(uid)

        val db = FirebaseFirestore.getInstance()

        // Start session watcher
        startSessionWatcher(uid)

        // Role check
        db.collection("users").document(uid).get().addOnSuccessListener { userDoc ->
            val role = userDoc.getString("role")
            if (role != "driver") {
                _state.value = _state.value.copy(message = "ROLE_BLOCKED")
                logout()
            }
        }

        profileListener = db.collection("drivers").document(uid)
            .addSnapshotListener { snap, error ->
                if (error != null) return@addSnapshotListener
                if (snap == null || !snap.exists()) {
                    logout()
                    _state.value = _state.value.copy(message = "Sesi berakhir. Akun driver dihapus.")
                    return@addSnapshotListener
                }
                val profile = snap.toProfile()
                _state.value = _state.value.copy(profile = profile, loading = false)
                listenIncoming(uid, profile.isOnline)
                if (profile.isOnline && profile.status == "busy") {
                    db.collection("orders")
                        .whereEqualTo("driverId", uid)
                        .whereIn("status", listOf("accepted", "picked_up"))
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

        activeListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereIn("status", listOf("accepted", "picked_up"))
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() } ?: emptyList()
                _state.value = _state.value.copy(active = list)
            }

        todayListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .whereEqualTo("status", "completed")
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() } ?: emptyList()
                val todayEarnings = list.sumOf { it.deliveryFee }
                val cal = Calendar.getInstance()
                val currentMonth = cal.get(Calendar.MONTH)
                val currentYear = cal.get(Calendar.YEAR)
                val monthlyEarnings = list.filter { order ->
                    order.completedAt?.toDate()?.let { date ->
                        val c = Calendar.getInstance().apply { time = date }
                        c.get(Calendar.MONTH) == currentMonth && c.get(Calendar.YEAR) == currentYear
                    } ?: false
                }.sumOf { it.deliveryFee }
                _state.value = _state.value.copy(
                    completedToday = list,
                    todayEarnings = todayEarnings,
                    monthlyEarnings = monthlyEarnings,
                )
            }

        allOrdersListener = db.collection("orders")
            .whereEqualTo("driverId", uid)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { it.toOrder() } ?: emptyList()
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

                if (profile.isOnline) {
                    // Auto-offline after 12 hours continuous online
                    val onlineSince = profile.onlineTimestamp
                    if (onlineSince != null && (now - onlineSince) > 12 * 3600_000L) {
                        try {
                            DriverService.toggleOnline(uid, true)
                            postMessage("Sesi online 12 jam, otomatis offline.")
                        } catch (_: Exception) {}
                    }
                    // Location heartbeat: ensure lastLocationUpdate stays fresh
                    val lat = _state.value.currentLat
                    val lng = _state.value.currentLng
                    if (lat != null && lng != null) {
                        try {
                            DriverService.updateLocation(uid, lat, lng)
                            lastLocationWrite = now
                        } catch (_: Exception) {}
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
        listOf(profileListener, incomingListener, activeListener, todayListener, allOrdersListener, transactionsListener)
            .forEach { it?.remove() }
        profileListener = null
        incomingListener = null
        activeListener = null
        todayListener = null
        allOrdersListener = null
        transactionsListener = null
    }

    private fun postMessage(message: String) {
        _state.value = _state.value.copy(message = message)
    }

    private fun saveFcmToken(uid: String) {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            FirebaseFirestore.getInstance().collection("drivers").document(uid)
                .update("fcmToken", token, "updatedAt", FieldValue.serverTimestamp())
        }
    }

    override fun onCleared() {
        clearListeners()
    }
}
