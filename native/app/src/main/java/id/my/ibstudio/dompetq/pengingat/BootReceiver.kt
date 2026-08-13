package id.my.ibstudio.dompetq.pengingat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import id.my.ibstudio.dompetq.DompetQApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/* Alarm yang terpasang hilang saat perangkat dimatikan atau
   aplikasi diperbarui. Tanpa ini, pengingat diam-diam berhenti
   bekerja setelah HP restart — dan justru itu yang paling
   berbahaya, karena pengguna mengira masih dijaga. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        val aksi = intent.action
        if (aksi != Intent.ACTION_BOOT_COMPLETED && aksi != Intent.ACTION_MY_PACKAGE_REPLACED) return

        val hasil = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Notifikasi.siapkanKanal(ctx)
                AlarmPenjadwal.pasangSemua(ctx, DompetQApp.repo(ctx).pengingatSemua())
            } finally {
                hasil.finish()
            }
        }
    }
}
