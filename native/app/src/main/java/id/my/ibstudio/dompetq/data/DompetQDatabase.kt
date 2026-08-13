package id.my.ibstudio.dompetq.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [Akun::class, Kantong::class, Kategori::class,
        Transaksi::class, Pengingat::class, Profil::class],
    version = 2,
    exportSchema = false
)
abstract class DompetQDatabase : RoomDatabase() {
    abstract fun dao(): DompetQDao

    companion object {

        /* v1 menyimpan pengingat baru dengan terakhir_dipenuhi kosong,
           sehingga periode yang lewat SEBELUM pengingat itu dibuat ikut
           dianggap terlewat: pengingat "tiap tanggal 24" yang dibuat
           tanggal 13 langsung muncul sebagai "26 hari lalu".

           Perbaikannya menandai periode berjalan sebagai sudah beres,
           supaya yang ditanyakan pertama adalah jatuh tempo berikutnya.
           Migrasi, bukan fallbackToDestructive — di tabel sebelah ada
           transaksi uang sungguhan yang tidak boleh ikut terhapus. */
        private val MIGRASI_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "UPDATE pengingat SET terakhir_dipenuhi = date('now','localtime') " +
                        "WHERE terakhir_dipenuhi = ''"
                )
            }
        }

        @Volatile private var instans: DompetQDatabase? = null

        fun ambil(ctx: Context): DompetQDatabase =
            instans ?: synchronized(this) {
                instans ?: Room.databaseBuilder(
                    ctx.applicationContext,
                    DompetQDatabase::class.java,
                    "dompetq.db"
                ).addMigrations(MIGRASI_1_2)
                    .build()
                    .also { instans = it }
            }
    }
}
