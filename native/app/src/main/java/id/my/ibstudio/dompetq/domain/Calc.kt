package id.my.ibstudio.dompetq.domain

import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.JENIS_MASUK
import id.my.ibstudio.dompetq.data.JENIS_SALDO_AWAL
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_AKUN
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_KANTONG
import id.my.ibstudio.dompetq.data.KANTONG_MILIK_SENDIRI
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.data.Akun
import id.my.ibstudio.dompetq.data.Kantong
import id.my.ibstudio.dompetq.data.Kategori
import id.my.ibstudio.dompetq.data.Transaksi

/* ══════════════════════════════════════════════
   Calc — semua perhitungan saldo.

   Sumber kebenaran tunggal adalah MATRIKS akun × kantong.
     saldo akun    = jumlah satu baris
     saldo kantong = jumlah satu kolom
   Keduanya tidak pernah dihitung terpisah, supaya tidak
   mungkin saling bertentangan. Porting langsung dari
   js/calc.js — aturannya harus identik di dua versi.
   ══════════════════════════════════════════════ */

/* matriks[akun_id][kantong_id] = nominal */
typealias Matriks = MutableMap<String, MutableMap<String, Long>>

data class SelMinus(val akun: Akun?, val kantong: Kantong?, val sesudah: Long)

data class BarisKategori(val id: String, val nama: String, val nilai: Long)

data class HasilKategori(val rows: List<BarisKategori>, val total: Long)

data class ArusKas(val masuk: Long, val keluar: Long) {
    val selisih: Long get() = masuk - keluar
}

data class BarisMutasi(val tx: Transaksi, val delta: Long, val saldo: Long)

data class HasilMutasi(val rows: List<BarisMutasi>, val saldoAkhir: Long)

data class Ringkas(
    val totalFisik: Long,
    val uangSaya: Long,
    val titipan: Long,
    val negatif: List<Pair<Kantong, Long>>,
    val saldoAkun: Map<String, Long>,
    val saldoKantong: Map<String, Long>,
    val matriks: Matriks
)

object Calc {

    fun matriks(transaksi: List<Transaksi>, sampai: Long? = null): Matriks {
        val m: Matriks = mutableMapOf()
        val batas = sampai ?: Long.MAX_VALUE

        fun sel(ak: String, kt: String, delta: Long) {
            if (ak.isEmpty() || kt.isEmpty()) return
            val baris = m.getOrPut(ak) { mutableMapOf() }
            baris[kt] = (baris[kt] ?: 0L) + delta
        }

        for (t in transaksi) {
            if (t.timestamp > batas) continue
            val n = t.nominal

            when (t.jenis) {
                JENIS_MASUK, JENIS_SALDO_AWAL -> sel(t.akun_id, t.kantong_id, n)
                JENIS_KELUAR -> sel(t.akun_id, t.kantong_id, -n)

                /* pindah tempat: kepemilikan tidak berubah */
                JENIS_TRANSFER_AKUN -> {
                    sel(t.akun_id, t.kantong_id, -n)
                    sel(t.akun_tujuan_id, t.kantong_id, n)
                }

                /* pindah kepemilikan: lokasi fisik tidak berubah */
                JENIS_TRANSFER_KANTONG -> {
                    sel(t.akun_id, t.kantong_id, -n)
                    sel(t.akun_id, t.kantong_tujuan_id, n)
                }
            }
        }
        return m
    }

    fun saldoAkun(akun: List<Akun>, m: Matriks): Map<String, Long> =
        akun.associate { a -> a.id to (m[a.id]?.values?.sum() ?: 0L) }

    fun saldoKantong(kantong: List<Kantong>, m: Matriks): Map<String, Long> {
        val out = kantong.associate { it.id to 0L }.toMutableMap()
        for ((_, kolom) in m) {
            for ((kt, v) in kolom) out[kt] = (out[kt] ?: 0L) + v
        }
        return out
    }

    fun ringkas(akun: List<Akun>, kantong: List<Kantong>, transaksi: List<Transaksi>): Ringkas {
        val m = matriks(transaksi)
        val sk = saldoKantong(kantong, m)

        var fisik = 0L
        var milik = 0L
        var titipan = 0L
        val negatif = mutableListOf<Pair<Kantong, Long>>()

        for (k in kantong) {
            val v = sk[k.id] ?: 0L
            fisik += v
            if (k.jenis == KANTONG_TITIPAN) titipan += v else milik += v
            if (v < 0) negatif += k to v
        }

        return Ringkas(fisik, milik, titipan, negatif, saldoAkun(akun, m), sk, m)
    }

