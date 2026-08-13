package id.my.ibstudio.dompetq

import android.app.Application
import android.content.Context
import id.my.ibstudio.dompetq.data.DompetQDatabase
import id.my.ibstudio.dompetq.data.Repo
import id.my.ibstudio.dompetq.pengingat.Notifikasi

/* Tanpa kerangka injeksi: aplikasi sekecil ini tidak
   memerlukannya, dan satu titik akses lebih mudah dilacak
   dari receiver yang hidup di luar Activity. */
class DompetQApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Notifikasi.siapkanKanal(this)
    }

    companion object {
        @Volatile private var repoInstans: Repo? = null

        fun repo(ctx: Context): Repo =
            repoInstans ?: synchronized(this) {
                repoInstans ?: Repo(DompetQDatabase.ambil(ctx).dao()).also { repoInstans = it }
            }
    }
}
