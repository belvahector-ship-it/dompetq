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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.my.ibstudio.dompetq.data.KANTONG_MILIK_SENDIRI
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.data.SEED_AKUN
import id.my.ibstudio.dompetq.data.SEED_KATEGORI_KELUAR
import id.my.ibstudio.dompetq.data.SEED_KATEGORI_MASUK
import id.my.ibstudio.dompetq.util.rupiah

/* ══════════════════════════════════════════════
   Onboarding enam langkah.

   Urutannya penting: profil → tempat uang → kepemilikan →
   saldo → pemisahan titipan → kategori. Saldo baru ditanya
   setelah akun terdefinisi, dan titipan setelah saldo,
   karena pembagiannya butuh angka saldo untuk dihitung.
   ══════════════════════════════════════════════ */

@Composable
fun LayarOnboarding(vm: VM, keadaan: Keadaan) {
    var langkah by remember { mutableStateOf(0) }

    var nama by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var punyaTitipan by remember { mutableStateOf<Boolean?>(null) }
    var namaPribadi by remember { mutableStateOf("Uang Pribadi") }

    val saldo = remember { mutableStateMapOf<String, String>() }
    val titipan = remember { mutableStateMapOf<String, String>() }
    val katKeluar = remember { mutableStateListOf<String>() }
    val katMasuk = remember { mutableStateListOf<String>() }

    val total = 7

    Column(
        Modifier
            .fillMaxSize()
            .background(Krem)
            .statusBarsPadding()
    ) {
        /* bilah kemajuan */
        Box(
            Modifier
                .fillMaxWidth()
                .height(6.dp)
                .background(KremTua)
        ) {
            Box(
                Modifier
                    .fillMaxWidth((langkah + 1) / total.toFloat())
                    .height(6.dp)
                    .background(Hijau)
            )
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(20.dp)
        ) {
            when (langkah) {
                0 -> LangkahSelamatDatang()
                1 -> LangkahProfil(nama, { nama = it }, email, { email = it })
                2 -> LangkahAkun(vm, keadaan)
                3 -> LangkahTitipan(punyaTitipan, { punyaTitipan = it }, namaPribadi, { namaPribadi = it }, vm, keadaan)
                4 -> LangkahSaldo(keadaan, saldo)
                5 -> LangkahNominalTitipan(keadaan, titipan)
                6 -> LangkahKategori(katKeluar, katMasuk)
            }
            Spacer(Modifier.height(24.dp))
        }

        /* navigasi */
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (langkah > 0) {
                TombolPutus("Kembali", Modifier.weight(1f)) { langkah-- }
            }
            TombolUtama(
                teks = if (langkah == 6) "Selesai" else if (langkah == 0) "Mulai" else "Lanjut",
                modifier = Modifier.weight(1.4f),
                aktif = bolehLanjut(langkah, nama, punyaTitipan, keadaan)
            ) {
                when (langkah) {
                    1 -> vm.simpanProfilAwal(nama.trim(), email.trim())

                    3 -> {
                        /* Kantong "milik sendiri" selalu dibuat, bahkan saat
                           pengguna bilang tidak punya titipan — seluruh
                           perhitungan matriks membutuhkannya sebagai kolom. */
                        if (keadaan.kantong.none { it.jenis == KANTONG_MILIK_SENDIRI }) {
                            vm.tambahKantong(
                                if (punyaTitipan == true) namaPribadi.trim().ifEmpty { "Uang Pribadi" }
                                else "Uang Pribadi",
                                KANTONG_MILIK_SENDIRI
                            )
                        }
                    }

                    4 -> {
                        val milik = keadaan.kantong.firstOrNull { it.jenis == KANTONG_MILIK_SENDIRI }
                        if (milik != null) {
                            vm.pasangSaldoAwal(
                                saldo.mapValues { (_, v) -> v.filter { it.isDigit() }.toLongOrNull() ?: 0L },
                                milik.id
                            )
                        }
                    }

                    5 -> {
                        titipan.forEach { (kantongId, teks) ->
                            val n = teks.filter { it.isDigit() }.toLongOrNull() ?: 0L
                            if (n > 0) vm.pasangTitipanProporsional(kantongId, n)
                        }
                    }

                    6 -> {
                        vm.pasangKategoriBawaan(katKeluar.toSet(), katMasuk.toSet())
                        vm.selesaikanOnboarding()
                    }
                }

                /* Langkah titipan dilewati kalau pengguna tidak memegang
                   uang orang lain — menanyakannya hanya membingungkan. */
                langkah = when {
                    langkah == 3 && punyaTitipan != true -> 4
                    langkah == 4 && punyaTitipan != true -> 6
                    langkah < 6 -> langkah + 1
                    else -> langkah
                }
            }
        }
    }
}

private fun bolehLanjut(langkah: Int, nama: String, punyaTitipan: Boolean?, k: Keadaan): Boolean =
    when (langkah) {
        1 -> nama.isNotBlank()
        2 -> k.akun.isNotEmpty()
        3 -> punyaTitipan != null
        else -> true
    }

