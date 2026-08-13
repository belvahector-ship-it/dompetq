package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

enum class Tab(val label: String, val ikon: ImageVector) {
    Beranda("Beranda", Icons.Filled.Home),
    Transaksi("Transaksi", Icons.Filled.ListAlt),
    Laporan("Laporan", Icons.Filled.BarChart),
    Profil("Profil", Icons.Filled.Person)
}

@Composable
fun Rangka(vm: VM, keadaan: Keadaan) {
    val pesan by vm.pesan.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(pesan) {
        pesan?.let { snackbar.showSnackbar(it); vm.bersihkanPesan() }
    }

    /* Layar krem kosong selama data pertama belum sampai. Tanpa ini
       dasbor sempat berkedip dengan angka nol sebelum onboarding
       muncul — pengguna baru akan melihat "Rp 0" lebih dulu. */
    if (!keadaan.siap) {
        Box(Modifier.fillMaxSize().background(Krem))
        return
    }

    /* Onboarding menguasai seluruh layar: sebelum akun dan sumber dana
       terdefinisi, tidak ada angka yang bisa ditampilkan dengan jujur. */
    if (!keadaan.profil.onboarding_selesai) {
        LayarOnboarding(vm, keadaan)
        return
    }

    var tab by remember { mutableStateOf(Tab.Beranda) }
    var bukaInput by remember { mutableStateOf(false) }
    var praPengingat by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = Krem,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = { NavBawah(tab, { tab = it }, { bukaInput = true }) }
    ) { pad ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(bottom = pad.calculateBottomPadding())
                .statusBarsPadding()
        ) {
            when (tab) {
                Tab.Beranda -> LayarBeranda(vm, keadaan) { id ->
                    praPengingat = id; bukaInput = true
                }
                Tab.Transaksi -> LayarTransaksi(vm, keadaan)
                Tab.Laporan -> LayarLaporan(vm, keadaan)
                Tab.Profil -> LayarProfil(vm, keadaan)
            }
        }
    }

    if (bukaInput) {
        SheetInput(
            vm = vm,
            keadaan = keadaan,
            pengingatId = praPengingat,
            onTutup = { bukaInput = false; praPengingat = null }
        )
    }
}

@Composable
private fun NavBawah(aktif: Tab, onPilih: (Tab) -> Unit, onCatat: () -> Unit) {
    Column {
        Spacer(
            Modifier
                .fillMaxWidth()
                .height(TebalBorder)
                .background(Tinta)
        )
        Row(
            Modifier
                .fillMaxWidth()
                .background(Krem)
                .navigationBarsPadding()
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TombolNav(Tab.Beranda, aktif, onPilih)
            TombolNav(Tab.Transaksi, aktif, onPilih)

            /* Tombol catat sengaja di tengah dan paling menonjol:
               mencatat adalah satu-satunya hal yang harus dilakukan
               tiap hari agar semua angka lain tetap benar. */
            Box(
                Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Hijau)
                    .border(TebalBorder, Tinta, RoundedCornerShape(16.dp))
                    .clickable { onCatat() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.Add, "Catat transaksi", tint = Color.White)
            }

            TombolNav(Tab.Laporan, aktif, onPilih)
            TombolNav(Tab.Profil, aktif, onPilih)
        }
    }
}

@Composable
private fun TombolNav(t: Tab, aktif: Tab, onPilih: (Tab) -> Unit) {
    val dipilih = t == aktif
    Column(
        Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable { onPilih(t) }
            .padding(horizontal = 10.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            t.ikon, t.label,
            tint = if (dipilih) Tinta else TintaLembut,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.height(2.dp))
        Text(
            t.label,
            fontSize = 10.sp,
            fontWeight = if (dipilih) FontWeight.Bold else FontWeight.Medium,
            color = if (dipilih) Tinta else TintaLembut
        )
    }
}
