package id.my.ibstudio.dompetq.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/* ══════════════════════════════════════════════
   Entitas — bentuknya sengaja dibuat sama persis dengan
   skema versi web (js/store.js), termasuk nama bidang.
   Cadangan JSON dari versi web harus bisa dibaca di sini.
   ══════════════════════════════════════════════ */

const val JENIS_MASUK = "masuk"
const val JENIS_KELUAR = "keluar"
const val JENIS_SALDO_AWAL = "saldo_awal"
const val JENIS_TRANSFER_AKUN = "transfer_akun"
const val JENIS_TRANSFER_KANTONG = "transfer_kantong"

const val KANTONG_MILIK_SENDIRI = "milik_sendiri"
const val KANTONG_TITIPAN = "titipan"

@Entity(tableName = "akun")
data class Akun(
    @PrimaryKey val id: String,
    val nama: String,
    val bank_kode: String = "",
    val jenis: String = "lainnya",
    val is_default: Boolean = false,
    val urutan: Int = 0,
    val aktif: Boolean = true
)

@Entity(tableName = "kantong")
data class Kantong(
    @PrimaryKey val id: String,
    val nama: String,
    /* milik_sendiri | titipan — pemisahan inti seluruh aplikasi */
    val jenis: String = KANTONG_TITIPAN,
    val is_default: Boolean = false,
    val warna: String = "#0e9f6e",
    val catatan: String = ""
)

@Entity(tableName = "kategori")
data class Kategori(
    @PrimaryKey val id: String,
    val nama: String,
    /* pemasukan | pengeluaran */
    val tipe: String,
    val ikon: String = ""
)

/* Append-only. Koreksi dilakukan lewat entri pembalik
   (reversal_dari), tidak pernah dengan mengubah baris lama:
   ada uang orang lain di dalam log ini. */
@Entity(tableName = "transaksi")
data class Transaksi(
    @PrimaryKey val id: String,
    /* epoch millis — kapan transaksi TERJADI */
    val timestamp: Long,
    /* epoch millis — kapan barisnya DITULIS */
    val dibuat_pada: Long,
    val jenis: String = JENIS_KELUAR,
    val nominal: Long = 0,
    val akun_id: String = "",
    val akun_tujuan_id: String = "",
    val kantong_id: String = "",
    val kantong_tujuan_id: String = "",
    val kategori_id: String = "",
    val pihak_id: String = "",
    val keterangan: String = "",
    val reversal_dari: String = ""
)

@Entity(tableName = "pengingat")
data class Pengingat(
    @PrimaryKey val id: String,
    val judul: String = "",
    /* masuk | keluar — pemasukan atau pengeluaran rutin */
    val arah: String = JENIS_MASUK,
    val nominal: Long = 0,
    /* harian | mingguan | bulanan */
    val jadwal_tipe: String = "bulanan",
    /* mingguan: 0=Minggu..6=Sabtu · bulanan: 1..31 */
    val jadwal_nilai: Int = 1,
    /* jam & menit alarm berbunyi */
    val jam: Int = 8,
    val menit: Int = 0,
    val akun_id: String = "",
    val kantong_id: String = "",
    val kategori_id: String = "",
    val aktif: Boolean = true,
    /* yyyy-MM-dd, "" kalau belum pernah */
    val terakhir_dipenuhi: String = "",
    val ditunda_sampai: String = "",
    /* id agenda di kalender perangkat, 0 kalau tidak disambungkan */
    val kalender_event_id: Long = 0
)

@Entity(tableName = "profil")
data class Profil(
    @PrimaryKey val id: Int = 1,
    val nama: String = "",
    val email: String = "",
    val tanggal_mulai: Long = 0,
    val kunci_hash: String = "",
    val kunci_garam: String = "",
    val saldo_terkunci: Boolean = false,
    val onboarding_selesai: Boolean = false
)
