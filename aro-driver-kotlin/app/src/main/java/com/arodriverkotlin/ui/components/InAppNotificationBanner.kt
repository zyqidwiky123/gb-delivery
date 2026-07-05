package com.arodriverkotlin.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.notification.NotificationEngine
import com.arodriverkotlin.ui.theme.AroGreen

@Composable
fun InAppNotificationBanner() {
    val notif by NotificationEngine.InAppNotificationManager
        .currentNotification
        .collectAsState()
    val context = LocalContext.current

    AnimatedVisibility(
        visible = notif != null,
        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut()
    ) {
        notif?.let { n ->
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        n.deepLink?.let {
                            NotificationEngine.onNotificationClicked(context,
                                android.content.Intent().apply {
                                    putExtra("deepLink", it)
                                }
                            )
                        }
                        NotificationEngine.InAppNotificationManager.dismiss()
                    }
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                color = AroGreen.copy(alpha = 0.95f),
                shadowElevation = 8.dp,
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = n.title,
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = n.body,
                            color = Color.Black.copy(alpha = 0.7f),
                            fontSize = 12.sp
                        )
                    }
                    TextButton(onClick = {
                        NotificationEngine.InAppNotificationManager.dismiss()
                    }) {
                        Text("Tutup", color = Color.Black)
                    }
                }
            }
        }
    }
}
