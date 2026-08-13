package id.my.ibstudio.dompetq.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.IntentSenderRequest
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.JENIS_MASUK
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import id.my.ibstudio.dompetq.pengingat.AlarmPenjadwal
import id.my.ibstudio.dompetq.pengingat.Kalender
import id.my.ibstudio.dompetq.pengingat.Notifikasi
import id.my.ibstudio.dompetq.util.jamMenit
import id.my.ibstudio.dompetq.util.rupiah
import id.my.ibstudio.dompetq.util.tglPanjang
import id.my.ibstudio.dompetq.util.uid

@Composable
fun LayarProfil(vm: VM, k: Keadaan) {
    val ctx = LocalContext.current

    var izinNotif by remember { mutableStateOf(Notifikasi.bolehTampil(ctx)) }
    var izinKalender by remember { mutableStateOf(Kalender.bolehTulis(ctx)) }
    var editPengingat by remember { mutableStateOf<Pengingat?>(null) }
    var konfirmasiHapus by remember { mutableStateOf(false) }

    val mintaNotif = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { diberi ->
        izinNotif = diberi
        /* Alarm dipasang ulang begitu izin turun — sebelum ini alarm
           tetap berbunyi tapi notifikasinya dibuang diam-diam. */
        if (diberi) vm.pasangUlangSemuaAlarm()
    }

    val mintaKalender = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { hasil ->
        izinKalender = hasil.values.all { it }
    }

    val sinkron by vm.sinkron.collectAsStateWithLifecycle()
    val mintaIzinGoogle by vm.mintaIzin.collectAsStateWithLifecycle()

    /* Layar persetujuan Google datang sebagai IntentSender, bukan izin
       runtime biasa — harus diluncurkan lewat StartIntentSenderForResult. */
    val layarGoogle = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { hasil ->
        vm.izinSelesai(hasil.data)
    }

    LaunchedEffect(mintaIzinGoogle) {
        mintaIzinGoogle?.let {
            layarGoogle.launch(IntentSenderRequest.Builder(it).build())
            vm.izinDiluncurkan()
        }
    }

    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
        item {
            Spacer(Modifier.height(12.dp))
            Text("Profil", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(12.dp))
            KartuTebal(Modifier.fillMaxWidth()) {
                Text(k.profil.nama.ifEmpty { "—" }, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                if (k.profil.email.isNotEmpty()) {
                    Text(k.profil.email, color = TintaLembut, fontSize = 13.sp)
                }
            }
            Spacer(Modifier.height(JarakBayangan))
        }

        /* ── izin ── */
        item {
            JudulSeksi("Izin")

            BarisIzin(
                judul = "Notifikasi pengingat",
                sub = if (izinNotif) "Diizinkan — pengingat bisa muncul walau aplikasi tertutup"
                else "Belum diizinkan — pengingat hanya terlihat saat aplikasi dibuka",
                aktif = izinNotif
            ) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    mintaNotif.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    izinNotif = true
                }
            }

            Spacer(Modifier.height(10.dp))
            BarisIzin(
                judul = "Alarm tepat waktu",
                sub = if (AlarmPenjadwal.bolehTepatWaktu(ctx))
                    "Diizinkan — pengingat berbunyi tepat pada jamnya"
                else "Belum diizinkan — pengingat bisa tertunda beberapa jam",
                aktif = AlarmPenjadwal.bolehTepatWaktu(ctx)
            ) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    ctx.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
                }
            }

            Spacer(Modifier.height(10.dp))
            BarisIzin(
                judul = "Kalender",
                sub = if (izinKalender) "Diizinkan — jatuh tempo bisa ditulis sebagai agenda"
                else "Belum diizinkan — pengingat tetap jalan tanpa ini",
                aktif = izinKalender
            ) {
                mintaKalender.launch(
                    arrayOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)
                )
            }
        }

        /* ── pengingat ── */
        item {
            JudulSeksi("Pengingat")
            Text(
                "Pengingat bertanya, tidak mencatat sendiri. Nominal dan tombol " +
                    "simpan tetap di tanganmu.",
                color = TintaLembut, fontSize = 12.sp
            )
            Spacer(Modifier.height(10.dp))
        }

        items(k.pengingat.size) { i ->
            val p = k.pengingat[i]
            KartuTebal(
                Modifier.fillMaxWidth().padding(bottom = JarakBayangan + 10.dp),
                onClick = { editPengingat = p }
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(p.judul.ifEmpty { "Tanpa judul" }, fontWeight = FontWeight.Bold)
                        Text(
                            JadwalPengingat.teksJadwal(p) + " · " + jamMenit(p.jam, p.menit),
                            color = TintaLembut, fontSize = 12.sp
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "Berikutnya " + tglPanjang(
                                JadwalPengingat.jatuhBerikutnya(p, System.currentTimeMillis()).timeInMillis
                            ) + " · " + JadwalPengingat.teksHariLagi(JadwalPengingat.hariLagi(p)),
                            color = Biru, fontSize = 12.sp, fontWeight = FontWeight.Bold
                        )
                        if (p.kalender_event_id != 0L) {
                            Spacer(Modifier.height(4.dp))
                            Lencana("Di kalender", Biru)
                        }
                    }
                    Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                        if (p.nominal > 0) Text(rupiah(p.nominal), fontWeight = FontWeight.Bold)
                        Text(
                            if (p.arah == JENIS_MASUK) "Pemasukan" else "Pengeluaran",
                            color = TintaLembut, fontSize = 12.sp
                        )
                    }
                }
            }
        }

        item {
            TombolPutus("+ Tambah pengingat") {
                editPengingat = Pengingat(id = uid("igt"))
            }
        }

        /* ── Google Sheets ── */
        item {
            JudulSeksi("Google Sheets")
            Text(
                "Data tetap tersimpan di perangkat ini. Sheets dipasang sebagai " +
                    "cermin — spreadsheet dibuat di Drive milikmu sendiri, dan " +
                    "pengembang aplikasi ini tidak punya akses ke sana.",
                color = TintaLembut, fontSize = 12.sp
            )
            Spacer(Modifier.height(10.dp))

            KartuTebal(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            if (sinkron.aktif) "Tersambung" else "Belum tersambung",
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            sinkron.email ?: "Satu spreadsheet dipakai bersama web dan HP",
                            color = TintaLembut, fontSize = 12.sp
                        )
                        if (sinkron.terakhir > 0) {
                            Text(
                                "Terakhir disalin " + tglPanjang(sinkron.terakhir),
                                color = TintaLembut, fontSize = 12.sp
                            )
                        }
                    }
                    if (sinkron.sedang) Lencana("Menyalin…", Biru)
                    else Lencana(if (sinkron.aktif) "Aktif" else "Mati", if (sinkron.aktif) Hijau else Amber)
                }

                sinkron.galat?.let { g ->
                    Spacer(Modifier.height(10.dp))
                    Text(g, color = Merah, fontSize = 12.sp)
                }

                Spacer(Modifier.height(12.dp))
                if (!sinkron.aktif) {
                    TombolUtama("Sambungkan Google", latar = Biru, aktif = !sinkron.sedang) {
                        vm.sambungkan()
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1.2f)) {
                            TombolUtama("Salin sekarang", latar = Biru, aktif = !sinkron.sedang) {
                                vm.cerminkan()
                            }
                        }
                        Box(Modifier.weight(1f)) {
                            TombolPutus("Putuskan") { vm.putuskanSinkron() }
                        }
                    }
                }
            }
            Spacer(Modifier.height(JarakBayangan))
        }

        /* ── data ── */
        item {
            JudulSeksi("Data")
            Text(
                "Data tersimpan di perangkat ini saja. Rutin bagikan cadangan " +
                    "dari halaman Laporan.",
                color = TintaLembut, fontSize = 12.sp
            )
            Spacer(Modifier.height(10.dp))
            TombolGaris("Hapus semua data") { konfirmasiHapus = true }
            Spacer(Modifier.height(40.dp))
        }
    }

    editPengingat?.let { p ->
        DialogPengingat(
            awal = p,
            k = k,
            bolehKalender = izinKalender,
            onTutup = { editPengingat = null },
            onSimpan = { baru, keKalender -> vm.simpanPengingat(baru, keKalender); editPengingat = null },
            onHapus = { vm.hapusPengingat(p); editPengingat = null }
        )
    }

    /* Dua sisi sama-sama berisi. Aplikasi TIDAK memilih sendiri —
       ada uang orang lain di dalam catatan ini. */
    if (sinkron.bentrok) {
        AlertDialog(
            onDismissRequest = { vm.batalBentrok() },
            containerColor = Krem,
            title = { Text("Dua-duanya sudah berisi") },
            text = {
                Column {
                    Text(
                        "Spreadsheet di Drive dan data di HP ini sama-sama sudah ada " +
                            "isinya. Pilih mana yang berlaku.",
                        fontSize = 13.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Menyatukan aman: transaksi ber-ID unik dan tidak pernah diubah " +
                            "setelah ditulis, jadi tidak ada yang dobel dan tidak ada yang " +
                            "hilang. Master data (akun, sumber dana, kategori) diambil dari " +
                            "spreadsheet.",
                        color = TintaLembut, fontSize = 12.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { vm.pilihBentrok("satukan") }) {
                    Text("Satukan", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = { vm.pilihBentrok("unduh") }) { Text("Pakai Sheets") }
                    TextButton(onClick = { vm.pilihBentrok("unggah") }) { Text("Pakai HP ini") }
                }
            }
        )
    }

    if (konfirmasiHapus) {
        AlertDialog(
            onDismissRequest = { konfirmasiHapus = false },
            containerColor = Krem,
            title = { Text("Hapus semua data?") },
            text = {
                Text(
                    "Seluruh transaksi, akun, sumber dana, dan pengingat akan hilang " +
                        "dari perangkat ini. Tidak bisa dibatalkan."
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.hapusSemua(); konfirmasiHapus = false }) {
                    Text("Hapus", color = Merah)
                }
            },
            dismissButton = {
                TextButton(onClick = { konfirmasiHapus = false }) { Text("Batal") }
            }
        )
    }
}

