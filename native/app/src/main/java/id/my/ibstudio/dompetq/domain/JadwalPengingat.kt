package id.my.ibstudio.dompetq.domain

import id.my.ibstudio.dompetq.data.HARI
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.util.tglInput
import java.util.Calendar

/* ══════════════════════════════════════════════
   JadwalPengingat — kapan pengingat jatuh tempo.

   Pengingat bukan notifikasi yang lewat begitu saja, melainkan
   PERTANYAAN YANG MENUNGGU DIJAWAB. Selama belum dijawab untuk
   periode berjalan, ia muncul lagi setiap kali aplikasi dibuka.

   Yang TIDAK dilakukan: mencatat transaksi sendiri. Pengingat
   hanya bertanya; nominal dan tombol simpan tetap di tangan
   pengguna. Uang tidak boleh dicatat oleh tebakan aplikasi.

   Aturan jatuh tempo diporting persis dari js/pengingat.js.
   Yang baru di versi native: berikutnya(), karena AlarmManager
   perlu tahu kapan alarm harus dipasang — versi web tidak
   pernah butuh itu, ia hanya mengecek saat aplikasi dibuka.
   ══════════════════════════════════════════════ */

data class PerluDitanya(val p: Pengingat, val jatuhStr: String, val telat: Int)

object JadwalPengingat {

    private fun tengahMalam(kini: Long): Calendar =
        Calendar.getInstance().apply {
            timeInMillis = kini
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }

    /* Tanggal jatuh tempo TERAKHIR yang sudah lewat atau tepat hari ini. */
    fun jatuhTerakhir(p: Pengingat, kini: Long): Calendar {
        val h = tengahMalam(kini)

        when (p.jadwal_tipe) {
            "harian" -> return h

            "mingguan" -> {
                /* Calendar.DAY_OF_WEEK: 1=Minggu. jadwal_nilai: 0=Minggu. */
                val target = p.jadwal_nilai.coerceIn(0, 6)
                val sekarang = h.get(Calendar.DAY_OF_WEEK) - 1
                val mundur = (sekarang - target + 7) % 7
                return (h.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -mundur) }
            }
        }

        /* bulanan — tanggal 31 pada bulan pendek jatuh di hari terakhir
           bulan itu, tidak tumpah ke bulan berikutnya */
        val hariTarget = p.jadwal_nilai.coerceIn(1, 31)
        fun diBulan(thn: Int, bln: Int): Calendar {
            val c = Calendar.getInstance().apply {
                clear(); set(Calendar.YEAR, thn); set(Calendar.MONTH, bln); set(Calendar.DAY_OF_MONTH, 1)
            }
            val akhir = c.getActualMaximum(Calendar.DAY_OF_MONTH)
            c.set(Calendar.DAY_OF_MONTH, minOf(hariTarget, akhir))
            return c
        }

        val bulanIni = diBulan(h.get(Calendar.YEAR), h.get(Calendar.MONTH))
        if (!bulanIni.after(h)) return bulanIni

