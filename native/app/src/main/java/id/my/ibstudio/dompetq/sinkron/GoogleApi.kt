package id.my.ibstudio.dompetq.sinkron

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

const val API_DRIVE = "https://www.googleapis.com/drive/v3"
const val API_SHEET = "https://sheets.googleapis.com/v4/spreadsheets"
const val API_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo"

/* Galat yang membawa keterangan mentah dari Google. Pesan terjemahan
   bagus untuk pengguna, tapi keterangan mentahlah yang bisa dicari di
   internet kalau macetnya tidak biasa — jadi keduanya disimpan. */
class GalatGoogle(
    pesan: String,
    val status: Int = 0,
    val alasan: String = "",
    val detail: String = ""
) : Exception(pesan)

object GoogleApi {

    suspend fun api(
        ctx: Context,
        url: String,
        metode: String = "GET",
        badan: String? = null,
        percobaan: Int = 0
    ): JSONObject? = withContext(Dispatchers.IO) {

        val token = GoogleSesi.token(ctx)
        val koneksi = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = metode
            setRequestProperty("Authorization", "Bearer $token")
            connectTimeout = 20_000
            readTimeout = 30_000
            if (badan != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            }
        }

        try {
            if (badan != null) {
                koneksi.outputStream.use { it.write(badan.toByteArray(Charsets.UTF_8)) }
            }

            val kode = koneksi.responseCode

            if (kode in 200..299) {
                if (kode == 204) return@withContext null
                val teks = koneksi.inputStream.bufferedReader().use(BufferedReader::readText)
                return@withContext if (teks.isBlank()) null else JSONObject(teks)
            }

            val teksGalat = koneksi.errorStream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
            val err = try {
                JSONObject(teksGalat).optJSONObject("error") ?: JSONObject()
            } catch (e: Exception) {
                JSONObject()
            }

            /* 401 hampir selalu berarti token basi, bukan izin dicabut.
               Sekali coba ulang dengan token baru sebelum menyerah. */
            if (kode == 401 && percobaan == 0) {
                GoogleSesi.buangToken()
                return@withContext api(ctx, url, metode, badan, percobaan + 1)
            }

            if ((kode == 429 || kode >= 500) && percobaan < 3) {
                delay(500L * (1 shl percobaan))          // 0,5s → 1s → 2s
                return@withContext api(ctx, url, metode, badan, percobaan + 1)
            }

            val alasan = alasanGoogle(err)
            throw GalatGoogle(
                pesanHTTP(kode, err, alasan),
                status = kode,
                alasan = alasan,
                detail = err.optString("message", "")
            )
        } finally {
            koneksi.disconnect()
        }
    }

    /* Google menaruh sebab sebenarnya di beberapa tempat berbeda
       tergantung API-nya. Yang paling spesifik menang; `status` selalu
       ada dan selalu kasar, jadi diperiksa paling akhir. */
    private fun alasanGoogle(err: JSONObject): String {
        err.optJSONArray("details")?.let { d ->
            for (i in 0 until d.length()) {
                val r = d.optJSONObject(i)?.optString("reason", "") ?: ""
                if (r.isNotEmpty()) return r
            }
        }
        err.optJSONArray("errors")?.let { e ->
            for (i in 0 until e.length()) {
                val r = e.optJSONObject(i)?.optString("reason", "") ?: ""
                if (r.isNotEmpty()) return r
            }
        }
        return err.optString("status", "")
    }

    private fun pesanHTTP(status: Int, err: JSONObject, alasan: String): String {
        val detail = err.optString("message", "")

        /* Penyebab tersering waktu pertama memasang: API-nya sendiri
           belum dinyalakan di Google Cloud. */
        if (alasan == "SERVICE_DISABLED" ||
            Regex("has not been used in project|is disabled", RegexOption.IGNORE_CASE).containsMatchIn(detail)
        ) {
            val api = when {
                detail.contains("sheets", true) -> "Google Sheets API"
                detail.contains("drive", true) -> "Google Drive API"
                else -> "Google API"
            }
            return "$api belum diaktifkan di proyek Google Cloud. Buka Console → " +
                "APIs & Services → Library, cari \"$api\", lalu tekan Enable."
        }

        if (alasan == "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || alasan == "insufficientPermissions")
            return "Izin yang diberikan kurang. Putuskan sambungan, sambungkan lagi, " +
                "lalu centang semua kotak izin di layar Google."

        if (alasan == "ACCESS_TOKEN_EXPIRED" || status == 401)
            return "Sesi Google berakhir. Sambungkan lagi."

        if (status == 403) {
            if (Regex("quota|rate|limit", RegexOption.IGNORE_CASE).containsMatchIn(detail) ||
                alasan == "RATE_LIMIT_EXCEEDED"
            ) return "Kuota Google API tercapai. Coba lagi beberapa saat lagi."
            return "Google menolak akses" + (if (detail.isNotEmpty()) ": $detail" else ".")
        }

        if (status == 404) return "Spreadsheet tidak ditemukan. Mungkin sudah dihapus dari Drive."
        if (status == 400) return "Google menolak isi permintaan" +
            (if (detail.isNotEmpty()) ": $detail" else ".")
        if (status == 429) return "Terlalu banyak permintaan ke Google. Sudah dicoba ulang tapi masih penuh."
        if (status >= 500) return "Server Google sedang bermasalah. Data tetap aman tersimpan di perangkat."
        return "Gagal menghubungi Google ($status)" + (if (detail.isNotEmpty()) ": $detail" else "")
    }

    suspend fun email(ctx: Context): String? = try {
        api(ctx, API_USERINFO)?.optString("email")?.takeIf { it.isNotEmpty() }
    } catch (e: Exception) {
        null
    }
}
