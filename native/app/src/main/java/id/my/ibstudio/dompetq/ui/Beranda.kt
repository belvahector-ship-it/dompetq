package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.domain.Calc
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import id.my.ibstudio.dompetq.util.namaJenis
import id.my.ibstudio.dompetq.util.rupiah
import id.my.ibstudio.dompetq.util.rupiahSingkat
import id.my.ibstudio.dompetq.util.tglPendek

@Composable
fun LayarBeranda(vm: VM, k: Keadaan, onCatatDariPengingat: (String) -> Unit) {
    val r = k.ringkas
    val perlu = k.perluDitanya

    LazyColumn(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
    ) {
        item {
            Spacer(Modifier.height(12.dp))
            Text("Halo", color = TintaLembut, fontSize = 13.sp)
            Text(
                k.profil.nama.ifEmpty { "DompetQ" },
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(Modifier.height(16.dp))
        }

        /* Angka utama: bukan total di rekening, tapi yang benar-benar
           boleh dipakai. Inilah seluruh alasan aplikasi ini ada. */
        item {
            KartuTebal(Modifier.fillMaxWidth(), latar = Hijau) {
                Text("Uang saya bersih", color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    rupiah(r.uangSaya),
                    color = Color.White,
                    style = MaterialTheme.typography.displaySmall
                )
                if (!k.modeSederhana) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Total di tangan ${rupiah(r.totalFisik)} · titipan ${rupiah(r.titipan)}",
                        color = Color.White.copy(alpha = 0.9f), fontSize = 12.sp
                    )
                }
            }
            Spacer(Modifier.height(JarakBayangan + 12.dp))
        }

        /* Sumber dana yang jebol — uang orang lain yang terpakai.
           Ditaruh setinggi mungkin karena ini paling mendesak. */
        if (r.negatif.isNotEmpty()) {
            item {
                KartuTebal(Modifier.fillMaxWidth(), latar = lembut(Merah)) {
                    Text("Sumber dana minus", fontWeight = FontWeight.Bold, color = Merah)
                    Spacer(Modifier.height(6.dp))
                    r.negatif.forEach { (kantong, nilai) ->
                        Text(
                            "${kantong.nama}: ${rupiah(nilai)} — uang titipan sudah terpakai.",
                            fontSize = 13.sp
                        )
                    }
                }
                Spacer(Modifier.height(JarakBayangan + 12.dp))
            }
        }

        /* Pengingat yang menunggu dijawab. */
        if (perlu.isNotEmpty()) {
            item { JudulSeksi("Belum dicatat") }
            items(perlu.size) { i ->
                val pd = perlu[i]
                KartuTebal(Modifier.fillMaxWidth().padding(bottom = JarakBayangan + 10.dp), latar = lembut(Amber)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(pd.p.judul.ifEmpty { "Pencatatan rutin" }, fontWeight = FontWeight.Bold)
                            Text(
                                JadwalPengingat.teksJadwal(pd.p) + " · " +
                                    JadwalPengingat.teksTelat(pd.telat),
                                color = TintaLembut, fontSize = 12.sp
                            )
                        }
                        if (pd.p.nominal > 0) Text(rupiahSingkat(pd.p.nominal), fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) {
                            TombolUtama("Catat", latar = Hijau) { onCatatDariPengingat(pd.p.id) }
                        }
                        Box(Modifier.weight(0.8f)) {
                            TombolPutus("Nanti") { vm.tundaSehari(pd.p) }
                        }
                        Box(Modifier.weight(0.8f)) {
                            TombolPutus("Lewati") { vm.lewati(pd.p) }
                        }
                    }
                }
            }
        }

        /* Yang belum jatuh tempo — ditampilkan sebagai hitung mundur,
           bukan sebagai tunggakan. Sebelum ini pengingat hanya terlihat
           setelah terlambat, jadi tagihan yang tinggal beberapa hari
           lagi tidak muncul di mana pun. */
        val akanDatang = k.pengingat
            .filter { it.aktif && perlu.none { pd -> pd.p.id == it.id } }
            .map { it to JadwalPengingat.hariLagi(it) }
            .filter { it.second in 0..14 }
            .sortedBy { it.second }

        if (akanDatang.isNotEmpty()) {
            item { JudulSeksi("Akan datang") }
            items(akanDatang.size) { i ->
                val (p, sisa) = akanDatang[i]
                KartuTebal(Modifier.fillMaxWidth().padding(bottom = JarakBayangan + 10.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(p.judul.ifEmpty { "Pencatatan rutin" }, fontWeight = FontWeight.Bold)
                            Text(
                                JadwalPengingat.teksJadwal(p),
                                color = TintaLembut, fontSize = 12.sp
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Lencana(JadwalPengingat.teksHariLagi(sisa), Biru)
                            if (p.nominal > 0) {
                                Spacer(Modifier.height(4.dp))
                                Text(rupiahSingkat(p.nominal), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }

        item { JudulSeksi("Rekening & dompet") }
        items(k.akun.size) { i ->
            val a = k.akun[i]
            KartuTebal(Modifier.fillMaxWidth().padding(bottom = JarakBayangan + 10.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(a.nama, fontWeight = FontWeight.Bold)
                    Text(rupiah(r.saldoAkun[a.id] ?: 0L), fontWeight = FontWeight.Bold)
                }
            }
        }

        if (!k.modeSederhana) {
            item { JudulSeksi("Sumber dana") }
            items(k.kantong.size) { i ->
                val kt = k.kantong[i]
                val nilai = r.saldoKantong[kt.id] ?: 0L
                KartuTebal(Modifier.fillMaxWidth().padding(bottom = JarakBayangan + 10.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(kt.nama, fontWeight = FontWeight.Bold)
                            Text(
                                if (kt.jenis == KANTONG_TITIPAN) "Titipan" else "Milik sendiri",
                                color = TintaLembut, fontSize = 12.sp
                            )
                        }
                        Text(
                            rupiah(nilai),
                            fontWeight = FontWeight.Bold,
                            color = if (nilai < 0) Merah else Tinta
                        )
                    }
                }
            }
        }

        /* Pengeluaran 30 hari terakhir per kategori. */
        item {
            val sampai = System.currentTimeMillis()
            val dari = sampai - 30L * 86_400_000L
            val hasil = Calc.perKategori(k.transaksi, k.kategori, dari, sampai, JENIS_KELUAR)

            JudulSeksi("Pengeluaran 30 hari", rupiah(hasil.total))
            if (hasil.rows.isEmpty()) {
                Text("Belum ada pengeluaran tercatat.", color = TintaLembut, fontSize = 13.sp)
            } else {
                val maks = hasil.rows.maxOf { it.nilai }
                hasil.rows.take(6).forEach {
                    Batang(it.nama, it.nilai, maks, Amber, rupiahSingkat(it.nilai))
                }
            }
        }

        item { JudulSeksi("Terakhir dicatat") }
        val terakhir = k.transaksi.take(8)
        if (terakhir.isEmpty()) {
            item { Text("Belum ada transaksi.", color = TintaLembut, fontSize = 13.sp) }
        }
        items(terakhir.size) { i ->
            BarisTransaksi(terakhir[i], k)
        }

        item { Spacer(Modifier.height(30.dp)) }
    }
}

@Composable
fun BarisTransaksi(t: id.my.ibstudio.dompetq.data.Transaksi, k: Keadaan, onKlik: (() -> Unit)? = null) {
    val keluar = t.jenis == JENIS_KELUAR
    val koreksi = t.reversal_dari.isNotEmpty()

    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .then(if (onKlik != null) Modifier.clickable { onKlik() } else Modifier)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(4.dp)
                .height(38.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (koreksi) TintaLembut else if (keluar) Merah else Hijau)
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                t.keterangan.ifEmpty {
                    k.kategori(t.kategori_id)?.nama ?: namaJenis(t.jenis)
                },
                fontWeight = FontWeight.Bold, fontSize = 14.sp
            )
            Text(
                tglPendek(t.timestamp) + " · " + (k.akun(t.akun_id)?.nama ?: "—"),
                color = TintaLembut, fontSize = 12.sp
            )
        }
        Text(
            (if (keluar) "−" else "+") + rupiahSingkat(t.nominal).removePrefix("-"),
            fontWeight = FontWeight.Bold,
            color = if (koreksi) TintaLembut else if (keluar) Merah else Hijau,
            fontSize = 14.sp
        )
    }
}