@Composable
private fun LangkahSelamatDatang() {
    Spacer(Modifier.height(20.dp))
    Text("DompetQ", style = MaterialTheme.typography.displaySmall)
    Spacer(Modifier.height(10.dp))
    Text(
        "Tahu persis berapa uang yang benar-benar boleh kamu pakai.",
        style = MaterialTheme.typography.bodyLarge, color = TintaLembut
    )
    Spacer(Modifier.height(26.dp))
    PoinAngka("1", "Di mana uang berada", "Rekening, e-wallet, tunai")
    Spacer(Modifier.height(12.dp))
    PoinAngka("2", "Milik siapa uang itu", "Uangmu sendiri, atau titipan orang lain")
}

@Composable
private fun PoinAngka(no: String, judul: String, sub: String) {
    KartuTebal {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Hijau)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) { Text(no, color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold) }
            Spacer(Modifier.height(0.dp))
            Column(Modifier.padding(start = 12.dp)) {
                Text(judul, fontWeight = FontWeight.Bold)
                Text(sub, color = TintaLembut, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun LangkahProfil(nama: String, onNama: (String) -> Unit, email: String, onEmail: (String) -> Unit) {
    Text("Kenalan dulu", style = MaterialTheme.typography.headlineMedium)
    Text("Dipakai untuk sapaan dan judul laporan.", color = TintaLembut)
    Spacer(Modifier.height(16.dp))
    Medan("Nama panggilan", nama, onNama, petunjuk = "mis. Rahma")
    Medan("Email (opsional)", email, onEmail, petunjuk = "untuk cadangan nanti")
}

@Composable
private fun LangkahAkun(vm: VM, keadaan: Keadaan) {
    var cari by remember { mutableStateOf("") }
    var tulisSendiri by remember { mutableStateOf("") }

    Text("Uangmu ada di mana saja?", style = MaterialTheme.typography.headlineMedium)
    Text(
        "Tambahkan semua rekening, e-wallet, dan uang tunai yang kamu pegang.",
        color = TintaLembut
    )
    Spacer(Modifier.height(14.dp))

    if (keadaan.akun.isNotEmpty()) {
        keadaan.akun.forEach { a ->
            KartuTebal(Modifier.padding(bottom = 12.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(a.nama, fontWeight = FontWeight.Bold)
                    Text("Hapus", color = Merah, fontSize = 13.sp,
                        modifier = Modifier.clickable { vm.hapusAkun(a) })
                }
            }
        }
        Spacer(Modifier.height(6.dp))
    }

    Medan("Cari bank / e-wallet", cari, { cari = it }, petunjuk = "BCA, GoPay, tunai…")

    val cocok = SEED_AKUN.filter {
        cari.isBlank() || it.nama.contains(cari, ignoreCase = true)
    }.take(if (cari.isBlank()) 6 else 8)

    cocok.forEach { s ->
        val sudah = keadaan.akun.any { it.bank_kode == s.kode }
        Box(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (sudah) KremTua else Krem)
                .border(1.6.dp, if (sudah) TintaLembut else Tinta, RoundedCornerShape(12.dp))
                .clickable(enabled = !sudah) { vm.tambahAkun(s.nama, s.kode, s.jenis) }
                .padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Text(
                if (sudah) "${s.nama} — sudah ditambah" else s.nama,
                color = if (sudah) TintaLembut else Tinta,
                fontWeight = FontWeight.Bold
            )
        }
    }

    Spacer(Modifier.height(10.dp))
    Medan("Tidak ada di daftar? Tulis sendiri", tulisSendiri, { tulisSendiri = it })
    if (tulisSendiri.isNotBlank()) {
        TombolGaris("Tambah \"${tulisSendiri.trim()}\"") {
            vm.tambahAkun(tulisSendiri.trim(), "", "lainnya"); tulisSendiri = ""
        }
    }
}

@Composable
private fun LangkahTitipan(
    punya: Boolean?, onPunya: (Boolean) -> Unit,
    namaPribadi: String, onNamaPribadi: (String) -> Unit,
    vm: VM, keadaan: Keadaan
) {
    var tulis by remember { mutableStateOf("") }

    Text("Ada uang yang bukan milikmu?", style = MaterialTheme.typography.headlineMedium)
    Text(
        "Uang yang kamu pegang tapi bukan hakmu — kas RT, arisan, dana kegiatan, " +
            "titipan orang tua, modal bersama.",
        color = TintaLembut
    )
    Spacer(Modifier.height(16.dp))

    PilihanBesar("Tidak ada", "Semua uang di rekening saya milik saya sendiri", punya == false) {
        onPunya(false)
    }
    Spacer(Modifier.height(10.dp))
    PilihanBesar("Ada", "Saya memegang uang orang lain juga", punya == true) {
        onPunya(true)
    }

    if (punya == true) {
        Spacer(Modifier.height(18.dp))
        Medan("Nama untuk uangmu sendiri", namaPribadi, onNamaPribadi)

        Text("Uang titipan yang kamu pegang", color = TintaLembut, fontSize = 13.sp)
        Spacer(Modifier.height(8.dp))

        keadaan.kantong.filter { it.jenis == KANTONG_TITIPAN }.forEach { k ->
            KartuTebal(Modifier.padding(bottom = 10.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(k.nama, fontWeight = FontWeight.Bold)
                    Text("Hapus", color = Merah, fontSize = 13.sp,
                        modifier = Modifier.clickable { vm.hapusKantong(k) })
                }
            }
        }

        Medan("Tambah sumber dana titipan", tulis, { tulis = it }, petunjuk = "mis. Kas RT")
        if (tulis.isNotBlank()) {
            TombolGaris("Tambah \"${tulis.trim()}\"") {
                vm.tambahKantong(tulis.trim(), KANTONG_TITIPAN); tulis = ""
            }
        }
    }
}

@Composable
private fun PilihanBesar(judul: String, sub: String, dipilih: Boolean, onKlik: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius))
            .background(if (dipilih) Hijau.copy(alpha = 0.12f) else Krem)
            .border(TebalBorder, if (dipilih) Hijau else Tinta, RoundedCornerShape(Radius))
            .clickable { onKlik() }
            .padding(16.dp)
    ) {
        Column {
            Text(judul, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(sub, color = TintaLembut, fontSize = 13.sp)
        }
    }
}

