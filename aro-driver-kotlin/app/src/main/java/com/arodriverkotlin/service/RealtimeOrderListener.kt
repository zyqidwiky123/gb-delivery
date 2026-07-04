package com.arodriverkotlin.service

import android.util.Log
import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase

class RealtimeOrderListener(
    private val uid: String,
    private val onOrderReceived: (orderId: String) -> Unit
) {
    private val rtdbRef = FirebaseDatabase.getInstance().reference
        .child("drivers").child(uid).child("incoming")
    private var listener: ChildEventListener? = null

    fun startListening() {
        stopListening()
        listener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val orderId = snapshot.key ?: return
                Log.i("RTDB_LISTENER", "Order received: $orderId")
                onOrderReceived(orderId)
                snapshot.ref.removeValue()
            }
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {
                Log.w("RTDB_LISTENER", "Listener cancelled: ${error.message}")
            }
        }
        rtdbRef.addChildEventListener(listener!!)
    }

    fun stopListening() {
        listener?.let { rtdbRef.removeEventListener(it) }
        listener = null
    }
}
