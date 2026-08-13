package id.my.ibstudio.dompetq.pengingat

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import java.util.TimeZone

/* ══════════════════════════════════════════════
   Kalender — menulis jatuh tempo pengingat sebagai
   agenda berulang di kalender perangkat.

   Gunanya bukan menggantikan notifikasi, melainkan membuat
   tanggalnya TERLIHAT saat orang merencanakan bulan depan:
   gaji tanggal 5 dan cicilan tanggal 20 muncul di kalender
   yang sama dengan janji temu lainnya.

   Agenda ditulis ke kalender lokal milik akun perangkat.
   Kalau izin belum diberikan, semua fungsi di sini diam
   dan mengembalikan 0 — pengingat tetap jalan tanpa ini.
   ══════════════════════════════════════════════ */

object Kalender {

    fun bolehTulis(ctx: Context): Boolean =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_CALENDAR) ==
            PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALENDAR) ==
            PackageManager.PERMISSION_GRANTED

    /* Kalender tujuan: yang bisa ditulis dan paling utama.
       VISIBLE dipakai sebagai penyaring supaya agenda tidak
       mendarat di kalender tersembunyi yang tidak pernah dilihat. */
    private fun idKalender(ctx: Context): Long? {
        val proyeksi = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.VISIBLE
        )
        ctx.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI, proyeksi,
            "${CalendarContract.Calendars.VISIBLE} = 1", null, null
        )?.use { c ->
            var terbaik: Long? = null
            while (c.moveToNext()) {
                val akses = c.getInt(1)
                if (akses >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) {
                    return c.getLong(0)
                }
                if (terbaik == null) terbaik = c.getLong(0)
            }
            return terbaik
        }
        return null
    }

    private fun rrule(p: Pengingat): String = when (p.jadwal_tipe) {
        "harian" -> "FREQ=DAILY"
        "mingguan" -> {
            val hari = listOf("SU", "MO", "TU", "WE", "TH", "FR", "SA")
            "FREQ=WEEKLY;BYDAY=" + hari[p.jadwal_nilai.coerceIn(0, 6)]
        }
        /* BYMONTHDAY=-1 supaya tanggal 31 di bulan pendek jatuh di hari
           terakhir, sama seperti aturan di JadwalPengingat. */
        else -> {
            val h = p.jadwal_nilai.coerceIn(1, 31)
            if (h >= 29) "FREQ=MONTHLY;BYMONTHDAY=-1" else "FREQ=MONTHLY;BYMONTHDAY=$h"
        }
    }

    /* Mengembalikan id agenda, atau 0 kalau gagal / tidak diizinkan. */
    fun tulis(ctx: Context, p: Pengingat): Long {
        if (!bolehTulis(ctx)) return 0
        val kalender = idKalender(ctx) ?: return 0

        val mulai = JadwalPengingat.berikutnya(p, System.currentTimeMillis())
        val judul = p.judul.ifEmpty { "Pencatatan rutin" }

        val nilai = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, kalender)
            put(CalendarContract.Events.TITLE, "DompetQ — $judul")
            put(CalendarContract.Events.DESCRIPTION, "Sudah dicatat di DompetQ?")
            put(CalendarContract.Events.DTSTART, mulai)
            put(CalendarContract.Events.DURATION, "PT30M")
            put(CalendarContract.Events.RRULE, rrule(p))
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }

        return try {
            val uri = ctx.contentResolver.insert(CalendarContract.Events.CONTENT_URI, nilai)
            uri?.lastPathSegment?.toLongOrNull() ?: 0
        } catch (e: SecurityException) {
            0
        } catch (e: IllegalArgumentException) {
            0
        }
    }

    fun hapus(ctx: Context, eventId: Long): Boolean {
        if (eventId == 0L || !bolehTulis(ctx)) return false
        return try {
            val uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId)
            ctx.contentResolver.delete(uri, null, null) > 0
        } catch (e: SecurityException) {
            false
        }
    }

    /* Tulis ulang: hapus yang lama lalu buat baru, karena jadwalnya
       mungkin berubah total (harian → bulanan). */
    fun perbarui(ctx: Context, p: Pengingat): Long {
        hapus(ctx, p.kalender_event_id)
        return tulis(ctx, p)
    }
}
