package id.my.ibstudio.dompetq

import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import id.my.ibstudio.dompetq.util.tglInput
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

class JadwalPengingatTest {

    private fun saat(thn: Int, bln1: Int, hari: Int, jam: Int = 12): Long =
        Calendar.getInstance().apply {
            clear()
            set(thn, bln1 - 1, hari, jam, 0, 0)
        }.timeInMillis

    private fun bulanan(tanggal: Int, jam: Int = 8) = Pengingat(
        id = "p1", judul = "Gaji", jadwal_tipe = "bulanan",
        jadwal_nilai = tanggal, jam = jam
    )

    /* Aturan yang paling mudah salah: tanggal 31 pada bulan pendek
       harus jatuh di hari terakhir bulan itu, bukan tumpah ke bulan
       berikutnya. Kalau tumpah, cicilan bulan Februari tidak pernah
       ditanyakan. */
    @Test
    fun `tanggal 31 di bulan pendek jatuh di hari terakhir`() {
        val p = bulanan(31)

        val feb = JadwalPengingat.jatuhTerakhir(p, saat(2027, 2, 28))
        assertEquals("2027-02-28", tglInput(feb.timeInMillis))

        val apr = JadwalPengingat.jatuhTerakhir(p, saat(2027, 4, 30))
        assertEquals("2027-04-30", tglInput(apr.timeInMillis))

        val jan = JadwalPengingat.jatuhTerakhir(p, saat(2027, 1, 31))
        assertEquals("2027-01-31", tglInput(jan.timeInMillis))
    }

    @Test
    fun `tahun kabisat ditangani`() {
        val feb = JadwalPengingat.jatuhTerakhir(bulanan(31), saat(2028, 2, 29))
        assertEquals("2028-02-29", tglInput(feb.timeInMillis))
    }

    /* Sebelum tanggalnya lewat, yang berlaku masih jatuh tempo bulan lalu. */
    @Test
    fun `sebelum jatuh tempo memakai periode bulan sebelumnya`() {
        val jatuh = JadwalPengingat.jatuhTerakhir(bulanan(20), saat(2027, 3, 5))
        assertEquals("2027-02-20", tglInput(jatuh.timeInMillis))
    }

    @Test
    fun `mingguan mundur ke hari target terakhir`() {
        /* 2027-03-10 adalah Rabu. Target Senin (1) → 2027-03-08. */
        val p = Pengingat(id = "p2", jadwal_tipe = "mingguan", jadwal_nilai = 1)
        val jatuh = JadwalPengingat.jatuhTerakhir(p, saat(2027, 3, 10))
        assertEquals("2027-03-08", tglInput(jatuh.timeInMillis))
    }

    /* Alarm tidak boleh langsung berbunyi saat dipasang: kalau jam hari
       ini sudah lewat, alarm harus maju ke periode berikutnya. */
    @Test
    fun `alarm berikutnya selalu di masa depan`() {
        val kini = saat(2027, 3, 20, jam = 15)
        listOf(
            bulanan(20, jam = 8),
            bulanan(31, jam = 8),
            Pengingat(id = "h", jadwal_tipe = "harian", jam = 8),
            Pengingat(id = "m", jadwal_tipe = "mingguan", jadwal_nilai = 3, jam = 8)
        ).forEach { p ->
            val next = JadwalPengingat.berikutnya(p, kini)
            assertTrue("${p.jadwal_tipe} harus di masa depan", next > kini)
        }
    }

    @Test
    fun `alarm harian berikutnya besok kalau jam sudah lewat`() {
        val kini = saat(2027, 3, 20, jam = 15)
        val next = JadwalPengingat.berikutnya(Pengingat(id = "h", jadwal_tipe = "harian", jam = 8), kini)
        assertEquals("2027-03-21", tglInput(next))
    }

    @Test
    fun `alarm harian berikutnya hari ini kalau jam belum lewat`() {
        val kini = saat(2027, 3, 20, jam = 6)
        val next = JadwalPengingat.berikutnya(Pengingat(id = "h", jadwal_tipe = "harian", jam = 8), kini)
        assertEquals("2027-03-20", tglInput(next))
    }

    /* Sudah dijawab untuk periode ini → diam sampai periode berikutnya. */
    @Test
    fun `pengingat yang sudah dipenuhi tidak ditanyakan lagi`() {
        val kini = saat(2027, 3, 25)
        val p = bulanan(20).copy(terakhir_dipenuhi = "2027-03-20")
        assertTrue(JadwalPengingat.perluDitanya(listOf(p), kini).isEmpty())
    }

    @Test
    fun `pengingat yang belum dipenuhi ditanyakan dengan hitungan telat`() {
        val kini = saat(2027, 3, 25)
        val hasil = JadwalPengingat.perluDitanya(listOf(bulanan(20)), kini)
        assertEquals(1, hasil.size)
        assertEquals(5, hasil.first().telat)
    }

