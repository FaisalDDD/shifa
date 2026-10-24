package com.shifa.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import com.shifa.app.data.Client
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product
import com.shifa.app.data.Session
import com.shifa.app.data.SessionStore
import com.shifa.app.ui.AuthScreen
import com.shifa.app.ui.DashboardScreen
import com.shifa.app.ui.LanguageState
import com.shifa.app.ui.LocalLanguageState
import com.shifa.app.ui.PharmacyDetailScreen
import com.shifa.app.ui.ProductPharmaciesScreen
import com.shifa.app.ui.PharmacySetupScreen
import com.shifa.app.ui.SearchScreen
import com.shifa.app.ui.ShifaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SessionStore.init(this)
        setContent {
            val languageState = remember { LanguageState(applicationContext) }
            ShifaTheme {
                CompositionLocalProvider(
                    LocalLanguageState provides languageState,
                    LocalLayoutDirection provides languageState.layoutDirection,
                ) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = androidx.compose.material3.MaterialTheme.colorScheme.background,
                    ) {
                        App()
                    }
                }
            }
        }
    }
}

private sealed interface Screen {
    data object Auth : Screen
    data object PharmacySetup : Screen
    data object CustomerHome : Screen
    data object Dashboard : Screen
    data class PharmacyDetail(val pharmacy: Pharmacy) : Screen
    data class ProductPharmacies(val product: Product) : Screen
}

@Composable
private fun App() {
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf<Screen>(Screen.Auth) }
    var resolving by remember { mutableStateOf(Session.accessToken != null) }

    fun resolveDestination(accountType: String) {
        scope.launch {
            resolving = true
            val memberships = try {
                Session.userId?.let { Client.rest.memberships(userId = "eq.$it") } ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            screen = when {
                memberships.isNotEmpty() -> Screen.Dashboard
                accountType == "pharmacy" -> Screen.PharmacySetup
                else -> Screen.CustomerHome
            }
            resolving = false
        }
    }

    fun signOut() {
        Session.clear()
        SessionStore.clear()
        screen = Screen.Auth
        resolving = false
    }

    LaunchedEffect(Unit) {
        if (Session.accessToken != null) {
            resolveDestination(Session.accountType)
        } else {
            resolving = false
        }
    }

    if (resolving) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    when (val s = screen) {
        Screen.Auth -> AuthScreen(onAuthenticated = { t -> resolveDestination(t) })
        Screen.PharmacySetup -> PharmacySetupScreen(
            onDone = { screen = Screen.Dashboard },
            onSignOut = { signOut() },
        )
        Screen.CustomerHome -> SearchScreen(
            onProductClick = { screen = Screen.ProductPharmacies(it) },
            onPharmacyClick = { screen = Screen.PharmacyDetail(it) },
            onSignOut = { signOut() },
        )
        Screen.Dashboard -> DashboardScreen(onSignOut = { signOut() })
        is Screen.PharmacyDetail -> PharmacyDetailScreen(
            pharmacy = s.pharmacy,
            onBack = { screen = Screen.CustomerHome },
        )
        is Screen.ProductPharmacies -> ProductPharmaciesScreen(
            product = s.product,
            onPharmacyClick = { screen = Screen.PharmacyDetail(it) },
            onBack = { screen = Screen.CustomerHome },
        )
    }
}
