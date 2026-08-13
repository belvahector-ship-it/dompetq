package id.my.ibstudio.dompetq.data

import id.my.ibstudio.dompetq.domain.Calc
import id.my.ibstudio.dompetq.util.hashPin
import id.my.ibstudio.dompetq.util.uid

/* ══════════════════════════════════════════════
   Repo — satu-satunya pintu ke data.

   Aturan yang dijaga di sini, bukan di UI:
     · transaksi bersifat append-only
     · koreksi = entri pembalik, bukan edit baris lama
     · saldo tidak pernah diedit langsung, hanya lewat penyesuaian
     · default kantong harus selalu jatuh ke dana milik sendiri
   ══════════════════════════════════════════════ */

class Repo(private val dao: DompetQDao) {

    val akunAliran = dao.akunAliran()
    val kantongAliran = dao.kantongAliran()
    val kategoriAliran = dao.kategoriAliran()
    val transaksiAliran = dao.transaksiAliran()
    val pengingatAliran = dao.pengingatAliran()
    val profilAliran = dao.profilAliran()

    /* ── profil ── */
    suspend fun profil(): Profil = dao.profilSekarang() ?: Profil()

    suspend fun simpanProfil(p: Profil) = dao.simpanProfil(p)

    suspend fun mulaiBaru(nama: String, email: String) {
        dao.simpanProfil(
            Profil(
                id = 1, nama = nama, email = email,
                tanggal_mulai = System.currentTimeMillis()
            )
        )
    }

    suspend fun selesaikanOnboarding() {
        dao.simpanProfil(profil().copy(onboarding_selesai = true))
    }

    /* ── akun ── */
    suspend fun tambahAkun(nama: String, bankKode: String = "", jenis: String = "lainnya"): Akun {
        val ada = dao.akunSemua()
        val a = Akun(
            id = uid("akn"), nama = nama, bank_kode = bankKode, jenis = jenis,
            is_default = ada.isEmpty(), urutan = ada.size, aktif = true
        )
        dao.simpanAkun(a)
        return a
    }

    suspend fun ubahAkun(a: Akun) = dao.perbaruiAkun(a)

    /* Akun yang sudah dipakai transaksi tidak boleh hilang — saldo
       historisnya ikut lenyap dan matriks jadi bolong. */
    suspend fun hapusAkun(a: Akun): Boolean {
        if (dao.transaksiPakaiAkun(a.id) > 0) return false
        dao.hapusAkun(a)
        val sisa = dao.akunSemua()
        if (sisa.isNotEmpty() && sisa.none { it.is_default }) {
            dao.perbaruiAkun(sisa.first().copy(is_default = true))
        }
        return true
    }

    /* ── kantong (sumber dana) ── */
    suspend fun tambahKantong(nama: String, jenis: String): Kantong {
        val ada = dao.kantongSemua()
        val k = Kantong(
            id = uid("ktg"), nama = nama, jenis = jenis,
            is_default = jenis == KANTONG_MILIK_SENDIRI && ada.none { it.is_default },
            warna = WARNA_KANTONG[ada.size % WARNA_KANTONG.size]
        )
        dao.simpanKantong(k)
        return k
    }

    suspend fun ubahKantong(k: Kantong) = dao.perbaruiKantong(k)

    suspend fun hapusKantong(k: Kantong): Boolean {
        if (dao.transaksiPakaiKantong(k.id) > 0) return false
        dao.hapusKantong(k)
        val sisa = dao.kantongSemua()
        /* Default HARUS jatuh ke dana milik sendiri. Kalau default berpindah
           ke kantong titipan, tiap pencatatan cepat akan salah kantong dan
           angka "uang saya bersih" ikut ngawur. */
        if (sisa.isNotEmpty() && sisa.none { it.is_default }) {
            val milik = sisa.firstOrNull { it.jenis == KANTONG_MILIK_SENDIRI } ?: sisa.first()
            dao.perbaruiKantong(milik.copy(is_default = true))
        }
        return true
    }

