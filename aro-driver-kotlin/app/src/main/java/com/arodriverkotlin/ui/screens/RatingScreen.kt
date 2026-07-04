package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.arodriverkotlin.service.Rating
import com.arodriverkotlin.service.RatingService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RatingScreen(uid: String) {
    var average by remember { mutableFloatStateOf(0f) }
    var count by remember { mutableIntStateOf(0) }
    var ratings by remember { mutableStateOf<List<Rating>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(uid) {
        average = RatingService.getAverageRating(uid)
        count = RatingService.getRatingCount(uid)
        ratings = RatingService.getLatestRatings(uid)
        isLoading = false
    }

    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp)) {
        item {
            Text("Rating Saya", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("%.1f".format(average), style = MaterialTheme.typography.displayMedium)
                Spacer(Modifier.width(8.dp))
                repeat(5) { i ->
                    Icon(
                        imageVector = if (i < average.toInt()) Icons.Default.Star else Icons.Default.StarBorder,
                        contentDescription = null,
                        tint = if (i < average.toInt()) Color(0xFFFFB300) else Color(0xFFBDBDBD),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
            Text("%d ulasan".format(count), style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
        }
        items(ratings) { rating ->
            RatingItem(rating)
        }
    }
}

@Composable
private fun RatingItem(rating: Rating) {
    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text(rating.userName, style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(4.dp))
            Row {
                repeat(5) { i ->
                    Icon(
                        imageVector = if (i < rating.rating.toInt()) Icons.Default.Star else Icons.Default.StarBorder,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (i < rating.rating.toInt()) Color(0xFFFFB300) else Color(0xFFBDBDBD)
                    )
                }
            }
            if (rating.comment.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(rating.comment, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                SimpleDateFormat("dd/MM/yy HH:mm", Locale.getDefault())
                    .format(Date(rating.createdAt)),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline
            )
        }
    }
}
