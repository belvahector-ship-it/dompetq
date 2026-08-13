package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* ══════════════════════════════════════════════
   Komponen dasar soft neo-brutalist.

   Bayangan keras dibuat sebagai kotak gelap yang digeser di
   belakang, bukan elevation Material — elevation menghasilkan
   bayangan lembut yang tidak cocok dengan bahasa desain ini.
   ══════════════════════════════════════════════ */

@Composable
fun KartuTebal(
    modifier: Modifier = Modifier,
    latar: Color = Krem,
    padding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    isi: @Composable ColumnScope.() -> Unit
) {
    Box(modifier) {
        Box(
            Modifier
                .matchParentSize()
                .offset(x = JarakBayangan, y = JarakBayangan)
                .clip(RoundedCornerShape(Radius))
                .background(Tinta)
        )
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius))
                .background(latar)
                .border(TebalBorder, Tinta, RoundedCornerShape(Radius))
                .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
                .padding(padding),
            content = isi
        )
    }
}

@Composable
fun TombolUtama(
    teks: String,
    modifier: Modifier = Modifier,
    latar: Color = Hijau,
    warnaTeks: Color = Color.White,
    aktif: Boolean = true,
    onClick: () -> Unit
) {
    Box(modifier.height(56.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .offset(x = 4.dp, y = 4.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(if (aktif) Tinta else Color.Transparent)
        )
        Box(
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(if (aktif) latar else KremTua)
                .border(TebalBorder, if (aktif) Tinta else TintaLembut, RoundedCornerShape(14.dp))
                .clickable(enabled = aktif) { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                teks,
                color = if (aktif) warnaTeks else TintaLembut,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}

@Composable
fun TombolGaris(teks: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(14.dp))
            .border(TebalBorder, Tinta, RoundedCornerShape(14.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(teks, fontWeight = FontWeight.Bold, color = Tinta)
    }
}

@Composable
fun TombolPutus(teks: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(KremTua)
            .border(1.6.dp, TintaLembut, RoundedCornerShape(14.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(teks, fontWeight = FontWeight.Bold, color = TintaLembut)
    }
}

@Composable
fun Medan(
    label: String,
    nilai: String,
    onUbah: (String) -> Unit,
    modifier: Modifier = Modifier,
    angka: Boolean = false,
    petunjuk: String = ""
) {
    Column(modifier.padding(vertical = 6.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TintaLembut)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = nilai,
            onValueChange = onUbah,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { if (petunjuk.isNotEmpty()) Text(petunjuk, color = TintaLembut) },
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(
                keyboardType = if (angka) KeyboardType.Number else KeyboardType.Text
            )
        )
    }
}

@Composable
fun JudulSeksi(teks: String, ekor: String = "") {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 22.dp, bottom = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(teks, style = MaterialTheme.typography.headlineSmall)
        if (ekor.isNotEmpty()) Text(ekor, color = TintaLembut, fontSize = 13.sp)
    }
}

@Composable
fun Lencana(teks: String, warna: Color) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(warna.copy(alpha = 0.15f))
            .border(1.4.dp, warna, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(teks, color = warna, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun BarisIkon(ikon: ImageVector, warna: Color = Tinta) {
    Box(
        Modifier
            .size(38.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(warna.copy(alpha = 0.12f))
            .border(1.6.dp, warna, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        Icon(ikon, contentDescription = null, tint = warna, modifier = Modifier.size(20.dp))
    }
}

/* Grafik batang sederhana — cukup untuk membandingkan kategori,
   dan tidak menambah ketergantungan pustaka grafik. */
@Composable
fun Batang(nama: String, nilai: Long, maksimum: Long, warna: Color, teksNilai: String) {
    val porsi = if (maksimum <= 0L) 0f else (nilai.toFloat() / maksimum.toFloat()).coerceIn(0f, 1f)
    Column(Modifier.padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(nama, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(teksNilai, fontSize = 13.sp, color = TintaLembut)
        }
        Spacer(Modifier.height(6.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(14.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(KremTua)
                .border(1.4.dp, Tinta, RoundedCornerShape(999.dp))
        ) {
            Box(
                Modifier
                    .fillMaxWidth(porsi)
                    .height(14.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(warna)
            )
        }
    }
}

@Composable
fun Pemisah() {
    Spacer(
        Modifier
            .fillMaxWidth()
            .height(1.4.dp)
            .background(KremTua)
    )
}