    @Test
    fun `penundaan menahan pertanyaan sampai tanggalnya`() {
        val kini = saat(2027, 3, 25)
        val p = bulanan(20).copy(ditunda_sampai = "2027-03-26")
        assertTrue(JadwalPengingat.perluDitanya(listOf(p), kini).isEmpty())

        val besok = bulanan(20).copy(ditunda_sampai = "2027-03-25")
        assertEquals(1, JadwalPengingat.perluDitanya(listOf(besok), kini).size)
    }

    @Test
    fun `pengingat nonaktif diabaikan`() {
        val kini = saat(2027, 3, 25)
        assertTrue(JadwalPengingat.perluDitanya(listOf(bulanan(20).copy(aktif = false)), kini).isEmpty())
    }

    /* Bug yang dilaporkan: hari ini tanggal 13, tagihan tiap tanggal 24.
       Itu berarti 11 hari LAGI, bukan sekian hari yang lalu. */
    @Test
    fun `jatuh tempo berikutnya menghitung maju bukan mundur`() {
        val kini = saat(2026, 8, 13)
        val p = bulanan(24)

        assertEquals("2026-08-24", tglInput(JadwalPengingat.jatuhBerikutnya(p, kini).timeInMillis))
        assertEquals(11, JadwalPengingat.hariLagi(p, kini))
        assertEquals("11 hari lagi", JadwalPengingat.teksHariLagi(11))
    }

    @Test
    fun `jatuh tempo hari ini dihitung nol hari lagi`() {
        val kini = saat(2026, 8, 24)
        assertEquals(0, JadwalPengingat.hariLagi(bulanan(24), kini))
        assertEquals("2026-08-24", tglInput(JadwalPengingat.jatuhBerikutnya(bulanan(24), kini).timeInMillis))
    }

    /* Setelah tanggalnya lewat, yang berikutnya ada di bulan depan. */
    @Test
    fun `sesudah jatuh tempo lompat ke bulan berikutnya`() {
        val kini = saat(2026, 8, 25)
        assertEquals("2026-09-24", tglInput(JadwalPengingat.jatuhBerikutnya(bulanan(24), kini).timeInMillis))
        assertEquals(30, JadwalPengingat.hariLagi(bulanan(24), kini))
    }

    /* Aturan bulan pendek harus tetap berlaku saat menghitung maju. */
    @Test
    fun `jatuh berikutnya tanggal 31 dari Januari mendarat di akhir Februari`() {
        val kini = saat(2027, 2, 1)
        assertEquals("2027-02-28", tglInput(JadwalPengingat.jatuhBerikutnya(bulanan(31), kini).timeInMillis))
    }

    /* Pengingat yang baru dibuat tidak boleh langsung menuduh pengguna
       melewatkan periode sebelum pengingat itu ada. Disimulasikan
       dengan menandai periode berjalan sebagai sudah dipenuhi, persis
       yang dilakukan VM.simpanPengingat saat menyimpan pengingat baru. */
    @Test
    fun `pengingat baru tidak langsung dianggap telat`() {
        val kini = saat(2026, 8, 13)
        val baru = bulanan(24)
        val disemai = baru.copy(
            terakhir_dipenuhi = tglInput(JadwalPengingat.jatuhTerakhir(baru, kini).timeInMillis)
        )

        assertTrue(
            "pengingat baru tidak boleh muncul sebagai tunggakan",
            JadwalPengingat.perluDitanya(listOf(disemai), kini).isEmpty()
        )

        /* Tapi begitu tanggal 24 tiba, barulah ia bertanya. */
        assertEquals(1, JadwalPengingat.perluDitanya(listOf(disemai), saat(2026, 8, 24)).size)
    }

    @Test
    fun `tanpa penyemaian pengingat baru salah dianggap telat`() {
        /* Membuktikan bug aslinya memang ada, supaya perbaikannya
           tidak diam-diam hilang di kemudian hari. */
        val kini = saat(2026, 8, 13)
        val hasil = JadwalPengingat.perluDitanya(listOf(bulanan(24)), kini)
        assertEquals(1, hasil.size)
        assertTrue("versi lama menganggapnya telat", hasil.first().telat > 0)
    }

    /* Yang paling telat ditanya lebih dulu. */
    @Test
    fun `urutan pertanyaan dari yang paling telat`() {
        val kini = saat(2027, 3, 25)
        val hasil = JadwalPengingat.perluDitanya(
            listOf(bulanan(20).copy(id = "b"), bulanan(5).copy(id = "a")), kini
        )
        assertEquals("a", hasil.first().p.id)
    }
}
