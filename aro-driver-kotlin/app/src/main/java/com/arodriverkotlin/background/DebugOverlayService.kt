package com.arodriverkotlin.background

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.annotation.RequiresApi
import com.arodriverkotlin.database.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@RequiresApi(Build.VERSION_CODES.O)
class DebugOverlayService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var initialX = 0f
    private var initialY = 0f
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    private const val TAG = "DebugOverlayService"
    private const val UPDATE_INTERVAL_MS = 2000L

    override fun onCreate() {
        super.onCreate()
        createOverlay()
        startUpdates()
    }

    private fun createOverlay() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val params = WindowManager.LayoutParams().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                type = WindowManager.LayoutParams.TYPE_PHONE
            }
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
            gravity = Gravity.TOP or Gravity.START
            width = WindowManager.LayoutParams.WRAP_CONTENT
            height = WindowManager.LayoutParams.WRAP_CONTENT
            x = 0
            y = 100
        }.also { layoutParams ->
            overlayView = LayoutInflater.from(this).inflate(com.arodriverkotlin.R.layout.debug_overlay, null)
            windowManager?.addView(overlayView, layoutParams)

            overlayView?.setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x.toFloat()
                        initialY = params.y.toFloat()
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = (initialX + event.rawX - initialTouchX).toInt()
                        params.y = (initialY + event.rawY - initialTouchY).toInt()
                        windowManager?.updateViewLayout(overlayView!!, params)
                        true
                    }
                    else -> false
                }
            }
        }
    }

    private fun startUpdates() {
        scope.launch {
            while (!scope.isCancelled) {
                updateOverlay()
                delay(UPDATE_INTERVAL_MS)
            }
        }
    }

    private fun updateOverlay() {
        if (overlayView == null) return

        try {
            val uid = getStoredUid() ?: "N/A"
            val locationDao = AppDatabase.getInstance(this).locationDao()
            val pendingCount = locationDao.getPendingCount(uid)
            val actionDao = AppDatabase.getInstance(this).actionQueueDao()
            val pendingActions = actionDao.getPendingCount(uid)
            
            val tripState = AppDatabase.getInstance(this).tripStateDao().getState(uid)
            val tripStateStr = tripState?.state ?: "IDLE"
            
            val foregroundService = com.arodriverkotlin.service.ForegroundService
            val currentLat = foregroundService.latestLat
            val currentLng = foregroundService.latestLng
            val hasActiveTrip = foregroundService.currentOrderId != null

            val text = StringBuilder()
            text.appendLine("🔧 DEBUG OVERLAY")
            text.appendLine("UID: $uid")
            text.appendLine("Trip State: $tripStateStr")
            text.appendLine("Active Trip: ${if (hasActiveTrip) "YES" else "NO"}")
            text.appendLine("Order ID: ${foregroundService.currentOrderId ?: "N/A"}")
            text.appendLine("GPS: ${if (currentLat != null) String.format("%.6f, %.6f", currentLat, currentLng) else "N/A"}")
            text.appendLine("Pending Locations: $pendingCount")
            text.appendLine("Pending Actions: $pendingActions")
            text.appendLine("Buffer Size: ${foregroundService.locationBufferSize}")

            val textView = overlayView?.findViewById<TextView>(com.arodriverkotlin.R.id.debug_text)
            textView?.text = text.toString()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to update overlay", e)
        }
    }

    private fun getStoredUid(): String? {
        return getSharedPreferences("foreground_service", MODE_PRIVATE)
            .getString("driver_uid", null)
    }

    override fun onDestroy() {
        scope.cancel()
        if (overlayView != null) {
            windowManager?.removeView(overlayView)
            overlayView = null
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        fun start(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(Intent(context, DebugOverlayService::class.java))
            } else {
                context.startService(Intent(context, DebugOverlayService::class.java))
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, DebugOverlayService::class.java))
        }
    }
}