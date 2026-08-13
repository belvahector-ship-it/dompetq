package id.my.ibstudio.dompetq.sinkron

import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.data.Transaksi

/* ══════════════════════════════════════════════
   Aturan penggabungan — sama persis dengan Sinkron
   di js/sheets.js.

   Transaksi bersifat append-only dan ber-ID unik, jadi
   penggabungan aman: ambil gabungan keduanya berdasarkan id.
   Master data (akun, kantong, kategori) TIDAK digabung —
   kalau dua sisi sama-sama berisi, pengguna yang memutuskan.
   ══════════════════════════════════════════════ */

enum class Arah { UNGGAH, UNDUH, BENTROK }

object MesinSinkron {

    fun putuskan(adaLokal: Boolean, jauh: IsiJauh?): Arah {
        if (jauh == null) return Arah.UNGGAH
        if (!adaLokal) return Arah.UNDUH
        if (jauh.kosong) return Arah.UNGGAH
        return Arah.BENTROK
    }

    /* Menggabungkan transaksi dari dua sumber tanpa duplikat.
       Yang sudah ada di sisi pertama menang — bukan karena lebih
       benar, tapi karena transaksi tidak pernah diubah setelah
       ditulis, jadi dua baris ber-id sama pasti identik. */
    fun satukanTransaksi(a: List<Transaksi>, b: List<Transaksi>): List<Transaksi> {
        val peta = LinkedHashMap<String, Transaksi>()
        a.forEach { peta[it.id] = it }
        b.forEach { if (!peta.containsKey(it.id)) peta[it.id] = it }
        return peta.values.sortedBy { it.timestamp }
    }

    /* Pengingat dari spreadsheet tidak membawa jam alarm, menit, dan
       id agenda kalender — ketiganya sengaja tidak ikut sinkron. Nilai
       lokal dipulihkan di sini supaya mengunduh dari perangkat lain
       tidak memindahkan semua alarm ke pukul 00:00. */
    fun satukanPengingat(jauh: List<Pengingat>, lokal: List<Pengingat>): List<Pengingat> {
        val peta = lokal.associateBy { it.id }
        return jauh.map { j ->
            val l = peta[j.id]
            if (l == null) j else j.copy(
                jam = l.jam,
                menit = l.menit,
                kalender_event_id = l.kalender_event_id
            )
        }
    }
}
