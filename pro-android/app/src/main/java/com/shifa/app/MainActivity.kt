package com.shifa.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.shifa.app.data.Session
import com.shifa.app.data.SessionStore
import com.shifa.app.ui.DashboardScreen
import com.shifa.app.ui.EmployeesScreen
import com.shifa.app.ui.FinancialScreen
import com.shifa.app.ui.LoginScreen
import com.shifa.app.ui.ProductsScreen
import com.shifa.app.ui.ShifaTheme
import com.shifa.app.ui.StockScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SessionStore.init(this)
        setContent {
            ShifaTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    App()
                }
            }
        }
    }
}

private sealed interface Screen {
    data object Login : Screen
    data object Home : Screen
    data object Products : Screen
    data object Financial : Screen
    data object Employees : Screen
    data object Stock : Screen
}

@Composable
private fun App() {
    var screen by remember {
        mutableStateOf<Screen>(if (Session.accessToken.isNullOrBlank()) Screen.Login else Screen.Home)
    }
    var pharmacyId by remember { mutableStateOf<String?>(null) }

    fun signOut() {
        Session.clear()
        SessionStore.clear()
        pharmacyId = null
        screen = Screen.Login
    }

    BackHandler(enabled = screen != Screen.Home && screen != Screen.Login) {
        screen = Screen.Home
    }

    when (val s = screen) {
        Screen.Login -> LoginScreen(
            onAuthed = { pid ->
                pharmacyId = pid
                screen = Screen.Home
            },
        )

        Screen.Home -> DashboardScreen(
            onProducts = { screen = Screen.Products },
            onFinancial = { screen = Screen.Financial },
            onEmployees = { screen = Screen.Employees },
            onStock = { screen = Screen.Stock },
            onSignOut = { signOut() },
        )

        Screen.Products -> ProductsScreen(onBack = { screen = Screen.Home })
        Screen.Financial -> FinancialScreen(pharmacyId = pharmacyId, onBack = { screen = Screen.Home })
        Screen.Employees -> EmployeesScreen(pharmacyId = pharmacyId, onBack = { screen = Screen.Home })
        Screen.Stock -> StockScreen(pharmacyId = pharmacyId, onBack = { screen = Screen.Home })
    }
}
