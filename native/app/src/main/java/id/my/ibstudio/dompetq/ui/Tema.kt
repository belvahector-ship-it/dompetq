package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* ══════════════════════════════════════════════
   Tema — bahasa desain soft neo-brutalist yang sama
   dengan versi web: krem, border tebal, bayangan keras.

   Sengaja TIDAK mengikuti mode gelap sistem. Palet krem
   ini punya kontras yang sudah diperiksa; versi gelap
   dadakan akan membuat angka uang jadi sulit dibaca.
   ══════════════════════════════════════════════ */

val Krem = Color(0xFFFFFDF5)
val KremTua = Color(0xFFF3EEE0)
val Tinta = Color(0xFF1A1A1A)
val TintaLembut = Color(0xFF6B6355)
val Hijau = Color(0xFF0E9F6E)
val Amber = Color(0xFFC2760A)
val Merah = Color(0xFFDC2626)
val Biru = Color(0xFF2563EB)
val Ungu = Color(0xFF9333EA)

/* Warna lembut yang TETAP BURAM.

   Jangan pernah memakai Color.copy(alpha = …) sebagai latar KartuTebal:
   kartu punya kotak bayangan hitam pekat tepat di belakangnya, jadi
   latar tembus pandang membuat bayangan itu naik ke permukaan — kartunya
   jadi gelap dan teksnya nyaris tak terbaca. Warna dicampur dengan krem
   di sini supaya hasilnya buram sejak awal. */
fun lembut(warna: Color, porsi: Float = 0.16f): Color = lerp(Krem, warna, porsi)

val TebalBorder = 2.4.dp
val JarakBayangan = 6.dp
val Radius = 16.dp

private val Skema = lightColorScheme(
    primary = Tinta,
    onPrimary = Krem,
    secondary = Hijau,
    onSecondary = Color.White,
    background = Krem,
    onBackground = Tinta,
    surface = Krem,
    onSurface = Tinta,
    surfaceVariant = KremTua,
    onSurfaceVariant = TintaLembut,
    error = Merah,
    onError = Color.White,
    outline = Tinta
)

private val Huruf = Typography(
    displaySmall = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 32.sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 24.sp),
    headlineSmall = TextStyle(fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontWeight = FontWeight.Medium, fontSize = 16.sp),
    bodyMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 14.sp),
    bodySmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp)
)

@Composable
fun TemaDompetQ(content: @Composable () -> Unit) {
    @Suppress("UNUSED_EXPRESSION") isSystemInDarkTheme()
    MaterialTheme(colorScheme = Skema, typography = Huruf, content = content)
}
