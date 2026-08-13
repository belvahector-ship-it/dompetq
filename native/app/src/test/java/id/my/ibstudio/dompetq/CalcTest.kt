package id.my.ibstudio.dompetq

import id.my.ibstudio.dompetq.data.Akun
import id.my.ibstudio.dompetq.data.JENIS_KELUAR
import id.my.ibstudio.dompetq.data.JENIS_MASUK
import id.my.ibstudio.dompetq.data.JENIS_SALDO_AWAL
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_AKUN
import id.my.ibstudio.dompetq.data.JENIS_TRANSFER_KANTONG
import id.my.ibstudio.dompetq.data.KANTONG_MILIK_SENDIRI
import id.my.ibstudio.dompetq.data.KANTONG_TITIPAN
import id.my.ibstudio.dompetq.data.Kantong
import id.my.ibstudio.dompetq.data.Kategori
import id.my.ibstudio.dompetq.data.Transaksi
import id.my.ibstudio.dompetq.domain.Calc
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/* Menguji aturan uang yang diporting dari versi web. Kalau salah satu
   pecah, angka di aplikasi bohong — itu kegagalan yang jauh lebih
   berbahaya daripada UI yang jelek. */
class CalcTest {

    private val bca = Akun(id = "a1", nama = "BCA")
    private val tunai = Akun(id = "a2", nama = "Tunai")
    private val akun = listOf(bca, tunai)

    private val pribadi = Kantong(id = "k1", nama = "Uang Pribadi", jenis = KANTONG_MILIK_SENDIRI)
    private val kasRT = Kantong(id = "k2", nama = "Kas RT", jenis = KANTONG_TITIPAN)
    private val kantong = listOf(pribadi, kasRT)

    private var jam = 1_700_000_000_000L

    private fun tx(
        jenis: String, nominal: Long,
        akunId: String = "a1", kantongId: String = "k1",
        akunTujuan: String = "", kantongTujuan: String = "",
        kategoriId: String = "", reversalDari: String = "",
        id: String = "t" + (jam++)
    ) = Transaksi(
        id = id, timestamp = jam, dibuat_pada = jam, jenis = jenis, nominal = nominal,
        akun_id = akunId, akun_tujuan_id = akunTujuan,
        kantong_id = kantongId, kantong_tujuan_id = kantongTujuan,
        kategori_id = kategoriId, reversal_dari = reversalDari
    )

    /* Aturan inti: saldo akun adalah jumlah baris, saldo kantong adalah
       jumlah kolom, dan totalnya harus sama. Keduanya tidak boleh bisa
       saling bertentangan. */
    @Test
    fun `saldo akun dan kantong berasal dari matriks yang sama`() {
        val t = listOf(
            tx(JENIS_SALDO_AWAL, 1_000_000),
            tx(JENIS_SALDO_AWAL, 500_000, akunId = "a2"),
            tx(JENIS_MASUK, 200_000, kantongId = "k2")
        )
        val r = Calc.ringkas(akun, kantong, t)

        assertEquals(1_200_000L, r.saldoAkun["a1"])
        assertEquals(500_000L, r.saldoAkun["a2"])
        assertEquals(1_500_000L, r.saldoKantong["k1"])
        assertEquals(200_000L, r.saldoKantong["k2"])

        assertEquals(r.saldoAkun.values.sum(), r.saldoKantong.values.sum())
        assertEquals(r.totalFisik, r.uangSaya + r.titipan)
    }

    /* Pindah tempat mengubah lokasi, bukan kepemilikan. */
    @Test
    fun `transfer akun tidak mengubah saldo kantong`() {
        val t = listOf(
            tx(JENIS_SALDO_AWAL, 1_000_000),
            tx(JENIS_TRANSFER_AKUN, 400_000, akunId = "a1", akunTujuan = "a2")
        )
        val r = Calc.ringkas(akun, kantong, t)

        assertEquals(600_000L, r.saldoAkun["a1"])
        assertEquals(400_000L, r.saldoAkun["a2"])
        assertEquals(1_000_000L, r.saldoKantong["k1"])
    }

    /* Pindah sumber dana mengubah kepemilikan, bukan lokasi. */
    @Test
    fun `transfer kantong tidak mengubah saldo akun`() {
        val t = listOf(
            tx(JENIS_SALDO_AWAL, 1_000_000),
            tx(JENIS_TRANSFER_KANTONG, 300_000, kantongId = "k1", kantongTujuan = "k2")
        )
        val r = Calc.ringkas(akun, kantong, t)

        assertEquals(1_000_000L, r.saldoAkun["a1"])
        assertEquals(700_000L, r.saldoKantong["k1"])
        assertEquals(300_000L, r.saldoKantong["k2"])
        assertEquals(700_000L, r.uangSaya)
        assertEquals(300_000L, r.titipan)
    }

