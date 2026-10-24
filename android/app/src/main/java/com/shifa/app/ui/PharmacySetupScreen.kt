@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.shifa.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.widthIn
import com.shifa.app.data.Client
import com.shifa.app.data.OpeningHour
import com.shifa.app.data.RegisterPharmacyRequest
import kotlinx.coroutines.launch

@Composable
fun PharmacySetupScreen(
    onDone: () -> Unit,
    onSignOut: () -> Unit,
) {
    val state = LocalLanguageState.current
    val strings = state.strings
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var website by remember { mutableStateOf("") }
    var openTime by remember { mutableStateOf("") }
    var closeTime by remember { mutableStateOf("") }
    var latitude by remember { mutableStateOf("0.0") }
    var longitude by remember { mutableStateOf("0.0") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun submit() {
        if (name.isBlank() || address.isBlank()) {
            error = strings.nameAddressRequired
            return
        }
        val lat = latitude.toDoubleOrNull()
        val lng = longitude.toDoubleOrNull()
        if (lat == null || lng == null) {
            error = strings.validLatLng
            return
        }
        scope.launch {
            loading = true
            error = null
            try {
                val openingHours = if (openTime.isNotBlank() && closeTime.isNotBlank()) {
                    (0..6).map { OpeningHour(day = it, open = openTime.trim(), close = closeTime.trim()) }
                } else null
                val body = RegisterPharmacyRequest(
                    name = name.trim(),
                    slug = slugify(name),
                    address = address.trim(),
                    city = city.trim().ifBlank { null },
                    latitude = lat,
                    longitude = lng,
                    phone = phone.trim().ifBlank { null },
                    website = website.trim().ifBlank { null },
                    openingHours = openingHours,
                )
                val resp = Client.rest.registerPharmacy(body)
                if (resp.isSuccessful) onDone() else error = strings.registerFailed
            } catch (e: Exception) {
                error = e.message ?: strings.registerFailed
            } finally {
                loading = false
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        TopAppBar(
            title = { Text(strings.setUpPharmacy) },
            actions = {
                LanguageMenu(state)
                TextButton(onClick = onSignOut) { Text(strings.signOut) }
            },
        )
        Spacer(Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth().widthIn(max = 660.dp).align(Alignment.CenterHorizontally),
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        ) {
            Column(Modifier.fillMaxWidth().padding(20.dp)) {
                Text(strings.pendingNotice, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(16.dp))

                Field(name, strings.pharmacyName, required = true) { name = it }
                Field(address, strings.address, required = true) { address = it }
                Field(city, strings.city) { city = it }
                Field(phone, strings.phone) { phone = it }
                Field(website, strings.website) { website = it }
                Field(openTime, strings.openingTime) { openTime = it }
                Field(closeTime, strings.closingTime) { closeTime = it }
                Field(latitude, strings.latitude, keyboardType = KeyboardType.Decimal, required = true) { latitude = it }
                Field(longitude, strings.longitude, keyboardType = KeyboardType.Decimal, required = true) { longitude = it }

                error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(16.dp))
                Button(onClick = { submit() }, enabled = !loading, modifier = Modifier.fillMaxWidth()) {
                    Text(if (loading) strings.submitting else strings.submitForReview)
                }
            }
        }
    }
}

@Composable
private fun Field(
    value: String,
    label: String,
    required: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(if (required) "$label *" else label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
    )
}

private fun slugify(name: String): String {
    val base = name.lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .take(60)
        .ifBlank { "pharmacy" }
    val suffix = buildString { repeat(5) { append("abcdefghijklmnopqrstuvwxyz0123456789".random()) } }
    return "$base-$suffix"
}
