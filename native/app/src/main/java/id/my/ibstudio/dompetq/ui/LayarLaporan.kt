package id.my.ibstudio.dompetq.ui

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.domain.Calc
import id.my.ibstudio.dompetq.util.awalBulan
import id.my.ibstudio.dompetq.util.akhirBulan
import id.my.ibstudio.dompetq.util.namaBulan
import id.my.ibstudio.dompetq.util.namaJenis
import id.my.ibstudio.dompetq.util.rupiah
import id.my.ibstudio.dompetq.util.rupiahSingkat
import id.my.ibstudio.dompetq.util.tglInput
import java.io.File

@Composable
fun LayarLaporan(vm: VM, k: Keadaan) {
    val ctx = LocalContext.current
    val sekarang = System.currentTimeMillis()
    val dari = awalBulan(sekarang)
    val sampai = akhirBulan(sekarang)

    /* Arus kas hanya menghitung dana milik sendiri kalau ada titipan.
       Uang titipan yang lewat bukan pemasukan pribadi. */
    val arus = Calc.arusKas(k.transaksi, k.kantong, dari, sampai, !k.modeSederhana)
    val perKat = Calc.perKategori(k.transaksi, k.kategori, dari, sampai, JENIS_KELUAR)

    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
        item {
            Spacer(Modifier.height(12.dp))
            Text("Laporan", style = MaterialTheme.typography.headlineMedium)
            Text(namaBulan(sekarang), color = TintaLembut)
            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    KartuTebal {
                        Text("Masuk", color = TintaLembut, fontSize = 12.sp)
                        Text(rupiahSingkat(arus.masuk), fontWeight = FontWeight.Bold, color = Hijau)
                    }
                }
                Box(Modifier.weight(1f)) {
                    KartuTebal {
                        Text("Keluar", color = TintaLembut, fontSize = 12.sp)
                        Text(rupiahSingkat(arus.keluar), fontWeight = FontWeight.Bold, color = Merah)
                    }
                }
            }
            Spacer(Modifier.height(JarakBayangan + 12.dp))

            KartuTebal(Modifier.fillMaxWidth()) {
                Text("Selisih bulan ini", color = TintaLembut, fontSize = 12.sp)
                Text(
                    rupiah(arus.selisih),
                    style = MaterialTheme.typography.headlineSmall,
                    color = if (arus.selisih < 0) Merah else Hijau
                )
            }
            Spacer(Modifier.height(JarakBayangan + 6.dp))

            if (!k.modeSederhana) {
                Text(
                    "Pemasukan & pengeluaran di atas hanya menghitung dana milikmu " +
                        "sendiri. Uang titipan tidak ikut.",
                    color = TintaLembut, fontSize = 12.sp
                )
            }
        }

        item {
            JudulSeksi("Pengeluaran per kategori")
            if (perKat.rows.isEmpty()) {
                Text("Belum ada pengeluaran bulan ini.", color = TintaLembut, fontSize = 13.sp)
            } else {
                val maks = perKat.rows.maxOf { it.nilai }
                perKat.rows.forEach {
                    Batang(it.nama, it.nilai, maks, Amber, rupiahSingkat(it.nilai))
                }
            }
        }

        item {
            JudulSeksi("Ekspor")
            TombolGaris("Bagikan CSV — semua transaksi") {
                bagikan(ctx, "dompetq-transaksi-${tglInput(sekarang)}.csv", csvSemua(k), "text/csv")
            }
            Spacer(Modifier.height(10.dp))
            TombolGaris("Bagikan cadangan data (JSON)") {
                bagikan(ctx, "dompetq-cadangan-${tglInput(sekarang)}.json", jsonCadangan(k), "application/json")
            }
        }

        /* Laporan pertanggungjawaban per sumber dana titipan —
           dokumen yang harus bisa ditunjukkan ke pemilik uangnya. */
        val titipan = k.kantong.filter { it.jenis == KANTONG_TITIPAN }
        if (titipan.isNotEmpty()) {
            item { JudulSeksi("Mutasi sumber dana") }
            items(titipan.size) { i ->
                val kt = titipan[i]
                Spacer(Modifier.height(8.dp))
                TombolGaris("Bagikan mutasi ${kt.nama}") {
                    val slug = kt.nama.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
                    bagikan(
                        ctx, "mutasi-$slug-${tglInput(sekarang)}.csv",
                        csvMutasi(k, kt.id), "text/csv"
                    )
                }
            }
        }

        item { Spacer(Modifier.height(40.dp)) }
    }
}

/* Excel membaca CSV sebagai ANSI kalau tidak diawali byte-order-mark,
   sehingga "Donasi & Sedekah" berubah jadi mojibake. Ditulis sebagai
   escape, bukan karakter BOM asli, supaya berkas sumbernya sendiri
   tidak mengandung BOM di tengah — persis yang dikeluhkan lint. */
