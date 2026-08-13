package id.my.ibstudio.dompetq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.JENIS_MASUK
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_AKUN
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_KANTONG
import id.my.ibstudio.dompetq.data.Transaksi
import id.my.ibstudio.dompetq.domain.SelMinus
import id.my.ibstudio.dompetq.util.rupiah
import id.my.ibstudio.dompetq.util.uid
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SheetInput(vm: VM, keadaan: Keadaan, pengingatId: String?, onTutup: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val lingkup = rememberCoroutineScope()

    var jenis by remember { mutableStateOf(JENIS_KELUAR) }
    var nominal by remember { mutableStateOf("") }
    var keterangan by remember { mutableStateOf("") }
    var akunId by remember { mutableStateOf(keadaan.akunDefault()?.id ?: "") }
    var akunTujuanId by remember { mutableStateOf("") }
    var kantongId by remember { mutableStateOf(keadaan.kantongDefault()?.id ?: "") }
    var kantongTujuanId by remember { mutableStateOf("") }
    var kategoriId by remember { mutableStateOf("") }
    var peringatan by remember { mutableStateOf<List<SelMinus>>(emptyList()) }

    /* Dibuka dari kartu pengingat: form diisi awal sesuai pengingatnya,
       tapi nominal tetap harus dikonfirmasi manusia. Uang tidak boleh
       dicatat oleh tebakan aplikasi. */
    LaunchedEffect(pengingatId) {
        val p = keadaan.pengingat.firstOrNull { it.id == pengingatId } ?: return@LaunchedEffect
        jenis = if (p.arah == JENIS_MASUK) JENIS_MASUK else JENIS_KELUAR
        if (p.nominal > 0) nominal = p.nominal.toString()
        if (p.akun_id.isNotEmpty()) akunId = p.akun_id
        if (p.kantong_id.isNotEmpty()) kantongId = p.kantong_id
        if (p.kategori_id.isNotEmpty()) kategoriId = p.kategori_id
        keterangan = p.judul
    }

    fun tutup() {
        lingkup.launch { state.hide() }.invokeOnCompletion { onTutup() }
    }

    ModalBottomSheet(
        onDismissRequest = onTutup,
        sheetState = state,
        containerColor = Krem
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 620.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
        ) {
            /* jenis */
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(KremTua)
                    .border(TebalBorder, Tinta, RoundedCornerShape(14.dp))
                    .padding(4.dp)
            ) {
                listOf(
                    JENIS_KELUAR to "Keluar",
                    JENIS_MASUK to "Masuk",
                    JENIS_TRANSFER_AKUN to "Pindah",
                    JENIS_TRANSFER_KANTONG to "Sumber"
                ).forEach { (nilai, label) ->
                    val aktif = jenis == nilai
                    if (nilai == JENIS_TRANSFER_KANTONG && keadaan.modeSederhana) return@forEach
                    Box(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (aktif) Krem else androidx.compose.ui.graphics.Color.Transparent)
                            .clickable { jenis = nilai; peringatan = emptyList() }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            label, fontSize = 12.sp,
                            fontWeight = if (aktif) FontWeight.Bold else FontWeight.Medium,
                            color = if (aktif) Tinta else TintaLembut
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Medan("Nominal", nominal, { nominal = it.filter { c -> c.isDigit() } }, angka = true, petunjuk = "0")

            val angka = nominal.toLongOrNull() ?: 0L
            if (angka > 0) {
                Text(rupiah(angka), color = TintaLembut, fontSize = 13.sp)
            }

            Spacer(Modifier.height(8.dp))

            PilihBaris(
                "Dari akun".takeIf { jenis == JENIS_TRANSFER_AKUN } ?: "Akun",
                keadaan.akun.map { it.id to it.nama }, akunId
            ) { akunId = it }

            if (jenis == JENIS_TRANSFER_AKUN) {
                PilihBaris(
                    "Ke akun",
                    keadaan.akun.filter { it.id != akunId }.map { it.id to it.nama },
                    akunTujuanId
                ) { akunTujuanId = it }
            }

            if (!keadaan.modeSederhana) {
                PilihBaris(
                    "Sumber dana".takeIf { jenis != JENIS_TRANSFER_KANTONG } ?: "Dari sumber dana",
                    keadaan.kantong.map { it.id to it.nama }, kantongId
                ) { kantongId = it }

                if (jenis == JENIS_TRANSFER_KANTONG) {
                    PilihBaris(
                        "Ke sumber dana",
                        keadaan.kantong.filter { it.id != kantongId }.map { it.id to it.nama },
                        kantongTujuanId
                    ) { kantongTujuanId = it }
                }
            }

            if (jenis == JENIS_MASUK || jenis == JENIS_KELUAR) {
                val tipe = if (jenis == JENIS_MASUK) "pemasukan" else "pengeluaran"
                PilihBaris(
                    "Kategori",
                    keadaan.kategori.filter { it.tipe == tipe }.map { it.id to it.nama },
                    kategoriId
                ) { kategoriId = it }
            }

            Medan("Keterangan (opsional)", keterangan, { keterangan = it }, petunjuk = "mis. bensin motor")

            /* Peringatan, bukan larangan: kenyataan kadang memang minus,
               dan menolak input hanya membuat orang berhenti mencatat. */
            if (peringatan.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                KartuTebal(latar = lembut(Merah)) {
                    Text("Setelah dicatat, saldo jadi minus", fontWeight = FontWeight.Bold, color = Merah)
                    Spacer(Modifier.height(4.dp))
                    peringatan.forEach {
                        Text(
                            "${it.kantong?.nama ?: "—"} di ${it.akun?.nama ?: "—"}: ${rupiah(it.sesudah)}",
                            fontSize = 13.sp
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("Tekan Simpan sekali lagi kalau memang begitu keadaannya.",
                        fontSize = 12.sp, color = TintaLembut)
                }
                Spacer(Modifier.height(JarakBayangan))
            }

            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { TombolPutus("Batal") { tutup() } }
                Box(Modifier.weight(1.4f)) {
                    TombolUtama("Simpan", aktif = angka > 0 && akunId.isNotEmpty()) {
                        val calon = Transaksi(
                            id = uid("trx"),
                            timestamp = System.currentTimeMillis(),
                            dibuat_pada = System.currentTimeMillis(),
                            jenis = jenis,
                            nominal = angka,
                            akun_id = akunId,
                            akun_tujuan_id = if (jenis == JENIS_TRANSFER_AKUN) akunTujuanId else "",
                            kantong_id = kantongId,
                            kantong_tujuan_id = if (jenis == JENIS_TRANSFER_KANTONG) kantongTujuanId else "",
                            kategori_id = kategoriId,
                            keterangan = keterangan.trim()
                        )

                        lingkup.launch {
                            val dampak = vm.cekDampak(calon)
                            if (dampak.isNotEmpty() && peringatan.isEmpty()) {
                                peringatan = dampak      // tampilkan dulu, simpan pada tekan kedua
                            } else {
                                vm.catat(calon)
                                tutup()
                            }
                        }
                    }
                }
            }
        }
    }
}

/* Pemilih mendatar — lebih cepat dijangkau satu ibu jari
   daripada dropdown, dan seluruh pilihan terlihat sekaligus. */
@Composable
private fun PilihBaris(
    label: String,
    pilihan: List<Pair<String, String>>,
    terpilih: String,
    onPilih: (String) -> Unit
) {
    if (pilihan.isEmpty()) return
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TintaLembut)
        Spacer(Modifier.height(6.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            pilihan.forEach { (id, nama) ->
                val aktif = id == terpilih
                Box(
                    Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (aktif) Hijau.copy(alpha = 0.15f) else Krem)
                        .border(1.6.dp, if (aktif) Hijau else TintaLembut, RoundedCornerShape(999.dp))
                        .clickable { onPilih(id) }
                        .padding(horizontal = 14.dp, vertical = 9.dp)
                ) {
                    Text(
                        nama, fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (aktif) Hijau else TintaLembut
                    )
                }
            }
        }
    }
}