    /* ── kategori ── */
    suspend fun tambahKategori(nama: String, tipe: String): Kategori {
        dao.cariKategori(nama, tipe)?.let { return it }
        val k = Kategori(id = uid("kat"), nama = nama, tipe = tipe)
        dao.simpanKategori(k)
        return k
    }

    suspend fun hapusKategori(k: Kategori): Boolean {
        if (dao.transaksiPakaiKategori(k.id) > 0) return false
        dao.hapusKategori(k)
        return true
    }

    /* ── transaksi ── */
    suspend fun catat(t: Transaksi): Transaksi {
        val tx = t.copy(
            id = t.id.ifEmpty { uid("trx") },
            dibuat_pada = System.currentTimeMillis()
        )
        dao.simpanTransaksi(tx)
        return tx
    }

    /* Koreksi = entri pembalik, bukan edit baris lama. Log timestamp
       harus tetap jujur — ada uang orang lain di dalamnya.
       (konsep.md §6.3) */
    suspend fun batalkan(txId: String): Transaksi? {
        val asli = dao.transaksi(txId) ?: return null
        if (asli.reversal_dari.isNotEmpty()) return null
        if (dao.jumlahPembalik(txId) > 0) return null

        var balik = asli.copy(
            id = uid("trx"),
            dibuat_pada = System.currentTimeMillis(),
            reversal_dari = txId,
            keterangan = "Koreksi: " + asli.keterangan.ifEmpty {
                id.my.ibstudio.dompetq.util.namaJenis(asli.jenis)
            }
        )

        balik = when (asli.jenis) {
            JENIS_MASUK -> balik.copy(jenis = JENIS_KELUAR)
            JENIS_KELUAR -> balik.copy(jenis = JENIS_MASUK)
            JENIS_SALDO_AWAL -> balik.copy(jenis = JENIS_KELUAR)
            JENIS_TRANSFER_AKUN -> balik.copy(
                akun_id = asli.akun_tujuan_id, akun_tujuan_id = asli.akun_id
            )
            JENIS_TRANSFER_KANTONG -> balik.copy(
                kantong_id = asli.kantong_tujuan_id, kantong_tujuan_id = asli.kantong_id
            )
            else -> balik
        }

        dao.simpanTransaksi(balik)
        return balik
    }

    suspend fun sudahDikoreksi(txId: String): Boolean = dao.jumlahPembalik(txId) > 0

    /* Saldo TIDAK PERNAH diedit langsung. Kalau angka di aplikasi berbeda
       dengan kenyataan, selisihnya dicatat sebagai transaksi penyesuaian.
       Riwayat tetap utuh dan selisihnya terlihat — itu justru sering
       menandakan ada transaksi yang lupa dicatat. */
    suspend fun sesuaikanSaldo(akunId: String, saldoBaru: Long, kantongId: String): Transaksi? {
        val akun = dao.akunSemua()
        val kantong = dao.kantongSemua()
        val tx = dao.transaksiSemua()
        val sekarang = Calc.ringkas(akun, kantong, tx).saldoAkun[akunId] ?: 0L
        val selisih = saldoBaru - sekarang
        if (selisih == 0L) return null

        val kat = tambahKategori(
            "Penyesuaian Saldo",
            if (selisih > 0) "pemasukan" else "pengeluaran"
        )

        return catat(
            Transaksi(
                id = uid("trx"),
                timestamp = System.currentTimeMillis(),
                dibuat_pada = System.currentTimeMillis(),
                jenis = if (selisih > 0) JENIS_MASUK else JENIS_KELUAR,
                nominal = kotlin.math.abs(selisih),
                akun_id = akunId,
                kantong_id = kantongId,
                kategori_id = kat.id,
                keterangan = "Penyesuaian saldo"
            )
        )
    }

    /* ── kunci saldo ── */
    suspend fun pasangKunci(pin: String) {
        val garam = uid("grm")
        dao.simpanProfil(
            profil().copy(
                kunci_garam = garam,
                kunci_hash = hashPin(pin, garam),
                saldo_terkunci = true
            )
        )
    }

