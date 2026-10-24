package com.shifa.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.shifa.app.data.Client
import com.shifa.app.data.Session
import com.shifa.app.data.SessionStore
import com.shifa.app.data.SignUpRequest
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(onAuthenticated: (String) -> Unit) {
    val state = LocalLanguageState.current
    val strings = state.strings
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("signin") }
    var accountType by remember { mutableStateOf("customer") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun persistSession(accessToken: String?, refreshToken: String?, userId: String?, userEmail: String?) {
        Session.accessToken = accessToken
        Session.refreshToken = refreshToken
        Session.userId = userId
        Session.email = userEmail
        SessionStore.save()
    }

    fun submit() {
        if (email.isBlank() || password.isBlank()) return
        scope.launch {
            loading = true
            error = null
            try {
                if (mode == "signin") {
                    val resp = Client.auth.signIn("password", email.trim(), password)
                    if (!resp.accessToken.isNullOrBlank()) {
                        persistSession(resp.accessToken, resp.refreshToken, resp.user?.id, resp.user?.email)
                        onAuthenticated(Session.accountType)
                    } else {
                        error = strings.signingInFailed
                    }
                } else {
                    Session.accountType = accountType
                    val data = if (name.isNotBlank()) mapOf("display_name" to name.trim()) else null
                    val resp = Client.auth.signUp(SignUpRequest(email.trim(), password, data))
                    if (!resp.accessToken.isNullOrBlank()) {
                        persistSession(resp.accessToken, resp.refreshToken, resp.user?.id, resp.user?.email)
                        onAuthenticated(accountType)
                    } else {
                        error = strings.checkEmail
                    }
                }
            } catch (e: Exception) {
                error = e.message ?: strings.somethingWentWrong
            } finally {
                loading = false
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().padding(8.dp), contentAlignment = Alignment.TopEnd) {
            LanguageMenu(state)
        }
        Box(
            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
            contentAlignment = Alignment.Center,
        ) {
          Card(
            modifier = Modifier.fillMaxWidth().widthIn(max = 480.dp),
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
          ) {
          Column(
            modifier = Modifier.fillMaxWidth().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
          ) {
            ShifaLogo(size = 104.dp)
            Spacer(Modifier.height(10.dp))
            Text(
                if (mode == "signup" && accountType == "pharmacy") strings.registerBusinessTagline else strings.tagline,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(24.dp))

            if (mode == "signup") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("customer" to strings.customer, "pharmacy" to strings.business).forEach { (key, label) ->
                        FilterChip(
                            selected = accountType == key,
                            onClick = { accountType = key },
                            label = { Text(label) },
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.name) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text(strings.email) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text(strings.password) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )

            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { submit() },
                enabled = !loading && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (loading) strings.pleaseWait else if (mode == "signin") strings.signIn else strings.signUp)
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { mode = if (mode == "signin") "signup" else "signin"; error = null }) {
                Text(if (mode == "signin") strings.noAccountSignUp else strings.haveAccountSignIn)
            }
          }
          }
        }
    }
}