        val sebelum = (h.clone() as Calendar).apply { add(Calendar.MONTH, -1) }
        return diBulan(sebelum.get(Calendar.YEAR), sebelum.get(Calendar.MONTH))
    }

    /* Maju satu periode dari sebuah tanggal jatuh tempo. Untuk bulanan,
       tanggalnya dihitung ulang dari awal bulan supaya aturan "31 di
       bulan pendek" tetap berlaku dan tidak menggeser diam-diam. */
    private fun majuSatuPeriode(p: Pengingat, dari: Calendar): Calendar = when (p.jadwal_tipe) {
        "harian" -> (dari.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 1) }
        "mingguan" -> (dari.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 7) }
        else -> {
            val hariTarget = p.jadwal_nilai.coerceIn(1, 31)
            val c = (dari.clone() as Calendar).apply {
                set(Calendar.DAY_OF_MONTH, 1)
                add(Calendar.MONTH, 1)
            }
            val akhir = c.getActualMaximum(Calendar.DAY_OF_MONTH)
            c.apply { set(Calendar.DAY_OF_MONTH, minOf(hariTarget, akhir)) }
        }
    }

    /* Tanggal jatuh tempo BERIKUTNYA — hari ini atau sesudahnya,
       tanpa memperhitungkan jam alarm.

       Dipisahkan dari berikutnya() karena keduanya menjawab pertanyaan
       yang berbeda. Ini menjawab "kapan tagihan jatuh" untuk teks
       "9 hari lagi"; berikutnya() menjawab "kapan alarm harus berbunyi",
       yang sudah maju satu periode kalau jam hari ini terlewat. */
    fun jatuhBerikutnya(p: Pengingat, kini: Long): Calendar {
        val h = tengahMalam(kini)
        val terakhir = jatuhTerakhir(p, kini)
        return if (!terakhir.before(h)) terakhir else majuSatuPeriode(p, terakhir)
    }

    /* Berapa hari lagi sampai jatuh tempo berikutnya. 0 = hari ini. */
    fun hariLagi(p: Pengingat, kini: Long = System.currentTimeMillis()): Int {
        val h = tengahMalam(kini).timeInMillis
        val b = jatuhBerikutnya(p, kini).timeInMillis
        return Math.round((b - h) / 86_400_000.0).toInt()
    }

    fun teksHariLagi(n: Int): String = when {
        n <= 0 -> "jatuh tempo hari ini"
        n == 1 -> "besok"
        else -> "$n hari lagi"
    }

    /* Jatuh tempo BERIKUTNYA lengkap dengan jam alarm. Dipakai
       AlarmManager. Kalau jamnya hari ini sudah lewat, maju ke periode
       setelahnya supaya alarm tidak langsung berbunyi saat dipasang. */
    fun berikutnya(p: Pengingat, kini: Long): Long {
        fun pasangJam(c: Calendar): Calendar = (c.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, p.jam.coerceIn(0, 23))
            set(Calendar.MINUTE, p.menit.coerceIn(0, 59))
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }

        val calon = pasangJam(jatuhBerikutnya(p, kini))
        if (calon.timeInMillis > kini) return calon.timeInMillis
        return pasangJam(majuSatuPeriode(p, calon)).timeInMillis
    }

    /* Mana yang perlu ditanyakan sekarang — yang paling telat lebih dulu. */
    fun perluDitanya(daftar: List<Pengingat>, kini: Long = System.currentTimeMillis()): List<PerluDitanya> {
        val hariIni = tglInput(kini)
        val out = mutableListOf<PerluDitanya>()

        for (p in daftar) {
            if (!p.aktif) continue
            if (p.ditunda_sampai.isNotEmpty() && p.ditunda_sampai > hariIni) continue

            val jatuh = jatuhTerakhir(p, kini)
            val jatuhStr = tglInput(jatuh.timeInMillis)

            /* sudah dijawab untuk periode ini */
            if (p.terakhir_dipenuhi.isNotEmpty() && p.terakhir_dipenuhi >= jatuhStr) continue

            val telat = ((kini - jatuh.timeInMillis) / 86_400_000L).toInt()
            out += PerluDitanya(p, jatuhStr, telat)
        }
        return out.sortedByDescending { it.telat }
    }

    fun teksJadwal(p: Pengingat): String = when (p.jadwal_tipe) {
        "harian" -> "Setiap hari"
        "mingguan" -> "Setiap " + HARI[p.jadwal_nilai.coerceIn(0, 6)]
        else -> "Setiap tanggal " + p.jadwal_nilai.coerceIn(1, 31)
    }

    fun teksTelat(n: Int): String = when {
        n <= 0 -> "hari ini"
        n == 1 -> "kemarin"
        else -> "$n hari lalu"
    }
}
