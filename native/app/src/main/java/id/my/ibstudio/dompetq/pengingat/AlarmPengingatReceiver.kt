package id.my.ibstudio.dompetq.pengingat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import id.my.ibstudio.dompetq.DompetQApp
import id.my.ibstudio.dompetq.domain.JadwalPengingat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/* Berbunyi saat satu pengingat jatuh tempo. Tugasnya tiga:
   tampilkan pertanyaan, lalu pasang alarm periode berikutnya,
   lalu selesai. Tidak pernah mencatat transaksi sendiri. */
class AlarmPengingatReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra(Notifikasi.EXTRA_PENGINGAT_ID) ?: return
        val hasil = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repo = DompetQApp.repo(ctx)
                val p = repo.pengingat(id) ?: return@launch

                /* Sudah dijawab lebih dulu lewat aplikasi? Diam saja. */
                val perlu = JadwalPengingat.perluDitanya(listOf(p))
                if (perlu.isNotEmpty()) {
                    Notifikasi.tampilkan(ctx, p, perlu.first().telat)
                }

                /* Selalu pasang periode berikutnya, dijawab atau tidak. */
                AlarmPenjadwal.pasang(ctx, p)
            } finally {
                hasil.finish()
            }
        }
    }
}
