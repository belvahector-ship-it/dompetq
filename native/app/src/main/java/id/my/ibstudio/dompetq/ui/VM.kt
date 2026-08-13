package id.my.ibstudio.dompetq.ui

import android.app.Application
import android.content.Intent
import android.content.IntentSender
import id.my.ibstudio.dompetq.sinkron.Arah
import id.my.ibstudio.dompetq.sinkron.ButuhIzinGoogle
import id.my.ibstudio.dompetq.sinkron.GoogleApi
import id.my.ibstudio.dompetq.sinkron.GoogleSesi
import id.my.ibstudio.dompetq.sinkron.IsiJauh
import id.my.ibstudio.dompetq.sinkron.MesinSinkron
import id.my.ibstudio.dompetq.sinkron.SheetsAdapter
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import id.my.ibstudio.dompetq.DompetQApp
import id.my.ibstudio.dompetq.data.Akun
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.JENIS_MASUK
import id.my.ibstudio.dompetq.data.JENIS_SALDO_AWAL
import id.my.ibstudio.dompetq.data.KANTONG_MILIK_SENDIRI
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.data.Kantong
import id.my.ibstudio.dompetq.data.Kategori
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.data.Profil
import id.my.ibstudio.dompetq.data.SEED_KATEGORI_KELUAR
import id.my.ibstudio.dompetq.data.SEED_KATEGORI_MASUK
import id.my.ibstudio.dompetq.data.Transaksi
import id.my.ibstudio.dompetq.domain.Calc
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import id.my.ibstudio.dompetq.domain.PerluDitanya
import id.my.ibstudio.dompetq.domain.Ringkas
import id.my.ibstudio.dompetq.domain.SelMinus
import id.my.ibstudio.dompetq.pengingat.AlarmPenjadwal
import id.my.ibstudio.dompetq.pengingat.Kalender
import id.my.ibstudio.dompetq.util.tglInput
import id.my.ibstudio.dompetq.util.uid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class KeadaanSinkron(
    val aktif: Boolean = false,
    val sedang: Boolean = false,
    val bentrok: Boolean = false,
    val email: String? = null,
    val terakhir: Long = 0,
    val galat: String? = null
)

data class Keadaan(
    val siap: Boolean = false,
    val profil: Profil = Profil(),
    val akun: List<Akun> = emptyList(),
    val kantong: List<Kantong> = emptyList(),
    val kategori: List<Kategori> = emptyList(),
    val transaksi: List<Transaksi> = emptyList(),
    val pengingat: List<Pengingat> = emptyList()
) {
    val ringkas: Ringkas get() = Calc.ringkas(akun, kantong, transaksi)

    /* true kalau pengguna tidak memegang uang titipan sama sekali —
       seluruh UI sumber dana disembunyikan. (konsep.md §3.2 aturan 4) */
    val modeSederhana: Boolean get() = kantong.none { it.jenis == KANTONG_TITIPAN }

    val perluDitanya: List<PerluDitanya> get() = JadwalPengingat.perluDitanya(pengingat)

    fun akun(id: String) = akun.firstOrNull { it.id == id }
    fun kantong(id: String) = kantong.firstOrNull { it.id == id }
    fun kategori(id: String) = kategori.firstOrNull { it.id == id }
    fun akunDefault() = akun.firstOrNull { it.is_default } ?: akun.firstOrNull()
    fun kantongDefault() = kantong.firstOrNull { it.is_default } ?: kantong.firstOrNull()
}

class VM(app: Application) : AndroidViewModel(app) {

    private val repo = DompetQApp.repo(app)
    private val ctx get() = getApplication<Application>()

    private val _pesan = MutableStateFlow<String?>(null)
    val pesan: StateFlow<String?> = _pesan

    fun tampilkanPesan(t: String) { _pesan.value = t }
    fun bersihkanPesan() { _pesan.value = null }

    /* Dipecah jadi dua kelompok bertipe jelas. combine() dengan enam
       aliran heterogen memaksa inferensi ke Array<Any?> dan cast manual;
       dua Triple jauh lebih aman dari salah urutan indeks. */
    private val bagianMaster = combine(
        repo.profilAliran, repo.akunAliran, repo.kantongAliran
    ) { p, a, k -> Triple(p, a, k) }

