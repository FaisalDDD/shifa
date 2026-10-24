@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package com.shifa.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.shifa.app.data.Client
import com.shifa.app.data.DiscoveryCache
import com.shifa.app.data.NearbyPharmaciesBody
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product
import com.shifa.app.data.SearchProductsBody
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@SuppressLint("MissingPermission")
private fun lastKnownLocation(context: Context): Pair<Double, Double>? {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
        try {
            val loc = lm.getLastKnownLocation(provider)
            if (loc != null) return loc.latitude to loc.longitude
        } catch (_: Exception) {
            // ignore provider errors
        }
    }
    return null
}

/**
 * Single search bar for both medicines and pharmacies. Empty state shows
 * popular-product suggestions (on focus) and top pharmacies nearby; results
 * only appear once the user types.
 */
@Composable
fun SearchScreen(
    onProductClick: (Product) -> Unit,
    onPharmacyClick: (Pharmacy) -> Unit,
    isSignedIn: Boolean,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit,
) {
    val state = LocalLanguageState.current
    val strings = state.strings
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var focused by remember { mutableStateOf(false) }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var pharmacies by remember { mutableStateOf<List<Pharmacy>>(emptyList()) }
    var popular by remember { mutableStateOf<List<Product>>(emptyList()) }
    var top by remember { mutableStateOf<List<Pharmacy>>(emptyList()) }
    var showingNearby by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var offlineSnapshot by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }

    fun loadTopPharmacies() {
        scope.launch {
            val loc = lastKnownLocation(context)
            showingNearby = loc != null
            top = try {
                if (loc != null) {
                    Client.rest.nearbyPharmacies(NearbyPharmaciesBody(searchLat = loc.first, searchLng = loc.second))
                } else {
                    Client.rest.pharmacies(limit = 10)
                }
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        loadTopPharmacies()
    }

    LaunchedEffect(Unit) {
        loadTopPharmacies()
        popular = try {
            Client.rest.suggestedProducts()
        } catch (_: Exception) {
            emptyList()
        }
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            searched = false
            products = emptyList()
            pharmacies = emptyList()
            return@LaunchedEffect
        }
        delay(300)
        loading = true
        error = null
        searched = true
        try {
            products = Client.rest.searchProducts(SearchProductsBody(searchTerm = query.trim(), includeDemo = false))
            pharmacies = Client.rest.searchPharmacies(name = "ilike.*${query.trim()}*")
            DiscoveryCache.saveSearch(query, products, pharmacies)
            offlineSnapshot = false
        } catch (e: Exception) {
            products = DiscoveryCache.loadProducts(query)
            pharmacies = DiscoveryCache.loadPharmacies(query)
            offlineSnapshot = products.isNotEmpty() || pharmacies.isNotEmpty()
            error = if (offlineSnapshot) null else friendlyError(e, strings)
        } finally {
            loading = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { ShifaLogo(size = 34.dp) },
            actions = {
                LanguageMenu(state)
                TextButton(onClick = if (isSignedIn) onSignOut else onSignIn) {
                    Text(if (isSignedIn) strings.signOut else strings.signIn)
                }
            },
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text(strings.searchMedicines) },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .onFocusChanged { focused = it.isFocused },
        )

        if (offlineSnapshot) {
            Text(
                strings.offlineSnapshot,
                color = MaterialTheme.colorScheme.tertiary,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        when {
            query.isNotBlank() -> when {
                loading -> LoadingState(strings.loading)
                error != null -> EmptyState(error.orEmpty())
                products.isEmpty() && pharmacies.isEmpty() -> EmptyState(strings.noResults)
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (products.isNotEmpty()) {
                        item { SectionHeader(strings.productsTab) }
                        items(products) { p -> ProductCard(p, onClick = { onProductClick(p) }) }
                    }
                    if (pharmacies.isNotEmpty()) {
                        item { SectionHeader(strings.pharmaciesTab) }
                        items(pharmacies) { p -> PharmacyCard(p, strings, onClick = { onPharmacyClick(p) }) }
                    }
                }
            }
            focused -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
            ) {
                if (popular.isNotEmpty()) {
                    item { SectionHeader(strings.popularProducts) }
                    item {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            popular.forEach { p ->
                                AssistChip(
                                    onClick = { query = p.canonicalName ?: "" },
                                    label = { Text(p.canonicalName ?: "") },
                                )
                            }
                        }
                    }
                }
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (top.isNotEmpty()) {
                    item { SectionHeader(if (showingNearby) strings.nearbyPharmacies else strings.topPharmacies) }
                    items(top) { p -> PharmacyCard(p, strings, onClick = { onPharmacyClick(p) }) }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 4.dp, bottom = 4.dp),
    )
}

@Composable
private fun ProductCard(p: Product, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(
                listOfNotNull(p.canonicalName, p.strength).joinToString(" "),
                style = MaterialTheme.typography.titleMedium,
            )
            val sub = listOfNotNull(p.brandName, p.dosageForm).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(sub, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun PharmacyCard(p: Pharmacy, strings: Strings, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(p.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                AssistChip(
                    onClick = {},
                    label = { Text(if (p.verificationStatus == "verified") strings.verified else strings.pending) },
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                listOfNotNull(p.address, p.city).joinToString(", "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