private const val BOM_EXCEL = "\uFEFF"

private fun csvEsc(s: String): String =
    if (s.contains(';') || s.contains('"') || s.contains('\n'))
        "\"" + s.replace("\"", "\"\"") + "\"" else s

private fun csvSemua(k: Keadaan): String {
    val b = StringBuilder(BOM_EXCEL)
    b.append("tanggal;jenis;nominal;akun;sumber_dana;kategori;keterangan\n")
    k.transaksi.sortedBy { it.timestamp }.forEach { t ->
        b.append(
            listOf(
                tglInput(t.timestamp),
                namaJenis(t.jenis),
                t.nominal.toString(),
                k.akun(t.akun_id)?.nama ?: "",
                k.kantong(t.kantong_id)?.nama ?: "",
                k.kategori(t.kategori_id)?.nama ?: "",
                t.keterangan
            ).joinToString(";") { csvEsc(it) }
        ).append("\n")
    }
    return b.toString()
}

private fun csvMutasi(k: Keadaan, kantongId: String): String {
    val m = Calc.mutasiKantong(k.transaksi, kantongId)
    val b = StringBuilder(BOM_EXCEL)
    b.append("tanggal;keterangan;akun;masuk;keluar;saldo\n")
    m.rows.forEach { r ->
        b.append(
            listOf(
                tglInput(r.tx.timestamp),
                r.tx.keterangan.ifEmpty { k.kategori(r.tx.kategori_id)?.nama ?: namaJenis(r.tx.jenis) },
                k.akun(r.tx.akun_id)?.nama ?: "",
                if (r.delta > 0) r.delta.toString() else "",
                if (r.delta < 0) (-r.delta).toString() else "",
                r.saldo.toString()
            ).joinToString(";") { csvEsc(it) }
        ).append("\n")
    }
    return b.toString()
}

/* Cadangan ditulis dengan nama bidang yang sama persis dengan versi
   web, supaya berkas dari satu versi bisa dibaca versi lainnya. */
private fun jsonCadangan(k: Keadaan): String {
    fun s(x: String) = "\"" + x.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    val b = StringBuilder("{\n")
    b.append("  \"versi_skema\": 1,\n")
    b.append("  \"profil\": {\"nama\": ${s(k.profil.nama)}, \"email\": ${s(k.profil.email)}},\n")

    b.append("  \"akun\": [\n")
    b.append(k.akun.joinToString(",\n") {
        "    {\"id\": ${s(it.id)}, \"nama\": ${s(it.nama)}, \"jenis\": ${s(it.jenis)}}"
    })
    b.append("\n  ],\n")

    b.append("  \"kantong\": [\n")
    b.append(k.kantong.joinToString(",\n") {
        "    {\"id\": ${s(it.id)}, \"nama\": ${s(it.nama)}, \"jenis\": ${s(it.jenis)}}"
    })
    b.append("\n  ],\n")

    b.append("  \"kategori\": [\n")
    b.append(k.kategori.joinToString(",\n") {
        "    {\"id\": ${s(it.id)}, \"nama\": ${s(it.nama)}, \"tipe\": ${s(it.tipe)}}"
    })
    b.append("\n  ],\n")

    b.append("  \"transaksi\": [\n")
    b.append(k.transaksi.joinToString(",\n") {
        "    {\"id\": ${s(it.id)}, \"timestamp\": ${s(tglInput(it.timestamp))}, " +
            "\"jenis\": ${s(it.jenis)}, \"nominal\": ${it.nominal}, " +
            "\"akun_id\": ${s(it.akun_id)}, \"akun_tujuan_id\": ${s(it.akun_tujuan_id)}, " +
            "\"kantong_id\": ${s(it.kantong_id)}, \"kantong_tujuan_id\": ${s(it.kantong_tujuan_id)}, " +
            "\"kategori_id\": ${s(it.kategori_id)}, \"keterangan\": ${s(it.keterangan)}, " +
            "\"reversal_dari\": ${s(it.reversal_dari)}}"
    })
    b.append("\n  ]\n}\n")
    return b.toString()
}

/* Berkas ditulis ke cache lalu diserahkan ke lembar berbagi sistem —
   pengguna yang memutuskan mau disimpan ke Files, Drive, atau dikirim. */
private fun bagikan(ctx: Context, nama: String, isi: String, mime: String) {
    val dir = File(ctx.cacheDir, "ekspor").apply { mkdirs() }
    val berkas = File(dir, nama)
    berkas.writeText(isi)

    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", berkas)
    val kirim = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, nama)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    ctx.startActivity(Intent.createChooser(kirim, "Simpan $nama"))
}
