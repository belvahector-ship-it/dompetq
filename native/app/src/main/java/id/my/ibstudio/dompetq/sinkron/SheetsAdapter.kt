package id.my.ibstudio.dompetq.sinkron

import android.content.Context
import id.my.ibstudio.dompetq.data.Akun
import id.my.ibstudio.dompetq.data.Kantong
import id.my.ibstudio.dompetq.data.Kategori
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.data.Profil
import id.my.ibstudio.dompetq.data.Transaksi
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/* Isi spreadsheet, sudah dalam bentuk entitas native. */
data class IsiJauh(
    val profil: Profil?,
    val akun: List<Akun>,
    val kantong: List<Kantong>,
    val kategori: List<Kategori>,
    val transaksi: List<Transaksi>,
    val pengingat: List<Pengingat>
) {
    val kosong: Boolean
        get() = akun.isEmpty() && kantong.isEmpty() &&
            kategori.isEmpty() && transaksi.isEmpty()
}

/* ══════════════════════════════════════════════
   SheetsAdapter — cermin data di Drive milik pengguna.

   Pola satu spreadsheet per pengguna. Pengembang tidak punya
   akses ke data siapa pun: drive.file hanya membuka berkas
   yang dibuat aplikasi ini. (konsep.md §9.2)
   ══════════════════════════════════════════════ */
class SheetsAdapter(private val ctx: Context) {

    var fileId: String? = null
        private set

    /* drive.file hanya melihat berkas yang DIBUAT aplikasi ini, jadi
       pencarian ini tidak pernah menyentuh berkas lain milik pengguna. */
    suspend fun cariBerkas(): String? {
        val q = URLEncoder.encode(
            "name='${SkemaSheet.NAMA_BERKAS}' and " +
                "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            "UTF-8"
        )
        val j = GoogleApi.api(
            ctx,
            "$API_DRIVE/files?q=$q&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc"
        )
        val files = j?.optJSONArray("files") ?: return null
        return if (files.length() > 0) files.getJSONObject(0).optString("id") else null
    }

    suspend fun buatBerkas(): String {
        val sheets = JSONArray()
        SkemaSheet.dikelola.keys.forEachIndexed { i, nama ->
            sheets.put(
                JSONObject().put(
                    "properties", JSONObject().put("title", nama).put("index", i)
                )
            )
        }
        val badan = JSONObject()
            .put("properties", JSONObject().put("title", SkemaSheet.NAMA_BERKAS).put("locale", "id_ID"))
            .put("sheets", sheets)

        val j = GoogleApi.api(ctx, API_SHEET, "POST", badan.toString())
            ?: throw GalatGoogle("Google tidak mengembalikan spreadsheet baru.")
        val id = j.optString("spreadsheetId")
        fileId = id
        tulisHeader(id)
        return id
    }

    private suspend fun tulisHeader(id: String) {
        val data = JSONArray()
        SkemaSheet.dikelola.forEach { (nama, kolom) ->
            data.put(
                JSONObject()
                    .put("range", "$nama!A1")
                    .put("values", JSONArray().put(JSONArray(kolom)))
            )
        }
        GoogleApi.api(
            ctx, "$API_SHEET/$id/values:batchUpdate", "POST",
            JSONObject().put("valueInputOption", "RAW").put("data", data).toString()
        )
    }

    suspend fun siapkan(): String {
        fileId?.let { return it }
        val ada = cariBerkas()
        if (ada != null) {
            fileId = ada
            /* Berkas dibuat versi web yang mungkin belum punya semua
               sheet yang dikelola versi ini. */
            pastikanSheetLengkap(ada)
            return ada
        }
        return buatBerkas()
    }

