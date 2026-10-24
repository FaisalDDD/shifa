package com.shifa.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Session

@Composable
fun DashboardScreen(
    onProducts: () -> Unit,
    onFinancial: () -> Unit,
    onEmployees: () -> Unit,
    onStock: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text("Shifa Pro", style = MaterialTheme.typography.headlineSmall)
                Text(
                    Session.email ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onSignOut) { Text("Sign out") }
        }
        Spacer(Modifier.height(24.dp))
        DashboardCard("Financial", "Sales, expenses and ledger", onFinancial)
        DashboardCard("Employees", "Staff, shifts and hours", onEmployees)
        DashboardCard("Stock", "Inventory and availability", onStock)
        DashboardCard("Products", "Catalog: code, name and description", onProducts)
    }
}

@Composable
private fun DashboardCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Column(Modifier.padding(20.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(4.dp))
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
