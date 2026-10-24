@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.shifa.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.shifa.app.BuildConfig
import com.shifa.app.data.Pharmacy

/**
 * Pharmacy detail: address, location on a map, and contact. Reported stock is
 * intentionally not listed here — it surfaces through product search.
 */
@Composable
fun PharmacyDetailScreen(pharmacy: Pharmacy, onBack: () -> Unit) {
    val state = LocalLanguageState.current
    val strings = state.strings
    val context = LocalContext.current

    fun staticMapUrl(): String {
        val lat = pharmacy.latitude
        val lng = pharmacy.longitude
        return "https://maps.googleapis.com/maps/api/staticmap" +
            "?center=$lat,$lng&zoom=15&size=600x300" +
            "&markers=color:0x002A68|$lat,$lng" +
            "&key=${BuildConfig.MAPS_API_KEY}"
    }

    fun openInMaps() {
        val uri = Uri.parse(
            "geo:${pharmacy.latitude},${pharmacy.longitude}?q=${pharmacy.latitude},${pharmacy.longitude}(${pharmacy.name})",
        )
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(pharmacy.name) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = strings.back)
                }
            },
            actions = { LanguageMenu(state) },
        )
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        ) {
            Text(
                listOfNotNull(pharmacy.address, pharmacy.city).joinToString(", "),
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (pharmacy.verificationStatus == "verified") {
                    AssistChip(onClick = {}, label = { Text(strings.verified) })
                } else {
                    AssistChip(onClick = {}, label = { Text(strings.pendingVerification) })
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(strings.location, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Card(Modifier.fillMaxWidth()) {
                if (BuildConfig.MAPS_API_KEY.isNotBlank()) {
                    AsyncImage(
                        model = staticMapUrl(),
                        contentDescription = strings.location,
                        modifier = Modifier.fillMaxWidth().height(220.dp),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Text(strings.mapUnavailable, modifier = Modifier.padding(16.dp))
                }
            }
            TextButton(onClick = { openInMaps() }) {
                Text(strings.openInMaps)
            }

            if (!pharmacy.phone.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                TextButton(
                    onClick = {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${pharmacy.phone}"))
                        context.startActivity(intent)
                    },
                ) {
                    Icon(Icons.Filled.Phone, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("${strings.call} ${pharmacy.phone}")
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                strings.searchThisPharmacy,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