    @Test
    fun `sumber dana minus terdeteksi`() {
        val t = listOf(
            tx(JENIS_SALDO_AWAL, 100_000, kantongId = "k2"),
            tx(JENIS_KELUAR, 150_000, kantongId = "k2")
        )
        val r = Calc.ringkas(akun, kantong, t)

        assertEquals(1, r.negatif.size)
        assertEquals("k2", r.negatif.first().first.id)
        assertEquals(-50_000L, r.negatif.first().second)
    }

    /* Peringatan, bukan larangan — hasilnya dipakai UI untuk bertanya. */
    @Test
    fun `cek dampak menandai sel yang akan jadi minus`() {
        val t = listOf(tx(JENIS_SALDO_AWAL, 50_000))
        val calon = tx(JENIS_KELUAR, 80_000)

        val dampak = Calc.cekDampak(akun, kantong, t, calon)
        assertEquals(1, dampak.size)
        assertEquals(-30_000L, dampak.first().sesudah)
    }

    @Test
    fun `pengeluaran yang cukup saldo tidak memicu peringatan`() {
        val t = listOf(tx(JENIS_SALDO_AWAL, 100_000))
        assertTrue(Calc.cekDampak(akun, kantong, t, tx(JENIS_KELUAR, 80_000)).isEmpty())
    }

    /* Koreksi: untuk SALDO keduanya tetap dihitung dan saling meniadakan,
       tapi untuk LAPORAN keduanya harus hilang — kalau tidak, pengeluaran
       yang sudah dibatalkan tetap muncul di grafik dan pembaliknya
       terhitung sebagai pemasukan. Dua kali salah. */
    @Test
    fun `entri pembalik menihilkan saldo tapi dikecualikan dari laporan`() {
        val asli = tx(JENIS_KELUAR, 250_000, kategoriId = "kat1", id = "asli")
        val balik = tx(JENIS_MASUK, 250_000, kategoriId = "kat1", reversalDari = "asli", id = "balik")
        val t = listOf(tx(JENIS_SALDO_AWAL, 1_000_000), asli, balik)

        val r = Calc.ringkas(akun, kantong, t)
        assertEquals(1_000_000L, r.saldoAkun["a1"])

        val skip = Calc.idDikoreksi(t)
        assertTrue("asli" in skip)
        assertTrue("balik" in skip)

        val kategori = listOf(Kategori(id = "kat1", nama = "Makan", tipe = "pengeluaran"))
        val lap = Calc.perKategori(t, kategori, 0, Long.MAX_VALUE, JENIS_KELUAR)
        assertEquals(0L, lap.total)

        val arus = Calc.arusKas(t, kantong, 0, Long.MAX_VALUE, false)
        assertEquals(0L, arus.masuk)
        assertEquals(0L, arus.keluar)
    }

    /* Uang titipan yang lewat bukan pemasukan pribadi. */
    @Test
    fun `arus kas bisa dibatasi hanya dana milik sendiri`() {
        val t = listOf(
            tx(JENIS_MASUK, 100_000, kantongId = "k1"),
            tx(JENIS_MASUK, 900_000, kantongId = "k2")
        )
        assertEquals(1_000_000L, Calc.arusKas(t, kantong, 0, Long.MAX_VALUE, false).masuk)
        assertEquals(100_000L, Calc.arusKas(t, kantong, 0, Long.MAX_VALUE, true).masuk)
    }

    @Test
    fun `mutasi kantong menghitung saldo berjalan`() {
        val t = listOf(
            tx(JENIS_MASUK, 500_000, kantongId = "k2"),
            tx(JENIS_KELUAR, 200_000, kantongId = "k2"),
            tx(JENIS_MASUK, 50_000, kantongId = "k1")
        )
        val m = Calc.mutasiKantong(t, "k2")

        assertEquals(2, m.rows.size)
        assertEquals(500_000L, m.rows[0].saldo)
        assertEquals(300_000L, m.rows[1].saldo)
        assertEquals(300_000L, m.saldoAkhir)
    }

    /* transfer_akun menggeser uang antar rekening tanpa menyentuh
       kepemilikan, jadi ia tidak boleh muncul di mutasi kantong. */
    @Test
    fun `mutasi kantong mengabaikan transfer antar akun`() {
        val t = listOf(
            tx(JENIS_MASUK, 500_000, kantongId = "k2"),
            tx(JENIS_TRANSFER_AKUN, 200_000, akunId = "a1", akunTujuan = "a2", kantongId = "k2")
        )
        val m = Calc.mutasiKantong(t, "k2")
        assertEquals(1, m.rows.size)
        assertEquals(500_000L, m.saldoAkhir)
    }
}