    private val bagianCatatan = combine(
        repo.kategoriAliran, repo.transaksiAliran, repo.pengingatAliran
    ) { kat, t, pg -> Triple(kat, t, pg) }

    val keadaan: StateFlow<Keadaan> =
        combine(bagianMaster, bagianCatatan) { master, catatan ->
            Keadaan(
                siap = true,
                profil = master.first ?: Profil(),
                akun = master.second,
                kantong = master.third,
                kategori = catatan.first,
                transaksi = catatan.second,
                pengingat = catatan.third
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Keadaan())

    /* ── onboarding ── */
    fun simpanProfilAwal(nama: String, email: String) = viewModelScope.launch {
        repo.mulaiBaru(nama, email)
    }

    fun tambahAkun(nama: String, bankKode: String, jenis: String) = viewModelScope.launch {
        repo.tambahAkun(nama, bankKode, jenis)
    }

    fun hapusAkun(a: Akun) = viewModelScope.launch {
        if (!repo.hapusAkun(a)) {
            tampilkanPesan("${a.nama} sudah dipakai transaksi — tidak bisa dihapus.")
        }
    }

    fun tambahKantong(nama: String, jenis: String) = viewModelScope.launch {
        repo.tambahKantong(nama, jenis)
    }

    fun hapusKantong(k: Kantong) = viewModelScope.launch {
        if (!repo.hapusKantong(k)) {
            tampilkanPesan("${k.nama} sudah dipakai transaksi — tidak bisa dihapus.")
        }
    }

    fun tambahKategori(nama: String, tipe: String) = viewModelScope.launch {
        repo.tambahKategori(nama, tipe)
    }

    fun hapusKategori(k: Kategori) = viewModelScope.launch {
        if (!repo.hapusKategori(k)) {
            tampilkanPesan("${k.nama} sudah dipakai transaksi — tidak bisa dihapus.")
        }
    }

    fun pasangKategoriBawaan(keluar: Set<String>, masuk: Set<String>) = viewModelScope.launch {
        SEED_KATEGORI_KELUAR.filter { it in keluar }.forEach { repo.tambahKategori(it, "pengeluaran") }
        SEED_KATEGORI_MASUK.filter { it in masuk }.forEach { repo.tambahKategori(it, "pemasukan") }
    }

    /* Saldo awal dicatat sebagai transaksi, bukan angka yang ditanam
       langsung — supaya matriks tetap satu-satunya sumber kebenaran. */
    fun pasangSaldoAwal(saldo: Map<String, Long>, kantongId: String) = viewModelScope.launch {
        val sekarang = System.currentTimeMillis()
        saldo.filterValues { it != 0L }.forEach { (akunId, nominal) ->
            repo.catat(
                Transaksi(
                    id = uid("trx"), timestamp = sekarang, dibuat_pada = sekarang,
                    jenis = JENIS_SALDO_AWAL, nominal = nominal,
                    akun_id = akunId, kantong_id = kantongId,
                    keterangan = "Saldo awal"
                )
            )
        }
    }

    /* Dana titipan dibagi rata secara proporsional ke akun-akun yang
       ada, kecuali pengguna merincinya sendiri. Uang titipan memang
       sering tersebar dan tidak selalu diketahui ada di rekening mana. */
    fun pasangTitipanProporsional(kantongId: String, total: Long) = viewModelScope.launch {
        if (total <= 0L) return@launch
        val (akun, kantong, tx) = repo.snapshot()
        val saldoAkun = Calc.ringkas(akun, kantong, tx).saldoAkun
        val milik = kantong.firstOrNull { it.jenis == KANTONG_MILIK_SENDIRI } ?: return@launch
        val sekarang = System.currentTimeMillis()
        var sisa = total

        /* Akun kosong disaring DULU, bukan dilewati di tengah perulangan.
           Kalau tidak, "akun terakhir" bisa jatuh pada akun bersaldo nol
           yang dilewati — sisa pembulatan tidak pernah dibagikan dan total
           titipan meleset beberapa rupiah dari yang diketik pengguna. */
        val layak = akun
            .filter { (saldoAkun[it.id] ?: 0L) > 0L }
            .sortedByDescending { saldoAkun[it.id] ?: 0L }
        if (layak.isEmpty()) return@launch

        /* Pembagi dihitung dari akun yang layak saja. Kalau memakai jumlah
           seluruh akun, satu rekening bersaldo minus akan mengecilkan
           pembagi dan porsi tiap akun jadi terlalu besar. */
        val totalFisik = layak.sumOf { saldoAkun[it.id] ?: 0L }
        if (totalFisik <= 0L) return@launch

        layak.forEachIndexed { i, a ->
            val saldo = saldoAkun[a.id] ?: 0L
            /* Akun layak TERAKHIR menyerap seluruh sisa, supaya jumlahnya
               persis sama dengan yang diketik — bukan hasil pembulatan. */
            val bagian = if (i == layak.lastIndex) sisa
            else (total.toDouble() * saldo / totalFisik).toLong().coerceIn(0L, sisa)
            if (bagian <= 0L) return@forEachIndexed
            sisa -= bagian

            repo.catat(
                Transaksi(
                    id = uid("trx"), timestamp = sekarang, dibuat_pada = sekarang,
                    jenis = id.my.ibstudio.dompetq.data.JENIS_TRANSFER_KANTONG,
                    nominal = bagian, akun_id = a.id,
                    kantong_id = milik.id, kantong_tujuan_id = kantongId,
                    keterangan = "Pemisahan dana titipan awal"
                )
            )
        }
    }

    fun selesaikanOnboarding() = viewModelScope.launch { repo.selesaikanOnboarding() }

    /* ── transaksi ── */
    suspend fun cekDampak(calon: Transaksi): List<SelMinus> {
        val (akun, kantong, tx) = repo.snapshot()
        return Calc.cekDampak(akun, kantong, tx, calon)
    }

    fun catat(t: Transaksi) = viewModelScope.launch {
        repo.catat(t)
        tampilkanPesan("Tercatat")
        cerminkan()
    }

    fun batalkan(txId: String) = viewModelScope.launch {
        if (repo.batalkan(txId) != null) {
            tampilkanPesan("Dikoreksi dengan entri pembalik")
            cerminkan()
        } else {
            tampilkanPesan("Transaksi ini sudah pernah dikoreksi")
        }
    }

    fun sesuaikanSaldo(akunId: String, saldoBaru: Long, kantongId: String) = viewModelScope.launch {
        val hasil = repo.sesuaikanSaldo(akunId, saldoBaru, kantongId)
        tampilkanPesan(if (hasil == null) "Saldo sudah sesuai" else "Selisih dicatat sebagai penyesuaian")
    }

    /* ── kunci saldo ── */
    fun pasangKunci(pin: String) = viewModelScope.launch {
        repo.pasangKunci(pin); tampilkanPesan("Saldo dikunci")
    }

    fun bukaKunci(pin: String, hasil: (Boolean) -> Unit) = viewModelScope.launch {
        hasil(repo.bukaKunci(pin))
    }

    fun kunciLagi() = viewModelScope.launch { repo.kunciLagi() }

    fun hapusKunci(pin: String, hasil: (Boolean) -> Unit) = viewModelScope.launch {
        hasil(repo.hapusKunci(pin))
    }

    /* ── pengingat ──
       Setiap perubahan pengingat harus ikut memperbarui alarm sistem
       dan agenda kalender; kalau tidak, aplikasi dan sistem operasi
       akan menyimpan dua jadwal yang berbeda. */
    fun simpanPengingat(p: Pengingat, tulisKalender: Boolean) = viewModelScope.launch {
        var akhir = p

        /* Pengingat baru dianggap sudah beres untuk periode yang sedang
           berjalan. Tanpa ini, membuat pengingat "tiap tanggal 24" pada
           tanggal 13 langsung menuduh pengguna melewatkan tanggal 24
           bulan lalu — padahal aplikasi belum mengenal tagihan itu.
           Yang pertama ditanyakan adalah jatuh tempo BERIKUTNYA. */
        if (repo.pengingat(p.id) == null && p.terakhir_dipenuhi.isEmpty()) {
            val jatuh = JadwalPengingat.jatuhTerakhir(akhir, System.currentTimeMillis())
            akhir = akhir.copy(terakhir_dipenuhi = tglInput(jatuh.timeInMillis))
        }

        if (tulisKalender && Kalender.bolehTulis(ctx)) {
            akhir = akhir.copy(kalender_event_id = Kalender.perbarui(ctx, akhir))
        } else if (!tulisKalender && p.kalender_event_id != 0L) {
            Kalender.hapus(ctx, p.kalender_event_id)
            akhir = akhir.copy(kalender_event_id = 0)
        }
        repo.simpanPengingat(akhir)
        AlarmPenjadwal.pasang(ctx, akhir)
    }

    fun hapusPengingat(p: Pengingat) = viewModelScope.launch {
        AlarmPenjadwal.batalkan(ctx, p)
        Kalender.hapus(ctx, p.kalender_event_id)
        repo.hapusPengingat(p)
    }

    fun tandaiTerpenuhi(p: Pengingat) = viewModelScope.launch {
        val baru = p.copy(terakhir_dipenuhi = tglInput(System.currentTimeMillis()), ditunda_sampai = "")
        repo.simpanPengingat(baru)
        AlarmPenjadwal.pasang(ctx, baru)
    }

    fun tundaSehari(p: Pengingat) = viewModelScope.launch {
        val besok = System.currentTimeMillis() + 86_400_000L
        repo.simpanPengingat(p.copy(ditunda_sampai = tglInput(besok)))
    }

    fun lewati(p: Pengingat) = viewModelScope.launch {
        val jatuh = JadwalPengingat.jatuhTerakhir(p, System.currentTimeMillis())
        val baru = p.copy(terakhir_dipenuhi = tglInput(jatuh.timeInMillis), ditunda_sampai = "")
        repo.simpanPengingat(baru)
        AlarmPenjadwal.pasang(ctx, baru)
    }

    /* Dipanggil setelah izin notifikasi diberikan, dan saat aplikasi
       dibuka — alarm bisa hilang karena berbagai sebab di luar kendali
       aplikasi (force stop, penghemat baterai agresif). */
    fun pasangUlangSemuaAlarm() = viewModelScope.launch {
        AlarmPenjadwal.pasangSemua(ctx, repo.pengingatSemua())
    }

    /* ══════════ SINKRON GOOGLE SHEETS ══════════
       Lokal SELALU jadi sumber baca. Sheets dipasang sebagai CERMIN —
       tujuan tulis kedua, bukan pengganti. Gagal menulis ke Sheets
       tidak pernah menghilangkan transaksi, karena salinannya sudah
       ada di perangkat. (konsep.md §9.2) */

    private val adapter by lazy { SheetsAdapter(ctx) }

    private val _sinkron = MutableStateFlow(KeadaanSinkron())
    val sinkron: StateFlow<KeadaanSinkron> = _sinkron

    /* Layar persetujuan Google hanya boleh dibuka Activity, jadi
       IntentSender-nya dititipkan ke UI lewat sini. */
    private val _mintaIzin = MutableStateFlow<IntentSender?>(null)
    val mintaIzin: StateFlow<IntentSender?> = _mintaIzin
    fun izinDiluncurkan() { _mintaIzin.value = null }

    private var jauhTertahan: IsiJauh? = null

    fun sambungkan() = viewModelScope.launch {
        _sinkron.value = _sinkron.value.copy(sedang = true, galat = null)
        try {
            GoogleSesi.token(ctx)
            lanjutkanSambung()
        } catch (e: ButuhIzinGoogle) {
            _sinkron.value = _sinkron.value.copy(sedang = false)
            _mintaIzin.value = e.intent
        } catch (e: Exception) {
            _sinkron.value = _sinkron.value.copy(sedang = false, galat = pesanGalat(e))
        }
    }

    /* Dipanggil setelah pengguna menyelesaikan layar persetujuan. */
    fun izinSelesai(data: Intent?) = viewModelScope.launch {
        try {
            if (!GoogleSesi.terimaHasil(ctx, data)) {
                _sinkron.value = _sinkron.value.copy(
                    sedang = false,
                    galat = "Izin Google tidak diberikan. Sinkron tidak bisa jalan tanpa itu."
                )
                return@launch
            }
            _sinkron.value = _sinkron.value.copy(sedang = true, galat = null)
            lanjutkanSambung()
        } catch (e: Exception) {
            /* Termasuk ScopeKurang: kotak izin tidak dicentang. Harus
               terlihat sekarang, bukan muncul sebagai 403 misterius
               saat penulisan pertama. */
            _sinkron.value = _sinkron.value.copy(sedang = false, galat = pesanGalat(e))
        }
    }

    private suspend fun lanjutkanSambung() {
        GoogleSesi.catatEmail(GoogleApi.email(ctx))
        val jauh = adapter.muat()
        val adaLokal = repo.adaIsiLokal()

        when (MesinSinkron.putuskan(adaLokal, jauh)) {
            Arah.UNGGAH -> {
                unggahSekarang()
                _sinkron.value = KeadaanSinkron(
                    aktif = true, email = GoogleSesi.email,
                    terakhir = System.currentTimeMillis()
                )
            }
            Arah.UNDUH -> {
                terapkanUnduh(jauh!!, gabung = false)
                _sinkron.value = KeadaanSinkron(
                    aktif = true, email = GoogleSesi.email,
                    terakhir = System.currentTimeMillis()
                )
            }
            Arah.BENTROK -> {
                /* Dua sisi sama-sama berisi. Aplikasi TIDAK memilih
                   sendiri — ada uang orang lain di dalamnya. */
                jauhTertahan = jauh
                _sinkron.value = _sinkron.value.copy(
                    sedang = false, bentrok = true, email = GoogleSesi.email
                )
            }
        }
    }

    fun pilihBentrok(cara: String) = viewModelScope.launch {
        val jauh = jauhTertahan ?: return@launch
        _sinkron.value = _sinkron.value.copy(sedang = true, bentrok = false)
        try {
            when (cara) {
                "unggah" -> unggahSekarang()
                "unduh" -> terapkanUnduh(jauh, gabung = false)
                "satukan" -> terapkanUnduh(jauh, gabung = true)
            }
            jauhTertahan = null
            _sinkron.value = KeadaanSinkron(
                aktif = true, email = GoogleSesi.email,
                terakhir = System.currentTimeMillis()
            )
        } catch (e: Exception) {
            _sinkron.value = _sinkron.value.copy(sedang = false, galat = pesanGalat(e))
        }
    }

    fun batalBentrok() {
        jauhTertahan = null
        _sinkron.value = _sinkron.value.copy(bentrok = false, sedang = false)
    }

    private suspend fun unggahSekarang() {
        adapter.simpan(repo.untukSinkron())
    }

    private suspend fun terapkanUnduh(jauh: IsiJauh, gabung: Boolean) {
        val lokal = repo.untukSinkron()
        val transaksi = if (gabung)
            MesinSinkron.satukanTransaksi(lokal.transaksi, jauh.transaksi)
        else jauh.transaksi

        val pengingat = MesinSinkron.satukanPengingat(jauh.pengingat, lokal.pengingat)

        repo.terapkanJauh(jauh, transaksi, pengingat)
        AlarmPenjadwal.pasangSemua(ctx, pengingat)

        /* Kalau digabung, sisi jauh belum memuat transaksi lokal —
           cermin harus disamakan lagi. */
        if (gabung) adapter.simpan(repo.untukSinkron())
    }

    /* Tulis ke Sheets berjalan di latar dan TIDAK ditunggu: pengguna
       tidak boleh menunggu jaringan hanya untuk mencatat satu
       pengeluaran. Gagalnya dicatat, tidak membatalkan apa pun. */
    fun cerminkan() {
        if (!_sinkron.value.aktif) return
        viewModelScope.launch {
            _sinkron.value = _sinkron.value.copy(sedang = true)
            try {
                unggahSekarang()
                _sinkron.value = _sinkron.value.copy(
                    sedang = false, terakhir = System.currentTimeMillis(), galat = null
                )
            } catch (e: Exception) {
                _sinkron.value = _sinkron.value.copy(sedang = false, galat = pesanGalat(e))
            }
        }
    }

    fun putuskanSinkron() = viewModelScope.launch {
        GoogleSesi.putuskan(ctx)
        jauhTertahan = null
        _sinkron.value = KeadaanSinkron()
    }

    private fun pesanGalat(e: Exception): String =
        e.message ?: "Gagal menghubungi Google."

    /* ── data ── */
    fun hapusSemua() = viewModelScope.launch {
        repo.pengingatSemua().forEach {
            AlarmPenjadwal.batalkan(ctx, it)
            Kalender.hapus(ctx, it.kalender_event_id)
        }
        repo.hapusSemua()
    }

}
