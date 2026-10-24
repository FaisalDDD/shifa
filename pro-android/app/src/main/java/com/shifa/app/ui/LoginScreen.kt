package com.shifa.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Client
import com.shifa.app.data.Session
import com.shifa.app.data.SessionStore
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onAuthed: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(64.dp))
        Text("Shifa Pro", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(8.dp))
        Text(
            "Pharmacy admin sign in",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                if (loading) return@Button
                scope.launch {
                    loading = true
                    error = null
                    try {
                        val resp = Client.auth.signIn("password", email.trim(), password)
                        val token = resp.accessToken
                        if (token == null) {
                            error = "Sign-in failed. Check your email and password."
                            return@launch
                        }
                        Session.accessToken = token
                        Session.refreshToken = resp.refreshToken
                        Session.userId = resp.user?.id
                        Session.email = resp.user?.email
                        SessionStore.save()

                        val uid = Session.userId
                        if (uid == null) {
                            error = "Account has no user id."
                            return@launch
                        }
                        val members = Client.rest.memberships(userId = "eq.$uid")
                        val owner = members.firstOrNull { it.membershipRole == "owner" }
                        if (owner != null) {
                            onAuthed(owner.pharmacyId)
                            return@launch
                        }
                        val prof = Client.rest.profile(id = "eq.$uid")
                        if (prof.firstOrNull()?.role == "admin") {
                            onAuthed("")
                            return@launch
                        }
                        error = "This app is for pharmacy admins only."
                        Session.clear()
                        SessionStore.clear()
                    } catch (e: Exception) {
                        error = e.message ?: "Sign-in failed."
                    } finally {
                        loading = false
                    }
                }
            },
            enabled = !loading,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) { Text(if (loading) "Signing in…" else "Sign in") }
    }
}
