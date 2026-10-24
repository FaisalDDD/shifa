@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.shifa.app.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Client
import com.shifa.app.data.CreatePurchaseRequest
import com.shifa.app.data.InventoryItem
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product
import com.shifa.app.data.PurchaseRequest
import com.shifa.app.data.SearchProductsBody
import com.shifa.app.data.Session
import com.shifa.app.data.UpdateInventoryRequest
import com.shifa.app.data.UpdatePurchaseRequest
import com.shifa.app.data.UpsertInventoryRequest
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(onSignOut: () -> Unit) {
    val state = LocalLanguageState.current
    val strings = state.strings
    var pharmacies by remember { mutableStateOf<List<Pharmacy>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var activeId by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableStateOf("inventory") }

    suspend fun loadPharmacies() {
        loading = true
        try {
            val memberships = Session.userId?.let { Client.rest.memberships(userId = "eq.$it") } ?: emptyList()
            pharmacies = memberships.mapNotNull { it.pharmacies }
            if (activeId == null || pharmacies.none { it.id == activeId }) {
                activeId = pharmacies.firstOrNull()?.id
            }
        } catch (_: Exception) {
            // empty list below
        } finally {
            loading = false
        }
    }

    LaunchedEffect(Unit) { loadPharmacies() }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ShifaLogo(size = 46.dp)
                    Text(strings.businessDashboard, style = MaterialTheme.typography.titleMedium)
                }
            },
            actions = {
                LanguageMenu(state)
                TextButton(onClick = onSignOut) { Text(strings.signOut) }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
        )
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            pharmacies.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(strings.noPharmacyYet)
            }
            else -> {
                val active = pharmacies.firstOrNull { it.id == activeId } ?: pharmacies.first()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 14.dp)) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.large,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
                        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(strings.businessDashboard, style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.primaryContainer)
                                Spacer(Modifier.height(5.dp))
                                Text(active.name, style = MaterialTheme.typography.headlineSmall, color = androidx.compose.ui.graphics.Color.White)
                                Spacer(Modifier.height(3.dp))
                                Text(active.address, style = MaterialTheme.typography.bodyMedium,
                                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.82f))
                            }
                            Spacer(Modifier.width(8.dp))
                            AssistChip(
                                onClick = {},
                                label = { Text(if (active.verificationStatus == "verified") strings.verified else strings.pending) },
                                colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                                    containerColor = androidx.compose.ui.graphics.Color.White,
                                    labelColor = MaterialTheme.colorScheme.primary,
                                ),
                            )
                        }
                    }

                    if (pharmacies.size > 1) {
                        Spacer(Modifier.height(8.dp))
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            pharmacies.forEach { p ->
                                FilterChip(
                                    selected = p.id == active.id,
                                    onClick = { activeId = p.id },
                                    label = { Text(p.name) },
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.large,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(
                                    "inventory" to strings.inventory,
                                    "suppliers" to strings.findSuppliers,
                                    "requests" to strings.requests,
                                ).forEach { (key, label) ->
                                    FilterChip(
                                        selected = tab == key,
                                        onClick = { tab = key },
                                        label = { Text(label) },
                                    )
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            Spacer(Modifier.height(14.dp))
                            when (tab) {
                                "suppliers" -> SuppliersPanel(active.id)
                                "requests" -> RequestsPanel(active.id)
                                else -> InventoryPanel(active.id)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

@Composable
private fun InventoryPanel(pharmacyId: String) {
    val strings = LocalLanguageState.current.strings
    var rows by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var filter by remember { mutableStateOf("") }
    var addQuery by remember { mutableStateOf("") }
    var addResults by remember { mutableStateOf<List<Product>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var searching by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun reload() {
        loading = true
        try {
            rows = Client.rest.inventoryForPharmacy(pharmacyId = "eq.$pharmacyId")
        } catch (e: Exception) {
            error = e.message
        } finally {
            loading = false
        }
    }

    LaunchedEffect(pharmacyId) { reload() }

    val filtered = if (filter.isBlank()) rows else rows.filter {
        val n = it.products?.canonicalName.orEmpty()
        val b = it.products?.brandName.orEmpty()
        n.contains(filter, true) || b.contains(filter, true)
    }

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = addQuery,
            onValueChange = { addQuery = it },
            label = { Text(strings.searchAddProduct) },
            singleLine = true,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Button(onClick = {
            scope.launch {
                searching = true
                try {
                    addResults = if (addQuery.isBlank()) emptyList()
                    else Client.rest.searchProducts(SearchProductsBody(searchTerm = addQuery.trim()))
                } catch (e: Exception) {
                    error = e.message
                } finally {
                    searching = false
                }
            }
        }, enabled = !searching) {
            Text(if (searching) "…" else strings.search)
        }
    }
    addResults.take(8).forEach { p ->
        Row(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                listOfNotNull(p.canonicalName, p.strength).joinToString(" "),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Button(onClick = {
                scope.launch {
                    Client.rest.upsertInventory(
                        UpsertInventoryRequest(pharmacyId = pharmacyId, productId = p.id, quantity = 10),
                    )
                    addResults = emptyList()
                    addQuery = ""
                    reload()
                }
            }) { Text(strings.add) }
        }
    }

    Spacer(Modifier.height(12.dp))

    OutlinedTextField(
        value = filter,
        onValueChange = { filter = it },
        label = { Text(strings.filterInventory) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(Modifier.height(8.dp))
    Text(strings.yourInventory, style = MaterialTheme.typography.titleMedium)

    error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

    when {
        loading -> CircularProgressIndicator()
        filtered.isEmpty() -> Text(strings.noInventory, color = MaterialTheme.colorScheme.onSurfaceVariant)
        else -> filtered.forEach { row ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        listOfNotNull(row.products?.canonicalName, row.products?.strength).joinToString(" "),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        "${strings.availability}: ${row.availabilityStatus?.lowercase()?.replace('_', ' ') ?: "unknown"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Button(onClick = {
                    scope.launch {
                        Client.rest.updateInventory("eq.${row.id}", UpdateInventoryRequest("AVAILABLE"))
                        reload()
                    }
                }) { Text(strings.inStock) }
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = {
                    scope.launch {
                        Client.rest.updateInventory("eq.${row.id}", UpdateInventoryRequest("OUT_OF_STOCK"))
                        reload()
                    }
                }) { Text(strings.outOfStock) }
            }
            HorizontalDivider()
        }
    }
}

// ---------------------------------------------------------------------------
// Find suppliers (B2B bulk purchase)
// ---------------------------------------------------------------------------

private data class SupplierProduct(val product: Product, val pharmacies: List<Pharmacy>)

private suspend fun searchSuppliers(term: String, myPharmacyId: String): List<SupplierProduct> {
    val products = Client.rest.searchProducts(SearchProductsBody(searchTerm = term))
    if (products.isEmpty()) return emptyList()
    val ids = products.map { it.id }
    val rows = Client.rest.inventoryByProducts(productIdFilter = "in.(${ids.joinToString(",")})")
    val byProduct = LinkedHashMap<String, MutableList<Pharmacy>>()
    for (row in rows) {
        val ph = row.pharmacies ?: continue
        val pid = row.productId ?: continue
        if (ph.id == myPharmacyId) continue
        if (!ph.isActive) continue
        if (row.availabilityStatus == "OUT_OF_STOCK") continue
        byProduct.getOrPut(pid) { mutableListOf() }.add(ph)
    }
    return products.mapNotNull { p ->
        val phs = byProduct[p.id] ?: return@mapNotNull null
        SupplierProduct(p, phs)
    }
}

@Composable
private fun SuppliersPanel(pharmacyId: String) {
    val strings = LocalLanguageState.current.strings
    var q by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<SupplierProduct>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf<Pair<String, String>?>(null) } // productId to sellerPharmacyId
    var quantity by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun send() {
        val p = pending ?: return
        val n = quantity.toIntOrNull()
        if (n == null || n <= 0) return
        scope.launch {
            Client.rest.createPurchaseRequest(
                CreatePurchaseRequest(
                    buyerPharmacyId = pharmacyId,
                    sellerPharmacyId = p.second,
                    productId = p.first,
                    quantity = n,
                ),
            )
            pending = null
        }
    }

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = q,
            onValueChange = { q = it },
            label = { Text(strings.searchBulkProduct) },
            singleLine = true,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Button(onClick = {
            scope.launch {
                if (q.isBlank()) return@launch
                loading = true
                searched = true
                error = null
                try {
                    results = searchSuppliers(q.trim(), pharmacyId)
                } catch (e: Exception) {
                    error = e.message
                } finally {
                    loading = false
                }
            }
        }, enabled = !loading) {
            Text(if (loading) "…" else strings.search)
        }
    }

    when {
        loading -> {
            Spacer(Modifier.height(16.dp))
            CircularProgressIndicator()
        }
        error != null -> {
            Spacer(Modifier.height(8.dp))
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
        }
        !searched || q.isBlank() -> {
            Spacer(Modifier.height(16.dp))
            Text(strings.supplierHint, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        results.isEmpty() -> {
            Spacer(Modifier.height(16.dp))
            Text(strings.noSuppliers, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        else -> {
            Spacer(Modifier.height(8.dp))
            results.forEach { sp ->
                Text(
                    listOfNotNull(sp.product.canonicalName, sp.product.strength).joinToString(" "),
                    style = MaterialTheme.typography.titleMedium,
                )
                sp.pharmacies.forEach { ph ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(ph.name, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                listOfNotNull(ph.address, ph.city).joinToString(", "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Button(onClick = { pending = sp.product.id to ph.id; quantity = "" }) { Text(strings.request) }
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
            }
        }
    }

    pending?.let {
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(strings.requestBulkQuantity) },
            text = {
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it },
                    label = { Text(strings.quantity) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            },
            confirmButton = {
                Button(onClick = { send() }, enabled = (quantity.toIntOrNull() ?: 0) > 0) { Text(strings.sendRequest) }
            },
            dismissButton = { TextButton(onClick = { pending = null }) { Text(strings.cancel) } },
        )
    }
}

// ---------------------------------------------------------------------------
// Purchase requests (incoming = you sell, outgoing = you buy)
// ---------------------------------------------------------------------------

@Composable
private fun RequestsPanel(pharmacyId: String) {
    val strings = LocalLanguageState.current.strings
    var incoming by remember { mutableStateOf<List<PurchaseRequest>>(emptyList()) }
    var outgoing by remember { mutableStateOf<List<PurchaseRequest>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    suspend fun reload() {
        loading = true
        try {
            incoming = Client.rest.purchaseRequests(sellerPharmacyId = "eq.$pharmacyId")
            outgoing = Client.rest.purchaseRequests(buyerPharmacyId = "eq.$pharmacyId")
        } catch (_: Exception) {
            // leave empty
        } finally {
            loading = false
        }
    }

    LaunchedEffect(pharmacyId) { reload() }

    fun act(id: String, status: String) {
        scope.launch {
            Client.rest.updatePurchaseRequest("eq.$id", UpdatePurchaseRequest(status))
            reload()
        }
    }

    if (loading) {
        CircularProgressIndicator()
        return
    }

    Text(strings.incomingRequests, style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(4.dp))
    if (incoming.isEmpty()) {
        Text(strings.noIncoming, color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
        incoming.forEach { r ->
            RequestRow(r, strings, kind = "incoming", onAccept = { act(r.id, "ACCEPTED") }, onReject = { act(r.id, "REJECTED") }, onCancel = null)
        }
    }

    Spacer(Modifier.height(16.dp))
    Text(strings.outgoingRequests, style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(4.dp))
    if (outgoing.isEmpty()) {
        Text(strings.noOutgoing, color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
        outgoing.forEach { r ->
            RequestRow(r, strings, kind = "outgoing", onAccept = null, onReject = null, onCancel = { act(r.id, "CANCELLED") })
        }
    }
}

@Composable
private fun RequestRow(
    r: PurchaseRequest,
    strings: Strings,
    kind: String,
    onAccept: (() -> Unit)?,
    onReject: (() -> Unit)?,
    onCancel: (() -> Unit)?,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "${listOfNotNull(r.products?.canonicalName, r.products?.strength).joinToString(" ")} × ${r.quantity}",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                "${r.status ?: "REQUESTED"} · ${if (kind == "incoming") strings.fromBuyer else strings.toSeller}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (kind == "incoming" && r.status == "REQUESTED") {
            Button(onClick = { onAccept?.invoke() }) { Text(strings.accept) }
            Spacer(Modifier.width(8.dp))
            TextButton(onClick = { onReject?.invoke() }) { Text(strings.reject) }
        }
        if (kind == "outgoing" && r.status == "REQUESTED") {
            TextButton(onClick = { onCancel?.invoke() }) { Text(strings.cancel) }
        }
    }
    HorizontalDivider()
}
