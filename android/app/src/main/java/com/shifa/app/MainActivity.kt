package com.shifa.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import com.shifa.app.data.DiscoveryCache
import com.shifa.app.data.Pharmacy
import com.shifa.app.data.Product
import com.shifa.app.data.Session
import com.shifa.app.data.SessionStore
import com.shifa.app.ui.AuthScreen
import com.shifa.app.ui.LanguageState
import com.shifa.app.ui.LocalLanguageState
import com.shifa.app.ui.PharmacyDetailScreen
import com.shifa.app.ui.ProductPharmaciesScreen
import com.shifa.app.ui.SearchScreen
import com.shifa.app.ui.ShifaTheme


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SessionStore.init(this)
        DiscoveryCache.init(this)
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
    data object CustomerHome : Screen
    data class PharmacyDetail(val pharmacy: Pharmacy) : Screen
    data class ProductPharmacies(val product: Product) : Screen
}

@Composable
private fun App() {
    var screen by remember { mutableStateOf<Screen>(Screen.CustomerHome) }
    val isSignedIn = !Session.accessToken.isNullOrBlank()

    fun signOut() {
        Session.clear()
        SessionStore.clear()
        screen = Screen.CustomerHome
    }

    BackHandler(enabled = screen != Screen.CustomerHome) {
        screen = Screen.CustomerHome
    }

    when (val s = screen) {
        Screen.Auth -> AuthScreen(
            onAuthenticated = { screen = Screen.CustomerHome },
            onBrowse = { screen = Screen.CustomerHome },
        )
        Screen.CustomerHome -> SearchScreen(
            onProductClick = { screen = Screen.ProductPharmacies(it) },
            onPharmacyClick = { screen = Screen.PharmacyDetail(it) },
            isSignedIn = isSignedIn,
            onSignIn = { screen = Screen.Auth },
            onSignOut = { signOut() },
        )

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
