@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.shifa.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Client
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product
import com.shifa.app.data.ProductAvailabilityBody
import com.shifa.app.data.PublicAvailabilityItem

/** Pharmacies that carry a selected product, with availability status. */
@Composable
fun ProductPharmaciesScreen(
    product: Product,
    onPharmacyClick: (Pharmacy) -> Unit,
    onBack: () -> Unit,
) {
    val state = LocalLanguageState.current
    val strings = state.strings
    var rows by remember { mutableStateOf<List<PublicAvailabilityItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(product.id) {
        loading = true
        error = null
        try {
            rows = Client.rest.inventoryByProducts(ProductAvailabilityBody(product.id))
        } catch (e: Exception) {
            error = friendlyError(e, strings)
        } finally {
            loading = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(listOfNotNull(product.canonicalName, product.strength).joinToString(" ")) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = strings.back)
                }
            },
        )
        when {
            loading -> LoadingState(strings.loading)
            error != null -> EmptyState(error.orEmpty())
            rows.isEmpty() -> EmptyState(strings.noCarrying)
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { Text(strings.carryingPharmacies, style = MaterialTheme.typography.titleMedium) }
                items(rows) { row ->
                    val pharmacy = Pharmacy(
                        id = row.pharmacyId,
                        name = row.pharmacyName,
                        slug = row.pharmacySlug,
                        address = row.pharmacyAddress,
                        city = row.pharmacyCity,
                        phone = row.pharmacyPhone,
                        verificationStatus = row.pharmacyVerificationStatus,
                        isActive = row.pharmacyIsActive,
                        latitude = row.pharmacyLatitude,
                        longitude = row.pharmacyLongitude,
                    )
                    val stale = run {
                        val lv = row.lastVerifiedAt
                        if (lv == null) true
                        else try {
                            java.time.Instant.parse(lv).isBefore(java.time.Instant.now().minus(java.time.Duration.ofHours(48)))
                        } catch (_: Exception) { true }
                    }
                    val availability = if (stale) null else row.availabilityStatus
                    val (availabilityLabel, availabilityColor) = when {
                        availability == "AVAILABLE" -> strings.inStock to Color(0xFF2E7D32)
                        availability == "LOW_STOCK" -> strings.lowStock to Color(0xFFF9A825)
                        else -> strings.callPharmacy to Color(0xFFC62828)
                    }
                    Card(onClick = { onPharmacyClick(pharmacy) }, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text(pharmacy.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    listOfNotNull(pharmacy.address, pharmacy.city).joinToString(", "),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (!row.size.isNullOrBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        row.size,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                AssistChip(
                                    onClick = {},
                                    label = { Text(availabilityLabel, color = availabilityColor) },
                                    leadingIcon = {
                                        Box(
                                            Modifier.size(10.dp).background(availabilityColor, CircleShape),
                                        )
                                    },
                                )
                            }
                        }
                }
            }
        }
    }
}