    /* Versi web membuat sheet sesuai skemanya sendiri. Kalau ada tabel
       yang belum ada di sana, dibuat menyusul — tanpa menyentuh sheet
       lain (`pihak` milik versi web harus tetap utuh). */
    private suspend fun pastikanSheetLengkap(id: String) {
        val j = GoogleApi.api(ctx, "$API_SHEET/$id?fields=sheets(properties(title))") ?: return
        val ada = mutableSetOf<String>()
        j.optJSONArray("sheets")?.let { arr ->
            for (i in 0 until arr.length()) {
                arr.getJSONObject(i).optJSONObject("properties")
                    ?.optString("title")?.let { ada += it }
            }
        }

        val kurang = SkemaSheet.dikelola.keys.filter { it !in ada }
        if (kurang.isEmpty()) return

        val permintaan = JSONArray()
        kurang.forEach { nama ->
            permintaan.put(
                JSONObject().put(
                    "addSheet",
                    JSONObject().put("properties", JSONObject().put("title", nama))
                )
            )
        }
        GoogleApi.api(
            ctx, "$API_SHEET/$id:batchUpdate", "POST",
            JSONObject().put("requests", permintaan).toString()
        )

        val data = JSONArray()
        kurang.forEach { nama ->
            data.put(
                JSONObject()
                    .put("range", "$nama!A1")
                    .put("values", JSONArray().put(JSONArray(SkemaSheet.dikelola[nama])))
            )
        }
        GoogleApi.api(
            ctx, "$API_SHEET/$id/values:batchUpdate", "POST",
            JSONObject().put("valueInputOption", "RAW").put("data", data).toString()
        )
    }

    /* ── baca ── */

    suspend fun muat(): IsiJauh? {
        val id = siapkan()
        val rentang = SkemaSheet.dikelola.keys.joinToString("&") {
            "ranges=" + URLEncoder.encode("$it!A1:Z", "UTF-8")
        }
        val j = GoogleApi.api(ctx, "$API_SHEET/$id/values:batchGet?$rentang") ?: return null

        val peta = mutableMapOf<String, List<Map<String, String>>>()
        val ranges = j.optJSONArray("valueRanges") ?: return null

        SkemaSheet.dikelola.keys.forEachIndexed { i, nama ->
            if (i >= ranges.length()) return@forEachIndexed
            peta[nama] = barisJadiPeta(ranges.getJSONObject(i).optJSONArray("values"))
        }

        return IsiJauh(
            profil = peta["profil"]?.firstOrNull()?.let { bacaProfil(it) },
            akun = peta["akun"].orEmpty().mapNotNull { bacaAkun(it) },
            kantong = peta["kantong"].orEmpty().mapNotNull { bacaKantong(it) },
            kategori = peta["kategori"].orEmpty().mapNotNull { bacaKategori(it) },
            transaksi = peta["transaksi"].orEmpty().mapNotNull { bacaTransaksi(it) },
            pengingat = peta["pengingat"].orEmpty().mapNotNull { bacaPengingat(it) }
        )
    }

    /* Baris pertama adalah header. Pemetaan dilakukan berdasarkan NAMA
       kolom di header, bukan posisi — supaya spreadsheet yang kolomnya
       digeser pengguna tetap terbaca benar. */
    private fun barisJadiPeta(values: JSONArray?): List<Map<String, String>> {
        if (values == null || values.length() < 2) return emptyList()
        val header = values.optJSONArray(0) ?: return emptyList()
        val kolom = (0 until header.length()).map { header.optString(it) }

        val hasil = mutableListOf<Map<String, String>>()
        for (i in 1 until values.length()) {
            val baris = values.optJSONArray(i) ?: continue
            val m = mutableMapOf<String, String>()
            kolom.forEachIndexed { k, nama ->
                m[nama] = if (k < baris.length()) baris.optString(k) else ""
            }
            if (m.values.any { it.isNotBlank() }) hasil += m
        }
        return hasil
    }

