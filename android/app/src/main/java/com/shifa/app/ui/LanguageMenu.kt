package com.shifa.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/** EN / AR language switcher shown in top bars. Defaults to the device language. */
@Composable
fun LanguageMenu(state: LanguageState) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { expanded = true }) {
            Text(if (state.lang == Language.AR) "العربية" else "English")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(state.strings.english) },
                onClick = { state.setLang(Language.EN); expanded = false },
            )
            DropdownMenuItem(
                text = { Text(state.strings.arabic) },
                onClick = { state.setLang(Language.AR); expanded = false },
            )
        }
    }
}
