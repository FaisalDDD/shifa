package com.shifa.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

private val Navy = Color(0xFF002A68)
private val Blue = Color(0xFF1267C5)
private val Sky = Color(0xFFDDF2FF)
private val Ink = Color(0xFF14263D)
private val Muted = Color(0xFF61738B)

private val LightColors = lightColorScheme(
    primary = Navy,
    onPrimary = Color.White,
    primaryContainer = Sky,
    onPrimaryContainer = Navy,
    secondary = Blue,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE8F3FF),
    onSecondaryContainer = Navy,
    tertiary = Color(0xFF1267C5),
    onTertiary = Color.White,
    background = Color(0xFFF3F7FC),
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEAF1F8),
    onSurfaceVariant = Muted,
    outline = Color(0xFFD6E1ED),
    outlineVariant = Color(0xFFE7EDF4),
    error = Color(0xFFB9343E),
    errorContainer = Color(0xFFFFE9E8),
    onErrorContainer = Color(0xFF782127),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF6BA7E8),
    onPrimary = Color(0xFF061224),
    primaryContainer = Color(0xFF0A1C3A),
    onPrimaryContainer = Color(0xFFCFE7FF),
    secondary = Color(0xFF8FC0F2),
    onSecondary = Color(0xFF061224),
    secondaryContainer = Color(0xFF152036),
    onSecondaryContainer = Color(0xFFCFE7FF),
    tertiary = Color(0xFF8FC0F2),
    onTertiary = Color(0xFF061224),
    background = Color(0xFF050B16),
    onBackground = Color(0xFFEAF1F9),
    surface = Color(0xFF0D1626),
    onSurface = Color(0xFFEAF1F9),
    surfaceVariant = Color(0xFF152036),
    onSurfaceVariant = Color(0xFF93A4BA),
    outline = Color(0xFF24344A),
    outlineVariant = Color(0xFF24344A),
    error = Color(0xFFFA797C),
    errorContainer = Color(0xFF3A1A1E),
    onErrorContainer = Color(0xFFFFDADB),
)

private val ShifaShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(15.dp),
    large = RoundedCornerShape(21.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

private val ShifaTypography = Typography().let { base ->
    base.copy(
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun ShifaTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = ShifaTypography,
        shapes = ShifaShapes,
        content = content,
    )
}