@Composable
private fun BarisIzin(judul: String, sub: String, aktif: Boolean, onKlik: () -> Unit) {
    KartuTebal(Modifier.fillMaxWidth(), onClick = if (aktif) null else onKlik) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(judul, fontWeight = FontWeight.Bold)
                Text(sub, color = TintaLembut, fontSize = 12.sp)
            }
            Lencana(if (aktif) "Aktif" else "Aktifkan", if (aktif) Hijau else Amber)
        }
    }
}

@Composable
private fun DialogPengingat(
    awal: Pengingat,
    k: Keadaan,
    bolehKalender: Boolean,
    onTutup: () -> Unit,
    onSimpan: (Pengingat, Boolean) -> Unit,
    onHapus: () -> Unit
) {
    var judul by remember { mutableStateOf(awal.judul) }
    var nominal by remember { mutableStateOf(if (awal.nominal > 0) awal.nominal.toString() else "") }
    var arah by remember { mutableStateOf(awal.arah) }
    var tipe by remember { mutableStateOf(awal.jadwal_tipe) }
    var nilai by remember { mutableStateOf(awal.jadwal_nilai.toString()) }
    var jam by remember { mutableStateOf(awal.jam.toString()) }
    var keKalender by remember { mutableStateOf(awal.kalender_event_id != 0L) }

    AlertDialog(
        onDismissRequest = onTutup,
        containerColor = Krem,
        title = { Text(if (awal.judul.isEmpty()) "Pengingat baru" else "Ubah pengingat") },
        text = {
            Column(Modifier.fillMaxWidth()) {
                Medan("Judul", judul, { judul = it }, petunjuk = "mis. Gaji masuk")
                Medan("Perkiraan nominal (opsional)", nominal,
                    { nominal = it.filter { c -> c.isDigit() } }, angka = true)

                Spacer(Modifier.height(6.dp))
                Text("Jenis", color = TintaLembut, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(JENIS_MASUK to "Pemasukan", JENIS_KELUAR to "Pengeluaran").forEach { (v, l) ->
                        Box(Modifier.weight(1f)) {
                            if (arah == v) TombolUtama(l, latar = Hijau) { arah = v }
                            else TombolPutus(l) { arah = v }
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))
                Text("Jadwal", color = TintaLembut, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("harian" to "Harian", "mingguan" to "Mingguan", "bulanan" to "Bulanan")
                        .forEach { (v, l) ->
                            Box(Modifier.weight(1f)) {
                                if (tipe == v) TombolUtama(l, latar = Biru) { tipe = v }
                                else TombolPutus(l) { tipe = v }
                            }
                        }
                }

                if (tipe != "harian") {
                    Medan(
                        if (tipe == "mingguan") "Hari (0=Minggu … 6=Sabtu)" else "Tanggal (1–31)",
                        nilai, { nilai = it.filter { c -> c.isDigit() } }, angka = true
                    )
                }
                Medan("Jam (0–23)", jam, { jam = it.filter { c -> c.isDigit() } }, angka = true)

                if (bolehKalender) {
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            if (keKalender) TombolUtama("Tulis ke kalender: ya", latar = Biru) { keKalender = false }
                            else TombolPutus("Tulis ke kalender: tidak") { keKalender = true }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSimpan(
                    awal.copy(
                        judul = judul.trim(),
                        nominal = nominal.toLongOrNull() ?: 0L,
                        arah = arah,
                        jadwal_tipe = tipe,
                        jadwal_nilai = (nilai.toIntOrNull() ?: 1)
                            .coerceIn(if (tipe == "mingguan") 0 else 1, if (tipe == "mingguan") 6 else 31),
                        jam = (jam.toIntOrNull() ?: 8).coerceIn(0, 23),
                        aktif = true
                    ),
                    keKalender
                )
            }) { Text("Simpan", fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            Row {
                if (awal.judul.isNotEmpty()) {
                    TextButton(onClick = onHapus) { Text("Hapus", color = Merah) }
                }
                TextButton(onClick = onTutup) { Text("Batal") }
            }
        }
    )
}
