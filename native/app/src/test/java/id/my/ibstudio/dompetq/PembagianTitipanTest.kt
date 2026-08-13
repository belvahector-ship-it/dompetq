package id.my.ibstudio.dompetq

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/* Pembagian proporsional dana titipan ke beberapa akun.

   Logika aslinya ada di VM.pasangTitipanProporsional yang butuh
   Android. Yang diuji di sini adalah ARITMETIKANYA, disalin persis,
   karena justru di situ letak bug-nya: total yang dibagikan harus
   sama PERSIS dengan yang diketik pengguna. Meleset satu rupiah pun
   berarti angka titipan bohong, dan itu uang orang lain. */
class PembagianTitipanTest {

    /* Cerminan dari implementasi di VM. */
    private fun bagi(total: Long, saldo: List<Long>): List<Long> {
        if (total <= 0L) return saldo.map { 0L }

        val indeksLayak = saldo.indices.filter { saldo[it] > 0L }
            .sortedByDescending { saldo[it] }
        if (indeksLayak.isEmpty()) return saldo.map { 0L }

        val totalFisik = indeksLayak.sumOf { saldo[it] }
        if (totalFisik <= 0L) return saldo.map { 0L }

        val hasil = MutableList(saldo.size) { 0L }
        var sisa = total

        indeksLayak.forEachIndexed { i, idx ->
            val bagian = if (i == indeksLayak.lastIndex) sisa
            else (total.toDouble() * saldo[idx] / totalFisik).toLong().coerceIn(0L, sisa)
            if (bagian <= 0L) return@forEachIndexed
            sisa -= bagian
            hasil[idx] = bagian
        }
        return hasil
    }

    /* Bug yang dilaporkan: input 5.000.000 keluar jadi 4.999.998.
       Penyebabnya akun bersaldo nol menempati urutan terakhir, sehingga
       sisa pembulatan tidak pernah dibagikan. */
    @Test
    fun `total terbagi persis walau ada akun bersaldo nol di urutan terakhir`() {
        val saldo = listOf(3_333_333L, 3_333_333L, 3_333_334L, 0L)
        val hasil = bagi(5_000_000L, saldo)

        assertEquals(5_000_000L, hasil.sum())
        assertEquals(0L, hasil[3])
    }

    @Test
    fun `total terbagi persis untuk berbagai kombinasi`() {
        listOf(
            5_000_000L to listOf(1L, 1L, 1L),
            17_021_000L to listOf(7_777_777L, 3_333_333L, 11L),
            1L to listOf(500L, 500L),
            999_999_999L to listOf(3L, 7L, 11L, 13L),
            100L to listOf(0L, 0L, 5L)
        ).forEach { (total, saldo) ->
            val hasil = bagi(total, saldo)
            assertEquals("total $total harus utuh", total, hasil.sum())
            assertTrue("tidak boleh ada bagian negatif", hasil.all { it >= 0L })
        }
    }

    /* Akun kosong tidak boleh kebagian: uang titipan tidak mungkin
       berada di rekening yang saldonya nol. */
    @Test
    fun `akun kosong tidak kebagian`() {
        val hasil = bagi(1_000_000L, listOf(0L, 500_000L, 0L, 500_000L))
        assertEquals(0L, hasil[0])
        assertEquals(0L, hasil[2])
        assertEquals(1_000_000L, hasil.sum())
    }

    @Test
    fun `porsi mengikuti besar saldo`() {
        val hasil = bagi(1_000_000L, listOf(900_000L, 100_000L))
        assertEquals(1_000_000L, hasil.sum())
        assertTrue("akun besar harus dapat lebih banyak", hasil[0] > hasil[1])
    }

    @Test
    fun `semua akun kosong tidak membagi apa pun`() {
        assertEquals(0L, bagi(1_000_000L, listOf(0L, 0L)).sum())
    }
}