    /* Cek sebelum menyimpan: apakah transaksi ini bikin satu sel matriks
       jadi minus? Dikembalikan sebagai PERINGATAN, bukan larangan —
       kenyataan kadang memang begitu, dan menolak input hanya membuat
       orang berhenti mencatat. (konsep.md §3.2 aturan 1) */
    fun cekDampak(
        akun: List<Akun>,
        kantong: List<Kantong>,
        transaksi: List<Transaksi>,
        calon: Transaksi
    ): List<SelMinus> {
        val m = matriks(transaksi)
        val out = mutableListOf<SelMinus>()

        fun periksa(ak: String, kt: String, delta: Long) {
            if (ak.isEmpty() || kt.isEmpty()) return
            val sesudah = (m[ak]?.get(kt) ?: 0L) + delta
            if (sesudah < 0) {
                out += SelMinus(
                    akun.firstOrNull { it.id == ak },
                    kantong.firstOrNull { it.id == kt },
                    sesudah
                )
            }
        }

        when (calon.jenis) {
            JENIS_KELUAR, JENIS_TRANSFER_AKUN, JENIS_TRANSFER_KANTONG ->
                periksa(calon.akun_id, calon.kantong_id, -calon.nominal)
        }
        return out
    }

    /* ID transaksi yang harus dikecualikan dari LAPORAN: yang sudah
       dikoreksi beserta entri pembaliknya.

       Untuk SALDO keduanya justru tetap dihitung — hasilnya nol dan itu
       benar. Tapi di laporan kategori, memasukkan keduanya membuat
       pengeluaran yang sudah dibatalkan tetap muncul di grafik dan
       pembaliknya terhitung sebagai pemasukan. Dua kali salah. */
    fun idDikoreksi(transaksi: List<Transaksi>): Set<String> {
        val skip = mutableSetOf<String>()
        for (t in transaksi) {
            if (t.reversal_dari.isNotEmpty()) {
                skip += t.id
                skip += t.reversal_dari
            }
        }
        return skip
    }

    /* Pengeluaran per kategori dalam rentang tanggal.
       transfer sengaja tidak dihitung — itu bukan pengeluaran. */
    fun perKategori(
        transaksi: List<Transaksi>,
        kategori: List<Kategori>,
        dari: Long,
        sampai: Long,
        tipe: String = JENIS_KELUAR
    ): HasilKategori {
        val skip = idDikoreksi(transaksi)
        val agg = mutableMapOf<String, Long>()
        var total = 0L

        for (t in transaksi) {
            if (t.jenis != tipe) continue
            if (t.id in skip) continue
            if (t.timestamp < dari || t.timestamp > sampai) continue
            val id = t.kategori_id.ifEmpty { "_" }
            agg[id] = (agg[id] ?: 0L) + t.nominal
            total += t.nominal
        }

        val rows = agg.map { (id, nilai) ->
            BarisKategori(id, kategori.firstOrNull { it.id == id }?.nama ?: "Tanpa kategori", nilai)
        }.sortedByDescending { it.nilai }

        return HasilKategori(rows, total)
    }

    /* Arus kas periode — bisa dibatasi hanya dana milik sendiri, supaya
       uang titipan yang lewat tidak terbaca sebagai pemasukan pribadi. */
    fun arusKas(
        transaksi: List<Transaksi>,
        kantong: List<Kantong>,
        dari: Long,
        sampai: Long,
        hanyaMilikSendiri: Boolean
    ): ArusKas {
        val skip = idDikoreksi(transaksi)
        var masuk = 0L
        var keluar = 0L

        for (t in transaksi) {
            if (t.timestamp < dari || t.timestamp > sampai) continue
            if (t.jenis != JENIS_MASUK && t.jenis != JENIS_KELUAR) continue
            if (t.id in skip) continue

            if (hanyaMilikSendiri) {
                val k = kantong.firstOrNull { it.id == t.kantong_id }
                if (k == null || k.jenis != KANTONG_MILIK_SENDIRI) continue
            }
            if (t.jenis == JENIS_MASUK) masuk += t.nominal else keluar += t.nominal
        }
        return ArusKas(masuk, keluar)
    }

    /* Mutasi satu sumber dana — bahan laporan pertanggungjawaban.
       (konsep.md §7) */
    fun mutasiKantong(
        transaksi: List<Transaksi>,
        kantongId: String,
        dari: Long? = null,
        sampai: Long? = null
    ): HasilMutasi {
        val d = dari ?: Long.MIN_VALUE
        val s = sampai ?: Long.MAX_VALUE
        val rows = mutableListOf<BarisMutasi>()
        var saldo = 0L

        val urut = transaksi
            .filter { it.kantong_id == kantongId || it.kantong_tujuan_id == kantongId }
            .sortedBy { it.timestamp }

        for (t in urut) {
            var delta = 0L

            if (t.kantong_id == kantongId) {
                delta = when (t.jenis) {
                    JENIS_MASUK, JENIS_SALDO_AWAL -> t.nominal
                    JENIS_KELUAR -> -t.nominal
                    JENIS_TRANSFER_KANTONG -> -t.nominal
                    /* transfer_akun tidak mengubah saldo kantong */
                    else -> 0L
                }
            }
            if (t.kantong_tujuan_id == kantongId && t.jenis == JENIS_TRANSFER_KANTONG) {
                delta = t.nominal
            }

            saldo += delta
            if (t.timestamp in d..s && delta != 0L) rows += BarisMutasi(t, delta, saldo)
        }
        return HasilMutasi(rows, saldo)
    }
}
