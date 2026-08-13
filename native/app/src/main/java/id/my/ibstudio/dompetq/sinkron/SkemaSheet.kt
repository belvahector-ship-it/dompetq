package id.my.ibstudio.dompetq.sinkron

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/* ══════════════════════════════════════════════
   Kontrak spreadsheet — HARUS sama persis dengan
   SKEMA_SHEET di js/sheets.js.

   Satu sheet per tabel. Urutan kolom di sini adalah
   kontraknya: menambah kolom harus di BELAKANG, jangan
   menyisipkan di tengah, supaya spreadsheet lama tetap
   terbaca oleh kedua versi.

   Yang SENGAJA TIDAK ikut sinkron:
     jam, menit          — jam alarm itu setelan perangkat;
                           versi web tidak punya alarm sama sekali
     kalender_event_id   — id agenda hanya berlaku di satu HP
     onboarding_selesai  — keadaan lokal, disimpulkan dari isi data

   Kalau kolom-kolom itu dimasukkan ke skema bersama, versi web
   akan menuliskannya kosong (ia tidak punya bidang itu), dan
   pengunduhan berikutnya akan memindahkan semua alarm ke pukul
   00:00 diam-diam. Lebih aman dibiarkan lokal.
   ══════════════════════════════════════════════ */

object SkemaSheet {

    const val NAMA_BERKAS = "dompetq-data"

    val profil = listOf(
        "nama", "email", "tanggal_mulai", "versi_skema",
        "kunci_hash", "kunci_garam", "saldo_terkunci"
    )
    val akun = listOf("id", "nama", "bank_kode", "jenis", "is_default", "urutan", "aktif")
    val kantong = listOf("id", "nama", "jenis", "is_default", "warna", "catatan")
    val kategori = listOf("id", "nama", "tipe", "induk_id", "ikon")
    val transaksi = listOf(
        "id", "timestamp", "dibuat_pada", "jenis", "nominal",
        "akun_id", "akun_tujuan_id", "kantong_id", "kantong_tujuan_id",
        "kategori_id", "pihak_id", "keterangan", "bukti_url", "bukti_thumb",
        "reversal_dari"
    )
    val pengingat = listOf(
        "id", "judul", "arah", "nominal", "jadwal_tipe", "jadwal_nilai",
        "akun_id", "kantong_id", "kategori_id", "aktif",
        "terakhir_dipenuhi", "ditunda_sampai"
    )

    /* Tabel yang dikelola versi Android. `pihak` sengaja tidak ada di
       sini: versi native belum punya entitas itu, dan sheet-nya tidak
       boleh disentuh — menghapusnya berarti membuang data versi web. */
    val dikelola: Map<String, List<String>> = linkedMapOf(
        "profil" to profil,
        "akun" to akun,
        "kantong" to kantong,
        "kategori" to kategori,
        "transaksi" to transaksi,
        "pengingat" to pengingat
    )

    /* Versi web menyimpan waktu sebagai ISO 8601 (hasil toISOString),
       versi native sebagai epoch millis. Konversi terjadi di perbatasan
       ini saja supaya kedua versi membaca kolom yang sama. */
    private fun iso(): SimpleDateFormat =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    fun keIso(ms: Long): String = if (ms <= 0L) "" else iso().format(Date(ms))

    /* Menerima ISO penuh maupun "yyyy-MM-dd" — spreadsheet bisa saja
       disunting tangan oleh pengguna, dan itu memang diizinkan. */
    fun dariIso(teks: String): Long {
        val t = teks.trim()
        if (t.isEmpty()) return 0L
        t.toLongOrNull()?.let { if (it > 100_000_000_000L) return it }

        return try {
            iso().parse(t)?.time ?: 0L
        } catch (e: Exception) {
            try {
                SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(t)?.time ?: 0L
            } catch (e2: Exception) {
                0L
            }
        }
    }

    /* Sheets mengembalikan semuanya sebagai teks. */
    fun keBool(teks: String): Boolean {
        val t = teks.trim().lowercase()
        return t == "true" || t == "1" || t == "ya"
    }

    fun keAngka(teks: String): Long =
        teks.trim().replace(".", "").replace(",", "").toLongOrNull() ?: 0L
}
