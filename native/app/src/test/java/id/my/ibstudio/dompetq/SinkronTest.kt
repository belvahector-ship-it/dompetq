package id.my.ibstudio.dompetq

import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.data.Transaksi
import id.my.ibstudio.dompetq.sinkron.Arah
import id.my.ibstudio.dompetq.sinkron.IsiJauh
import id.my.ibstudio.dompetq.sinkron.MesinSinkron
import id.my.ibstudio.dompetq.sinkron.SkemaSheet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SinkronTest {

    private fun tx(id: String, waktu: Long) = Transaksi(
        id = id, timestamp = waktu, dibuat_pada = waktu, nominal = 1000
    )

    private fun isi(transaksi: List<Transaksi>) = IsiJauh(
        profil = null, akun = emptyList(), kantong = emptyList(),
        kategori = emptyList(), transaksi = transaksi, pengingat = emptyList()
    )

    /* ── arah sinkron ── */

    @Test
    fun `spreadsheet belum ada berarti unggah`() {
        assertEquals(Arah.UNGGAH, MesinSinkron.putuskan(adaLokal = true, jauh = null))
    }

    @Test
    fun `perangkat kosong berarti unduh`() {
        assertEquals(Arah.UNDUH, MesinSinkron.putuskan(false, isi(listOf(tx("a", 1)))))
    }

    @Test
    fun `spreadsheet kosong berarti unggah`() {
        assertEquals(Arah.UNGGAH, MesinSinkron.putuskan(true, isi(emptyList())))
    }

    /* Dua-duanya berisi TIDAK boleh diputuskan aplikasi sendiri —
       ada uang orang lain di dalam catatan ini. */
    @Test
    fun `dua sisi berisi berarti bentrok`() {
        assertEquals(Arah.BENTROK, MesinSinkron.putuskan(true, isi(listOf(tx("a", 1)))))
    }

    /* ── penggabungan transaksi ── */

    @Test
    fun `penggabungan tidak menduplikat dan tidak menghilangkan`() {
        val lokal = listOf(tx("a", 300), tx("b", 100))
        val jauh = listOf(tx("b", 100), tx("c", 200))

        val hasil = MesinSinkron.satukanTransaksi(lokal, jauh)

        assertEquals(3, hasil.size)
        assertEquals(listOf("b", "c", "a"), hasil.map { it.id })   // urut waktu
        assertEquals(hasil.map { it.id }.toSet().size, hasil.size)
    }

    @Test
    fun `penggabungan aman dijalankan dua kali`() {
        val a = listOf(tx("a", 1), tx("b", 2))
        val sekali = MesinSinkron.satukanTransaksi(a, listOf(tx("c", 3)))
        val dua = MesinSinkron.satukanTransaksi(sekali, listOf(tx("c", 3)))
        assertEquals(sekali.map { it.id }, dua.map { it.id })
    }

    /* ── pengingat: bidang lokal tidak boleh tertimpa ──
       Spreadsheet tidak menyimpan jam alarm. Kalau nilai lokal tidak
       dipulihkan, mengunduh dari perangkat lain memindahkan semua
       alarm ke pukul 00:00 tanpa suara. */
    @Test
    fun `jam alarm dan id kalender bertahan setelah unduh`() {
        val jauh = listOf(Pengingat(id = "p1", judul = "Gaji", jam = 0, menit = 0))
        val lokal = listOf(
            Pengingat(id = "p1", judul = "lama", jam = 7, menit = 30, kalender_event_id = 99)
        )

        val hasil = MesinSinkron.satukanPengingat(jauh, lokal)

        assertEquals("Gaji", hasil[0].judul)      // isi dari spreadsheet menang
        assertEquals(7, hasil[0].jam)             // setelan perangkat bertahan
        assertEquals(30, hasil[0].menit)
        assertEquals(99L, hasil[0].kalender_event_id)
        assertNotEquals(0, hasil[0].jam)
    }

    @Test
    fun `pengingat baru dari spreadsheet memakai jam bawaan`() {
        val hasil = MesinSinkron.satukanPengingat(
            listOf(Pengingat(id = "baru", judul = "Cicilan")), emptyList()
        )
        assertEquals(1, hasil.size)
        assertEquals("Cicilan", hasil[0].judul)
    }

    /* ── konversi waktu lintas versi ──
       Versi web menulis ISO 8601, versi native memakai epoch millis.
       Kalau konversinya meleset, semua transaksi pindah tanggal. */
    @Test
    fun `waktu bolak-balik ISO tetap sama`() {
        val asal = 1_786_000_000_000L
        assertEquals(asal, SkemaSheet.dariIso(SkemaSheet.keIso(asal)))
    }

    @Test
    fun `ISO dari versi web terbaca`() {
        val ms = SkemaSheet.dariIso("2026-08-13T04:30:00.000Z")
        assertTrue(ms > 0)
        assertEquals("2026-08-13T04:30:00.000Z", SkemaSheet.keIso(ms))
    }

    @Test
    fun `tanggal polos hasil suntingan tangan tetap terbaca`() {
        assertTrue(SkemaSheet.dariIso("2026-08-13") > 0)
    }

    @Test
    fun `teks kosong jadi nol bukan crash`() {
        assertEquals(0L, SkemaSheet.dariIso(""))
        assertEquals(0L, SkemaSheet.dariIso("bukan tanggal"))
        assertEquals("", SkemaSheet.keIso(0))
    }

    @Test
    fun `boolean dan angka dari Sheets terbaca`() {
        assertTrue(SkemaSheet.keBool("TRUE"))
        assertTrue(SkemaSheet.keBool("true"))
        assertTrue(SkemaSheet.keBool("1"))
        assertTrue(!SkemaSheet.keBool(""))
        assertTrue(!SkemaSheet.keBool("FALSE"))

        assertEquals(5_000_000L, SkemaSheet.keAngka("5000000"))
        assertEquals(0L, SkemaSheet.keAngka(""))
    }

    /* Kontrak kolom harus persis sama dengan js/sheets.js. Urutan
       adalah bagian dari kontrak: menyisipkan kolom di tengah membuat
       spreadsheet lama terbaca bergeser. */
    @Test
    fun `urutan kolom sama dengan versi web`() {
        assertEquals(
            listOf("id", "nama", "bank_kode", "jenis", "is_default", "urutan", "aktif"),
            SkemaSheet.akun
        )
        assertEquals(
            listOf(
                "id", "timestamp", "dibuat_pada", "jenis", "nominal",
                "akun_id", "akun_tujuan_id", "kantong_id", "kantong_tujuan_id",
                "kategori_id", "pihak_id", "keterangan", "bukti_url", "bukti_thumb",
                "reversal_dari"
            ),
            SkemaSheet.transaksi
        )
        /* `pihak` milik versi web tidak boleh ikut dikelola — kalau ikut,
           versi Android akan mengosongkannya saat menulis. */
        assertTrue("pihak" !in SkemaSheet.dikelola.keys)
    }
}