    private fun bacaProfil(m: Map<String, String>) = Profil(
        id = 1,
        nama = m["nama"].orEmpty(),
        email = m["email"].orEmpty(),
        tanggal_mulai = SkemaSheet.dariIso(m["tanggal_mulai"].orEmpty()),
        kunci_hash = m["kunci_hash"].orEmpty(),
        kunci_garam = m["kunci_garam"].orEmpty(),
        saldo_terkunci = SkemaSheet.keBool(m["saldo_terkunci"].orEmpty()),
        onboarding_selesai = true
    )

    private fun bacaAkun(m: Map<String, String>): Akun? {
        val id = m["id"]?.trim().orEmpty()
        if (id.isEmpty()) return null
        return Akun(
            id = id,
            nama = m["nama"].orEmpty(),
            bank_kode = m["bank_kode"].orEmpty(),
            jenis = m["jenis"].orEmpty().ifEmpty { "lainnya" },
            is_default = SkemaSheet.keBool(m["is_default"].orEmpty()),
            urutan = SkemaSheet.keAngka(m["urutan"].orEmpty()).toInt(),
            aktif = m["aktif"].orEmpty().let { it.isBlank() || SkemaSheet.keBool(it) }
        )
    }

    private fun bacaKantong(m: Map<String, String>): Kantong? {
        val id = m["id"]?.trim().orEmpty()
        if (id.isEmpty()) return null
        return Kantong(
            id = id,
            nama = m["nama"].orEmpty(),
            jenis = m["jenis"].orEmpty().ifEmpty { "titipan" },
            is_default = SkemaSheet.keBool(m["is_default"].orEmpty()),
            warna = m["warna"].orEmpty().ifEmpty { "#0e9f6e" },
            catatan = m["catatan"].orEmpty()
        )
    }

    private fun bacaKategori(m: Map<String, String>): Kategori? {
        val id = m["id"]?.trim().orEmpty()
        if (id.isEmpty()) return null
        return Kategori(
            id = id,
            nama = m["nama"].orEmpty(),
            tipe = m["tipe"].orEmpty().ifEmpty { "pengeluaran" },
            ikon = m["ikon"].orEmpty()
        )
    }

    private fun bacaTransaksi(m: Map<String, String>): Transaksi? {
        val id = m["id"]?.trim().orEmpty()
        if (id.isEmpty()) return null
        val waktu = SkemaSheet.dariIso(m["timestamp"].orEmpty())
        return Transaksi(
            id = id,
            timestamp = waktu,
            dibuat_pada = SkemaSheet.dariIso(m["dibuat_pada"].orEmpty()).let { if (it == 0L) waktu else it },
            jenis = m["jenis"].orEmpty().ifEmpty { "keluar" },
            nominal = SkemaSheet.keAngka(m["nominal"].orEmpty()),
            akun_id = m["akun_id"].orEmpty(),
            akun_tujuan_id = m["akun_tujuan_id"].orEmpty(),
            kantong_id = m["kantong_id"].orEmpty(),
            kantong_tujuan_id = m["kantong_tujuan_id"].orEmpty(),
            kategori_id = m["kategori_id"].orEmpty(),
            pihak_id = m["pihak_id"].orEmpty(),
            keterangan = m["keterangan"].orEmpty(),
            reversal_dari = m["reversal_dari"].orEmpty()
        )
    }

    /* jam/menit/kalender_event_id tidak ada di spreadsheet — sengaja,
       lihat catatan di SkemaSheet. Nilai bawaannya dipulihkan oleh
       pemanggil dari data lokal kalau pengingatnya sudah dikenal. */
    private fun bacaPengingat(m: Map<String, String>): Pengingat? {
        val id = m["id"]?.trim().orEmpty()
        if (id.isEmpty()) return null
        return Pengingat(
            id = id,
            judul = m["judul"].orEmpty(),
            arah = m["arah"].orEmpty().ifEmpty { "masuk" },
            nominal = SkemaSheet.keAngka(m["nominal"].orEmpty()),
            jadwal_tipe = m["jadwal_tipe"].orEmpty().ifEmpty { "bulanan" },
            jadwal_nilai = SkemaSheet.keAngka(m["jadwal_nilai"].orEmpty()).toInt().coerceAtLeast(0),
            akun_id = m["akun_id"].orEmpty(),
            kantong_id = m["kantong_id"].orEmpty(),
            kategori_id = m["kategori_id"].orEmpty(),
            aktif = m["aktif"].orEmpty().let { it.isBlank() || SkemaSheet.keBool(it) },
            terakhir_dipenuhi = m["terakhir_dipenuhi"].orEmpty(),
            ditunda_sampai = m["ditunda_sampai"].orEmpty()
        )
    }

