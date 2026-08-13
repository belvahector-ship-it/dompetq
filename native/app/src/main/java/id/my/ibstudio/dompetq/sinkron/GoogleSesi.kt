package id.my.ibstudio.dompetq.sinkron

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/* ══════════════════════════════════════════════
   Sesi Google untuk Android.

   Memakai AuthorizationClient, bukan alur web GIS: Google
   memblokir OAuth di WebView, dan GoogleSignIn yang lama
   sudah usang. Aplikasi dikenali lewat package + sidik jari
   SHA-1 yang terdaftar di Google Cloud, jadi TIDAK ADA client
   ID yang perlu ditanam di kode ini.

   Access token berumur sekitar satu jam. Tanpa server tidak ada
   tempat aman menyimpan refresh token, jadi perpanjangan
   dilakukan dengan meminta otorisasi lagi — setelah izin pertama
   diberikan, permintaan berikutnya lolos tanpa memunculkan
   layar apa pun. Yang perlu diketahui: selama aplikasi OAuth
   masih berstatus "Testing" di Google Cloud, izin itu hangus
   tiap 7 hari dan pengguna harus menyetujui ulang.
   ══════════════════════════════════════════════ */

class ButuhIzinGoogle(val intent: android.content.IntentSender) :
    Exception("Perlu persetujuan Google")

object GoogleSesi {

    /* HARUS sama persis dengan GOOGLE.scopes di js/config.js.

       SATU scope saja untuk data: drive.file. Ia memberi akses penuh —
       baca dan tulis, lewat Drive API maupun Sheets API — tapi HANYA ke
       berkas yang dibuat aplikasi ini sendiri.

       `spreadsheets` sengaja TIDAK diminta meski terdengar lebih tepat:
       scope itu membuka SELURUH spreadsheet milik pengguna dan
       digolongkan Google sebagai sensitive, sehingga aplikasi tidak bisa
       keluar dari mode Testing tanpa lolos verifikasi keamanan. Meminta
       scope yang lebih luas di Android daripada di web juga membuat dua
       platform punya layar persetujuan yang berbeda. */
    private const val DRIVE_FILE = "https://www.googleapis.com/auth/drive.file"

    private val SCOPES = listOf(
        Scope("openid"),
        Scope("email"),
        Scope("profile"),
        Scope(DRIVE_FILE)
    )

    /* Izin yang menentukan aplikasi bisa bekerja atau tidak. Google
       memberi centang TERPISAH untuk tiap izin dan kotaknya mulai
       kosong: pengguna bisa menekan "Lanjutkan" tanpa mencentangnya.
       Login tetap berhasil dan email tetap muncul — tapi setiap tulisan
       ke spreadsheet ditolak 403. Karena itu diperiksa ulang tepat
       sesudah izin diberikan, sama seperti scopeWajib di versi web. */
    private val SCOPE_WAJIB = listOf(DRIVE_FILE)

    /* Nama izin dalam bahasa yang sama dengan yang dilihat pengguna di
       layar persetujuan Google — supaya mereka tahu kotak mana yang
       harus dicentang saat mengulang. */
    private val NAMA_SCOPE = mapOf(
        DRIVE_FILE to "Melihat, mengedit, membuat, dan menghapus file Google Drive " +
            "tertentu yang Anda gunakan dengan aplikasi ini"
    )

    class ScopeKurang(val kurang: List<String>) : Exception(
        "Login berhasil, tapi izin berikut belum dicentang:\n\n" +
            kurang.joinToString("\n") { "• " + (NAMA_SCOPE[it] ?: it) } +
            "\n\nDi layar izin Google, kotak centangnya terpisah dan awalnya " +
            "kosong. Coba sambungkan lagi, lalu centang semuanya sebelum " +
            "menekan \"Lanjutkan\"."
    )

    private fun periksaScope(hasil: AuthorizationResult) {
        val diberi = hasil.grantedScopes.map { it.toString() }.toSet()
        val kurang = SCOPE_WAJIB.filter { it !in diberi }
        if (kurang.isNotEmpty()) throw ScopeKurang(kurang)
    }

    @Volatile private var token: String? = null
    @Volatile private var kedaluwarsa: Long = 0
    @Volatile var email: String? = null
        private set

    fun tersambung(): Boolean = token != null

    fun putuskan(ctx: Context) {
        token = null
        kedaluwarsa = 0
        email = null
        try {
            Identity.getAuthorizationClient(ctx).authorize(
                AuthorizationRequest.builder().setRequestedScopes(SCOPES).build()
            )
        } catch (e: Exception) {
            /* pemutusan bersifat lokal; kalau gagal pun token sudah dibuang */
        }
    }

    private fun permintaan(): AuthorizationRequest =
        AuthorizationRequest.builder().setRequestedScopes(SCOPES).build()

    /* Mengembalikan access token. Kalau Google butuh layar persetujuan,
       melempar ButuhIzinGoogle — pemanggil yang meluncurkannya, karena
       hanya Activity yang boleh membuka layar itu. */
    suspend fun token(ctx: Context, paksaBaru: Boolean = false): String {
        val sekarang = System.currentTimeMillis()
        val simpanan = token
        if (!paksaBaru && simpanan != null && sekarang < kedaluwarsa) return simpanan

        val hasil = otorisasi(ctx)
        periksaScope(hasil)
        val baru = hasil.accessToken ?: throw IllegalStateException(
            "Google tidak mengembalikan access token."
        )
        token = baru
        /* Dikurangi 60 detik supaya tidak pernah memakai token yang
           kedaluwarsa di tengah permintaan. */
        kedaluwarsa = System.currentTimeMillis() + (55 * 60 * 1000L)
        return baru
    }

    private suspend fun otorisasi(ctx: Context): AuthorizationResult =
        suspendCancellableCoroutine { lanjut ->
            Identity.getAuthorizationClient(ctx)
                .authorize(permintaan())
                .addOnSuccessListener { hasil ->
                    val perlu = hasil.pendingIntent
                    if (hasil.hasResolution() && perlu != null) {
                        lanjut.resumeWithException(ButuhIzinGoogle(perlu.intentSender))
                    } else {
                        lanjut.resume(hasil)
                    }
                }
                .addOnFailureListener { lanjut.resumeWithException(it) }
        }

    /* Dipanggil setelah pengguna menyelesaikan layar persetujuan.
       Melempar ScopeKurang kalau kotak izinnya tidak dicentang —
       kegagalan itu harus terlihat, bukan jadi 403 misterius nanti. */
    fun terimaHasil(ctx: Context, data: Intent?): Boolean {
        val hasil = try {
            Identity.getAuthorizationClient(ctx).getAuthorizationResultFromIntent(data)
        } catch (e: Exception) {
            return false
        }
        periksaScope(hasil)
        val t = hasil.accessToken ?: return false
        token = t
        kedaluwarsa = System.currentTimeMillis() + (55 * 60 * 1000L)
        return true
    }

    fun catatEmail(nilai: String?) { email = nilai }

    /* Token ditolak di tengah jalan — buang supaya permintaan
       berikutnya mengambil yang baru. */
    fun buangToken() {
        token = null
        kedaluwarsa = 0
    }
}
