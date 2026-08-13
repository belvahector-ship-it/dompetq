package id.my.ibstudio.dompetq.util

import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val ID = Locale("id", "ID")

/* Rupiah tanpa desimal — sen tidak pernah dipakai dalam
   pencatatan harian dan hanya menambah lebar angka. */
fun rupiah(n: Long): String {
    val neg = n < 0
    val s = kotlin.math.abs(n).toString().reversed().chunked(3).joinToString(".").reversed()
    return (if (neg) "-Rp " else "Rp ") + s
}

/* Bentuk ringkas untuk kartu sempit: 1,2 jt */
fun rupiahSingkat(n: Long): String {
    val a = kotlin.math.abs(n)
    val tanda = if (n < 0) "-" else ""
    return when {
        a >= 1_000_000_000L -> "%sRp %.1f M".format(ID, tanda, a / 1_000_000_000.0)
        a >= 1_000_000L -> "%sRp %.1f jt".format(ID, tanda, a / 1_000_000.0)
        a >= 1_000L -> "%sRp %.0f rb".format(ID, tanda, a / 1_000.0)
        else -> rupiah(n)
    }
}

/* yyyy-MM-dd — dipakai untuk membandingkan tanggal sebagai teks,
   sama seperti versi web supaya data bisa saling dibaca. */
fun tglInput(ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd", ID).format(Date(ms))

fun tglPanjang(ms: Long): String =
    SimpleDateFormat("d MMMM yyyy", ID).format(Date(ms))

fun tglPendek(ms: Long): String =
    SimpleDateFormat("d MMM", ID).format(Date(ms))

fun jamMenit(jam: Int, menit: Int): String =
    "%02d:%02d".format(jam, menit)

fun awalHari(ms: Long): Long = Calendar.getInstance().apply {
    timeInMillis = ms
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
}.timeInMillis

fun akhirHari(ms: Long): Long = awalHari(ms) + 86_399_999L

fun awalBulan(ms: Long): Long = Calendar.getInstance().apply {
    timeInMillis = awalHari(ms)
    set(Calendar.DAY_OF_MONTH, 1)
}.timeInMillis

fun akhirBulan(ms: Long): Long = Calendar.getInstance().apply {
    timeInMillis = awalBulan(ms)
    add(Calendar.MONTH, 1); add(Calendar.MILLISECOND, -1)
}.timeInMillis

fun namaBulan(ms: Long): String =
    SimpleDateFormat("MMMM yyyy", ID).format(Date(ms))

fun uid(pre: String): String =
    pre + "_" + System.currentTimeMillis().toString(36) +
        (100000..999999).random().toString(36)

/* PIN tidak pernah disimpan apa adanya. Yang disimpan hasil SHA-256
   dari garam + PIN, jadi isi basis data tidak membocorkan PIN-nya.

   Ini REM, bukan pengaman: siapa pun yang bisa membaca berkas
   basis data tetap bisa menyerang hash-nya. Jangan pakai PIN yang
   sama dengan PIN bank. */
fun hashPin(pin: String, garam: String): String {
    val d = MessageDigest.getInstance("SHA-256").digest("$garam:$pin".toByteArray())
    return d.joinToString("") { "%02x".format(it) }
}

fun namaJenis(j: String): String = when (j) {
    "masuk" -> "Pemasukan"
    "keluar" -> "Pengeluaran"
    "transfer_akun" -> "Pindah tempat"
    "transfer_kantong" -> "Pindah sumber dana"
    "saldo_awal" -> "Saldo awal"
    else -> j
}