@Composable
private fun LangkahSaldo(keadaan: Keadaan, saldo: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>) {
    Text("Berapa saldonya sekarang?", style = MaterialTheme.typography.headlineMedium)
    Text("Isi apa adanya, sesuai yang tertera hari ini. Nanti bisa dikoreksi.", color = TintaLembut)
    Spacer(Modifier.height(14.dp))

    keadaan.akun.forEach { a ->
        Medan(a.nama, saldo[a.id] ?: "", { saldo[a.id] = it }, angka = true, petunjuk = "0")
    }

    val jumlah = keadaan.akun.sumOf { saldo[it.id]?.filter { c -> c.isDigit() }?.toLongOrNull() ?: 0L }
    Spacer(Modifier.height(10.dp))
    KartuTebal(latar = KremTua) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Total di tangan", color = TintaLembut)
            Text(rupiah(jumlah), fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun LangkahNominalTitipan(
    keadaan: Keadaan,
    titipan: androidx.compose.runtime.snapshots.SnapshotStateMap<String, String>
) {
    Text("Berapa dana titipan yang kamu pegang?", style = MaterialTheme.typography.headlineMedium)
    Text(
        "Isi totalnya saja. Tidak perlu dipilah per rekening — uang titipan memang " +
            "sering tersebar, dan sisanya dihitung sistem.",
        color = TintaLembut
    )
    Spacer(Modifier.height(14.dp))

    val daftar = keadaan.kantong.filter { it.jenis == KANTONG_TITIPAN }
    if (daftar.isEmpty()) {
        Text("Tidak ada sumber dana titipan.", color = TintaLembut)
        return
    }
    daftar.forEach { k ->
        Medan(k.nama, titipan[k.id] ?: "", { titipan[k.id] = it }, angka = true, petunjuk = "0")
    }
}

@Composable
private fun LangkahKategori(
    keluar: androidx.compose.runtime.snapshots.SnapshotStateList<String>,
    masuk: androidx.compose.runtime.snapshots.SnapshotStateList<String>
) {
    Text("Kategori yang kamu pakai", style = MaterialTheme.typography.headlineMedium)
    Text("Pilih yang relevan saja. Bisa ditambah kapan pun saat mencatat.", color = TintaLembut)

    Spacer(Modifier.height(16.dp))
    Text("Pengeluaran", color = TintaLembut, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(8.dp))
    PilPilihan(SEED_KATEGORI_KELUAR, keluar)

    Spacer(Modifier.height(18.dp))
    Text("Pemasukan", color = TintaLembut, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(8.dp))
    PilPilihan(SEED_KATEGORI_MASUK, masuk)
}

@Composable
private fun PilPilihan(
    sumber: List<String>,
    terpilih: androidx.compose.runtime.snapshots.SnapshotStateList<String>
) {
    Column {
        sumber.chunked(2).forEach { baris ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                baris.forEach { nama ->
                    val aktif = nama in terpilih
                    Box(
                        Modifier
                            .weight(1f)
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (aktif) Hijau.copy(alpha = 0.15f) else Krem)
                            .border(1.6.dp, if (aktif) Hijau else TintaLembut, RoundedCornerShape(999.dp))
                            .clickable { if (aktif) terpilih.remove(nama) else terpilih.add(nama) }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            nama, fontSize = 12.sp,
                            color = if (aktif) Hijau else TintaLembut,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                if (baris.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
