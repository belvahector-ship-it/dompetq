package id.my.ibstudio.dompetq.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface DompetQDao {

    /* ── akun ── */
    @Query("SELECT * FROM akun ORDER BY urutan")
    fun akunAliran(): Flow<List<Akun>>

    @Query("SELECT * FROM akun ORDER BY urutan")
    suspend fun akunSemua(): List<Akun>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanAkun(a: Akun)

    @Update
    suspend fun perbaruiAkun(a: Akun)

    @Delete
    suspend fun hapusAkun(a: Akun)

    /* ── kantong ── */
    @Query("SELECT * FROM kantong")
    fun kantongAliran(): Flow<List<Kantong>>

    @Query("SELECT * FROM kantong")
    suspend fun kantongSemua(): List<Kantong>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanKantong(k: Kantong)

    @Update
    suspend fun perbaruiKantong(k: Kantong)

    @Delete
    suspend fun hapusKantong(k: Kantong)

    /* ── kategori ── */
    @Query("SELECT * FROM kategori")
    fun kategoriAliran(): Flow<List<Kategori>>

    @Query("SELECT * FROM kategori")
    suspend fun kategoriSemua(): List<Kategori>

    @Query("SELECT * FROM kategori WHERE tipe = :tipe AND LOWER(nama) = LOWER(:nama) LIMIT 1")
    suspend fun cariKategori(nama: String, tipe: String): Kategori?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanKategori(k: Kategori)

    @Delete
    suspend fun hapusKategori(k: Kategori)

    /* ── transaksi ── */
    @Query("SELECT * FROM transaksi ORDER BY timestamp DESC, dibuat_pada DESC")
    fun transaksiAliran(): Flow<List<Transaksi>>

    @Query("SELECT * FROM transaksi ORDER BY timestamp DESC, dibuat_pada DESC")
    suspend fun transaksiSemua(): List<Transaksi>

    @Query("SELECT * FROM transaksi WHERE id = :id LIMIT 1")
    suspend fun transaksi(id: String): Transaksi?

    @Query("SELECT COUNT(*) FROM transaksi WHERE reversal_dari = :id")
    suspend fun jumlahPembalik(id: String): Int

    @Query("SELECT COUNT(*) FROM transaksi WHERE akun_id = :id OR akun_tujuan_id = :id")
    suspend fun transaksiPakaiAkun(id: String): Int

    @Query("SELECT COUNT(*) FROM transaksi WHERE kantong_id = :id OR kantong_tujuan_id = :id")
    suspend fun transaksiPakaiKantong(id: String): Int

    @Query("SELECT COUNT(*) FROM transaksi WHERE kategori_id = :id")
    suspend fun transaksiPakaiKategori(id: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanTransaksi(t: Transaksi)

    /* ── pengingat ── */
    @Query("SELECT * FROM pengingat")
    fun pengingatAliran(): Flow<List<Pengingat>>

    @Query("SELECT * FROM pengingat")
    suspend fun pengingatSemua(): List<Pengingat>

    @Query("SELECT * FROM pengingat WHERE id = :id LIMIT 1")
    suspend fun pengingat(id: String): Pengingat?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanPengingat(p: Pengingat)

    @Delete
    suspend fun hapusPengingat(p: Pengingat)

    /* ── profil ── */
    @Query("SELECT * FROM profil WHERE id = 1")
    fun profilAliran(): Flow<Profil?>

    @Query("SELECT * FROM profil WHERE id = 1")
    suspend fun profilSekarang(): Profil?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanProfil(p: Profil)

    /* ── penulisan borongan untuk sinkron ── */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanAkunBanyak(daftar: List<Akun>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanKantongBanyak(daftar: List<Kantong>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanKategoriBanyak(daftar: List<Kategori>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanTransaksiBanyak(daftar: List<Transaksi>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun simpanPengingatBanyak(daftar: List<Pengingat>)

    /* ── reset ── */
    @Query("DELETE FROM transaksi") suspend fun kosongkanTransaksi()
    @Query("DELETE FROM akun") suspend fun kosongkanAkun()
    @Query("DELETE FROM kantong") suspend fun kosongkanKantong()
    @Query("DELETE FROM kategori") suspend fun kosongkanKategori()
    @Query("DELETE FROM pengingat") suspend fun kosongkanPengingat()
    @Query("DELETE FROM profil") suspend fun kosongkanProfil()
}
