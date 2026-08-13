package id.my.ibstudio.dompetq.pengingat

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import id.my.ibstudio.dompetq.MainActivity
import id.my.ibstudio.dompetq.R
import id.my.ibstudio.dompetq.data.Pengingat
import id.my.ibstudio.dompetq.util.rupiah

/* ══════════════════════════════════════════════
   Notifikasi pengingat.

   Ini bagian yang tidak mungkin dilakukan versi WebView:
   `Notification` tidak ada di WebView Android, jadi versi
   web hanya bisa mengingatkan selagi aplikasi terbuka.
   Di sini notifikasi muncul walau aplikasi sudah ditutup.

   Nadanya sengaja bertanya, bukan memberi tahu — pengingat
   adalah pertanyaan yang menunggu dijawab.
   ══════════════════════════════════════════════ */

object Notifikasi {

    const val KANAL = "pengingat"
    const val EXTRA_PENGINGAT_ID = "pengingat_id"

    fun siapkanKanal(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val kanal = NotificationChannel(
            KANAL,
            "Pengingat pencatatan",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Bertanya saat pemasukan atau pengeluaran rutin jatuh tempo."
        }
        ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(kanal)
    }

    fun bolehTampil(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun tampilkan(ctx: Context, p: Pengingat, telat: Int) {
        if (!bolehTampil(ctx)) return

        val buka = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_PENGINGAT_ID, p.id)
        }
        val pending = PendingIntent.getActivity(
            ctx, p.id.hashCode(), buka,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val kapan = when {
            telat <= 0 -> "jatuh tempo hari ini"
            telat == 1 -> "jatuh tempo kemarin"
            else -> "jatuh tempo $telat hari lalu"
        }
        val isi = buildString {
            append(p.judul.ifEmpty { "Pencatatan rutin" })
            if (p.nominal > 0) append(" · ").append(rupiah(p.nominal))
            append(" · ").append(kapan)
        }

        val notif = NotificationCompat.Builder(ctx, KANAL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Sudah dicatat?")
            .setContentText(isi)
            .setStyle(NotificationCompat.BigTextStyle().bigText(isi))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        try {
            NotificationManagerCompat.from(ctx).notify(p.id.hashCode(), notif)
        } catch (e: SecurityException) {
            /* izin dicabut antara pengecekan dan pengiriman */
        }
    }
}