    suspend fun cocokPin(pin: String): Boolean {
        val p = profil()
        if (p.kunci_hash.isEmpty()) return false
        return hashPin(pin, p.kunci_garam) == p.kunci_hash
    }

    suspend fun bukaKunci(pin: String): Boolean {
        if (!cocokPin(pin)) return false
        dao.simpanProfil(profil().copy(saldo_terkunci = false))
        return true
    }

    suspend fun kunciLagi() = dao.simpanProfil(profil().copy(saldo_terkunci = true))

    suspend fun hapusKunci(pin: String): Boolean {
        if (!cocokPin(pin)) return false
        dao.simpanProfil(profil().copy(kunci_hash = "", kunci_garam = "", saldo_terkunci = false))
        return true
    }

    /* ── pengingat ── */
    suspend fun simpanPengingat(p: Pengingat) = dao.simpanPengingat(p)
    suspend fun hapusPengingat(p: Pengingat) = dao.hapusPengingat(p)
    suspend fun pengingat(id: String) = dao.pengingat(id)
    suspend fun pengingatSemua() = dao.pengingatSemua()

    /* ── snapshot untuk perhitungan ── */
    suspend fun snapshot(): Triple<List<Akun>, List<Kantong>, List<Transaksi>> =
        Triple(dao.akunSemua(), dao.kantongSemua(), dao.transaksiSemua())

    suspend fun kategoriSemua() = dao.kategoriSemua()

    /* ── sinkron ── */

    /* Seluruh isi perangkat, untuk diunggah sebagai cermin. */
    suspend fun untukSinkron() = id.my.ibstudio.dompetq.sinkron.IsiJauh(
        profil = dao.profilSekarang(),
        akun = dao.akunSemua(),
        kantong = dao.kantongSemua(),
        kategori = dao.kategoriSemua(),
        transaksi = dao.transaksiSemua(),
        pengingat = dao.pengingatSemua()
    )

    suspend fun adaIsiLokal(): Boolean =
        dao.transaksiSemua().isNotEmpty() || dao.akunSemua().isNotEmpty()

    /* Data spreadsheet menggantikan yang di perangkat. Master data
       lama dikosongkan lebih dulu supaya penghapusan di perangkat lain
       ikut berlaku — transaksi TIDAK dikosongkan di sini, pemanggil
       yang menentukan digabung atau diganti. */
    suspend fun terapkanJauh(
        isi: id.my.ibstudio.dompetq.sinkron.IsiJauh,
        transaksiAkhir: List<Transaksi>,
        pengingatAkhir: List<Pengingat>
    ) {
        dao.kosongkanAkun(); dao.kosongkanKantong(); dao.kosongkanKategori()
        dao.kosongkanTransaksi(); dao.kosongkanPengingat()

        dao.simpanAkunBanyak(isi.akun)
        dao.simpanKantongBanyak(isi.kantong)
        dao.simpanKategoriBanyak(isi.kategori)
        dao.simpanTransaksiBanyak(transaksiAkhir)
        dao.simpanPengingatBanyak(pengingatAkhir)

        /* Profil lokal dipertahankan sebagian: onboarding_selesai dan
           nama panggilan tidak boleh hilang hanya karena spreadsheet
           dibuat perangkat lain yang profilnya masih kosong. */
        isi.profil?.let { jauh ->
            val lokal = profil()
            dao.simpanProfil(
                jauh.copy(
                    id = 1,
                    nama = jauh.nama.ifEmpty { lokal.nama },
                    email = jauh.email.ifEmpty { lokal.email },
                    onboarding_selesai = true
                )
            )
        }
    }

    /* ── reset ── */
    suspend fun hapusSemua() {
        dao.kosongkanTransaksi(); dao.kosongkanPengingat()
        dao.kosongkanAkun(); dao.kosongkanKantong()
        dao.kosongkanKategori(); dao.kosongkanProfil()
    }
}
