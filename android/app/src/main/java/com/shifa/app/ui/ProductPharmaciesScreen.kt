@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.shifa.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.shifa.app.data.InventoryItem
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product

/** Pharmacies that carry a selected product, with availability status. */
@Composable
fun ProductPharmaciesScreen(
    product: Product,
    onPharmacyClick: (Pharmacy) -> Unit,
    onBack: () -> Unit,
) {
    val state = LocalLanguageState.current
    val strings = state.strings
    var rows by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(product.id) {
        loading = true
        error = null
        try {
            rows = Client.rest.inventoryByProducts(productIdFilter = "eq.${product.id}")
        } catch (e: Exception) {
            error = e.message ?: strings.somethingWentWrong
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
                    val pharmacy = row.pharmacies
                    if (pharmacy != null) {
                        val available = row.availabilityStatus == "AVAILABLE"
                        Card(onClick = { onPharmacyClick(pharmacy) }, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text(pharmacy.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    listOfNotNull(pharmacy.address, pharmacy.city).joinToString(", "),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(8.dp))
                                AssistChip(
                                    onClick = {},
                                    label = { Text(if (available) strings.inStock else strings.outOfStock) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
