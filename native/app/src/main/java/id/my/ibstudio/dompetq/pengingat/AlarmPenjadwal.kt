package id.my.ibstudio.dompetq.pengingat

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.domain.JadwalPengingat

/* ══════════════════════════════════════════════
   AlarmPenjadwal — memasang alarm sistem per pengingat.

   Satu alarm per pengingat, dipasang ulang tiap kali berbunyi
   (bukan setRepeating), supaya aturan "tanggal 31 pada bulan
   pendek jatuh di hari terakhir" tetap berlaku — pengulangan
   tetap tidak bisa menyatakan hal seperti itu.

   Alarm tepat waktu butuh izin sejak Android 12. Kalau tidak
   diberikan, alarm tetap dipasang tapi longgar: sistem boleh
   menundanya. Lebih baik telat daripada tidak bertanya
   sama sekali.
   ══════════════════════════════════════════════ */

object AlarmPenjadwal {

    private fun intent(ctx: Context, p: Pengingat): PendingIntent {
        val i = Intent(ctx, AlarmPengingatReceiver::class.java).apply {
            putExtra(Notifikasi.EXTRA_PENGINGAT_ID, p.id)
        }
        return PendingIntent.getBroadcast(
            ctx, p.id.hashCode(), i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun bolehTepatWaktu(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    }

    fun pasang(ctx: Context, p: Pengingat) {
        batalkan(ctx, p)
        if (!p.aktif) return

        val am = ctx.getSystemService(AlarmManager::class.java)
        val kapan = JadwalPengingat.berikutnya(p, System.currentTimeMillis())
        val pi = intent(ctx, p)

        try {
            if (bolehTepatWaktu(ctx)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kapan, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kapan, pi)
            }
        } catch (e: SecurityException) {
            /* izin dicabut di sela-sela — turunkan ke alarm longgar */
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kapan, pi)
        }
    }

    fun batalkan(ctx: Context, p: Pengingat) {
        ctx.getSystemService(AlarmManager::class.java).cancel(intent(ctx, p))
    }

    fun pasangSemua(ctx: Context, daftar: List<Pengingat>) {
        for (p in daftar) pasang(ctx, p)
    }
}