    /* ── tulis ── */

    suspend fun simpan(isi: IsiJauh) {
        val id = siapkan()

        val tabel = mapOf(
            "profil" to listOf(barisProfil(isi.profil)),
            "akun" to isi.akun.map { barisAkun(it) },
            "kantong" to isi.kantong.map { barisKantong(it) },
            "kategori" to isi.kategori.map { barisKategori(it) },
            "transaksi" to isi.transaksi.map { barisTransaksi(it) },
            "pengingat" to isi.pengingat.map { barisPengingat(it) }
        )

        /* Baris lama dibersihkan dulu supaya penghapusan ikut tersalin.
           Header di baris 1 tidak disentuh. Hanya sheet yang dikelola —
           `pihak` milik versi web tidak ikut dibersihkan. */
        val hapus = JSONArray()
        SkemaSheet.dikelola.keys.forEach { hapus.put("$it!A2:Z") }
        GoogleApi.api(
            ctx, "$API_SHEET/$id/values:batchClear", "POST",
            JSONObject().put("ranges", hapus).toString()
        )

        val data = JSONArray()
        tabel.forEach { (nama, baris) ->
            if (baris.isEmpty()) return@forEach
            val nilai = JSONArray()
            baris.forEach { nilai.put(JSONArray(it)) }
            data.put(JSONObject().put("range", "$nama!A2").put("values", nilai))
        }
        if (data.length() == 0) return

        GoogleApi.api(
            ctx, "$API_SHEET/$id/values:batchUpdate", "POST",
            JSONObject().put("valueInputOption", "RAW").put("data", data).toString()
        )
    }

    private fun barisProfil(p: Profil?): List<String> {
        val x = p ?: Profil()
        return listOf(
            x.nama, x.email, SkemaSheet.keIso(x.tanggal_mulai), "1",
            x.kunci_hash, x.kunci_garam, x.saldo_terkunci.toString()
        )
    }

    private fun barisAkun(a: Akun) = listOf(
        a.id, a.nama, a.bank_kode, a.jenis,
        a.is_default.toString(), a.urutan.toString(), a.aktif.toString()
    )

    private fun barisKantong(k: Kantong) = listOf(
        k.id, k.nama, k.jenis, k.is_default.toString(), k.warna, k.catatan
    )

    /* induk_id dikosongkan: versi native tidak punya kategori bersarang,
       tapi kolomnya tetap ditulis supaya urutan kolom tidak bergeser. */
    private fun barisKategori(k: Kategori) = listOf(k.id, k.nama, k.tipe, "", k.ikon)

    private fun barisTransaksi(t: Transaksi) = listOf(
        t.id, SkemaSheet.keIso(t.timestamp), SkemaSheet.keIso(t.dibuat_pada),
        t.jenis, t.nominal.toString(),
        t.akun_id, t.akun_tujuan_id, t.kantong_id, t.kantong_tujuan_id,
        t.kategori_id, t.pihak_id, t.keterangan, "", "", t.reversal_dari
    )

    private fun barisPengingat(p: Pengingat) = listOf(
        p.id, p.judul, p.arah, p.nominal.toString(),
        p.jadwal_tipe, p.jadwal_nilai.toString(),
        p.akun_id, p.kantong_id, p.kategori_id, p.aktif.toString(),
        p.terakhir_dipenuhi, p.ditunda_sampai
    )
}
