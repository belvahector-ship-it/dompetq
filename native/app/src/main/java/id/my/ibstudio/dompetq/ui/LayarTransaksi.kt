package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.my.ibstudio.dompetq.data.Transaksi
import id.my.ibstudio.dompetq.util.namaJenis
import id.my.ibstudio.dompetq.util.rupiah
import id.my.ibstudio.dompetq.util.tglPanjang

@Composable
fun LayarTransaksi(vm: VM, k: Keadaan) {
    var cari by remember { mutableStateOf("") }
    var dipilih by remember { mutableStateOf<Transaksi?>(null) }

    val hasil = k.transaksi.filter {
        cari.isBlank() ||
            it.keterangan.contains(cari, true) ||
            (k.kategori(it.kategori_id)?.nama ?: "").contains(cari, true)
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(12.dp))
        Text("Transaksi", style = MaterialTheme.typography.headlineMedium)
        Medan("Cari", cari, { cari = it }, petunjuk = "keterangan atau kategori…")

        if (hasil.isEmpty()) {
            Spacer(Modifier.height(20.dp))
            Text("Tidak ada transaksi.", color = TintaLembut, fontSize = 13.sp)
        }

        LazyColumn {
            items(hasil.size) { i ->
                BarisTransaksi(hasil[i], k) { dipilih = hasil[i] }
            }
            item { Spacer(Modifier.height(30.dp)) }
        }
    }

    dipilih?.let { t ->
        AlertDialog(
            onDismissRequest = { dipilih = null },
            containerColor = Krem,
            title = { Text(t.keterangan.ifEmpty { namaJenis(t.jenis) }) },
            text = {
                Column {
                    Text(rupiah(t.nominal), style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(6.dp))
                    Text(tglPanjang(t.timestamp), color = TintaLembut, fontSize = 13.sp)
                    Text(namaJenis(t.jenis), color = TintaLembut, fontSize = 13.sp)
                    Text(k.akun(t.akun_id)?.nama ?: "—", color = TintaLembut, fontSize = 13.sp)
                    if (t.reversal_dari.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Ini entri koreksi.", color = TintaLembut, fontSize = 12.sp)
                    } else {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Koreksi tidak mengubah baris lama. Yang dibuat adalah entri " +
                                "pembalik, supaya riwayat tetap jujur.",
                            color = TintaLembut, fontSize = 12.sp
                        )
                    }
                }
            },
            confirmButton = {
                if (t.reversal_dari.isEmpty()) {
                    TextButton(onClick = { vm.batalkan(t.id); dipilih = null }) {
                        Text("Koreksi", color = Merah)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { dipilih = null }) { Text("Tutup") }
            }
        )
    }
}
