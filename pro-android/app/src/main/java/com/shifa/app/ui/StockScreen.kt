package com.shifa.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Client
import com.shifa.app.data.InventoryItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockScreen(pharmacyId: String?, onBack: () -> Unit) {
    var items by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(pharmacyId) {
        if (pharmacyId == null) { loading = false; return@LaunchedEffect }
        try {
            items = Client.rest.inventory(pharmacyId = "eq.$pharmacyId")
        } catch (e: Exception) {
            error = e.message
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Stock") },
                navigationIcon = { IconButton(onClick = onBack) { Text("←") } },
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            when {
                loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                error != null -> Box(Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Error: ${error.orEmpty()}", color = MaterialTheme.colorScheme.error)
                }
                items.isEmpty() -> Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
                    Text("No stock records yet.")
                }
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(items) { s ->
                        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                            Text(s.products?.canonicalName ?: "Unknown product", style = MaterialTheme.typography.bodyLarge)
                            val qty = s.quantity?.toString() ?: "—"
                            Text(
                                "Qty: $qty  ·  ${s.availabilityStatus ?: ""}" +
                                    (s.size?.let { "  ·  $it" } ?: ""),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (!s.products?.productIdentifier.isNullOrBlank()) {
                                Text(
                                    "Code: ${s.products?.productIdentifier}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
