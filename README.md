# DompetQ — Tingkat 1

Pencatat keuangan pribadi yang memisahkan **di mana uang berada** dari **milik siapa uang itu**.
Konsep lengkap ada di [konsep.md](konsep.md).

**Live:** https://belvahector-ship-it.github.io/dompetq/

Tampilan mengikuti bahasa desain *soft neo-brutalist* yang sama dengan arsip-gratis.my.id:
border tebal 2,4px, bayangan keras `6px 6px 0`, radius 16px, Archivo + Manrope, palet amber/hijau/merah/biru.

## Menjalankan lokal

Butuh server lokal (bukan dibuka langsung sebagai file, karena `localStorage` di `file://` tidak andal).

```bash
python -m http.server 8765
```

Lalu buka `http://127.0.0.1:8765` di browser. Di HP, ganti `127.0.0.1` dengan IP komputer selama satu WiFi.

## Status tingkat 1

**Sudah jalan**

- Onboarding 6 langkah: profil → akun → sumber dana → saldo → pecah per sumber dana → kategori
- Seed 30 bank & e-wallet Indonesia dengan pencarian, plus opsi tulis sendiri
- Empat jenis transaksi: masuk, keluar, pindah tempat (antar akun), pindah sumber dana
- Dashboard: uang saya bersih, total di tangan, titipan, saldo per akun & sumber dana, grafik 30 hari
- Riwayat dengan cari + filter sumber dana
- Koreksi transaksi lewat entri pembalik (append-only, riwayat tidak pernah diubah)
- Peringatan saat sumber dana titipan akan jadi minus
- Laporan bulanan + ekspor CSV, mutasi per sumber dana, dan cadangan JSON
- Mode sederhana: kalau tidak ada uang titipan, seluruh UI sumber dana hilang sendiri

**Pengingat pemasukan & pengeluaran**

Pengingat di sini bukan notifikasi yang lewat begitu saja, melainkan **pertanyaan yang menunggu dijawab**. Selama belum dijawab untuk periode berjalan, ia muncul lagi setiap kali aplikasi dibuka.

Tiap pengingat punya tiga keadaan: *terpenuhi* (sudah dicatat, diam sampai periode berikutnya), *ditunda* ("belum, ingatkan besok"), dan *menunggu* (jatuh tempo lewat, belum dijawab).

Jadwal bisa harian, mingguan, atau bulanan. Tanggal 31 pada bulan pendek jatuh di hari terakhir bulan itu, tidak tumpah ke bulan berikutnya.

Yang **tidak** dilakukan: mencatat transaksi sendiri. Pengingat hanya bertanya; nominal dan tombol simpan tetap di tangan pengguna. Uang tidak boleh dicatat oleh tebakan aplikasi.

Notifikasi browser hanya muncul selagi aplikasi terbuka. Setelah dibungkus jadi APK, izin yang sama dipakai notifikasi sistem sehingga bisa muncul walau aplikasi tertutup.

**Kunci saldo**

Setelah saldo dipastikan benar, nominal rekening bisa dikunci dengan PIN agar tidak berubah tanpa sengaja. PIN disimpan sebagai SHA-256 dari garam + PIN, bukan apa adanya.

Ini **rem, bukan pengaman**. Siapa pun yang paham browser tetap bisa menembusnya — jangan pakai PIN yang sama dengan PIN bank.

Saldo tidak pernah diedit langsung. Kalau angka di aplikasi beda dengan kenyataan, selisihnya dicatat sebagai transaksi penyesuaian sehingga riwayat tetap utuh — selisih itu sendiri sering menandakan ada transaksi yang lupa dicatat.

**Belum** — sengaja ditunda (lihat konsep.md §10)

- Login Google & sinkron ke Google Sheets
- Upload bukti transaksi
- Kewajiban, proyeksi 1–3 bulan, target tabungan
- Pengingat terjadwal
- Bungkus APK

## Penyimpanan

**Lokal selalu jadi sumber baca.** Cepat, jalan tanpa internet, dan tidak pernah kehilangan data kalau Google sedang bermasalah.

**Google Sheets dipasang sebagai cermin** — tujuan tulis kedua, bukan pengganti. Gagal menulis ke Sheets tidak pernah menghilangkan transaksi karena salinannya sudah ada di perangkat. Tulis ke Sheets berjalan di latar dan tidak ditunggu; pengguna tidak boleh menunggu jaringan untuk mencatat satu pengeluaran.

Menyambungkan: **Profil → Sambungkan Google Sheets**. Spreadsheet `dompetq-data` dibuat di Drive milik pengguna sendiri.

Saat menyambung, ada tiga kemungkinan:

| Keadaan | Yang terjadi |
|---|---|
| Sheets masih kosong | Data perangkat diunggah |
| Perangkat masih kosong | Data Sheets diunduh |
| Dua-duanya berisi | Pengguna memilih: pakai Sheets, atau **satukan** |

Menyatukan aman karena transaksi ber-ID unik dan bersifat append-only — tidak ada yang dobel, tidak ada yang hilang. Master data (akun, sumber dana, kategori) tidak digabung otomatis; itu keputusan pengguna.

Tetap rutin unduh cadangan JSON dari halaman **Laporan** — itu satu-satunya salinan yang tidak bergantung pada browser maupun Google.

## Google Cloud — sudah disiapkan

Proyek OAuth untuk tahap berikutnya (sinkron ke Google Sheets) sudah dibuat.

| | |
|---|---|
| Proyek | **DompetQ** — `dompetq-belva-2026` |
| Pemilik | belvahector69@gmail.com |
| API aktif | Google Sheets API, Google Drive API |
| Publishing status | Testing — maksimal 100 test user, belum perlu verifikasi Google |
| OAuth client | `DompetQ Web`, tipe Web application |
| Origin terdaftar | GitHub Pages, `127.0.0.1:8765`, `localhost:8765` |

Client ID ada di [js/config.js](js/config.js) — memang publik, dan aman berada di repo ini.
Client secret **tidak dipakai** oleh aplikasi front-end statis dan tidak boleh masuk repo.

Yang masih perlu dilakukan sebelum integrasi Sheets jalan:

1. Deklarasikan scope di **Google Auth Platform → Data Access** (`drive.file`, `spreadsheets`, `openid`, `email`, `profile`). Opsional selama mode Testing, wajib saat mengajukan verifikasi.
2. Tambahkan test user lain kalau ada orang selain pemilik yang mau mencoba.
3. Bangun `SheetsAdapter` di [js/store.js](js/store.js).

## Struktur

```
index.html        kerangka semua layar
css/style.css     soft neo-brutalist, mobile-first
js/config.js      Client ID & scope Google Cloud
js/seed.js        daftar bank, e-wallet, saran kategori
js/store.js       lapisan penyimpanan + operasi data
js/sheets.js      login Google, SheetsAdapter, logika sinkron
js/pengingat.js   jadwal, jatuh tempo, notifikasi
js/calc.js        semua perhitungan saldo (matriks akun × sumber dana)
js/ui.js          format rupiah/tanggal, modal, toast
js/app.js         routing, onboarding, layar
img/              maskot, ilustrasi, ikon aplikasi
img/sumber/       PNG asli dari generator, sebelum diproses
```

## Aset gambar

Maskot dan ilustrasi dibuat dengan generator gambar, lalu diproses: latar maskot dibuat transparan lewat flood fill dari tepi (supaya krem di dalam garis luar tidak ikut terhapus), semuanya diubah ukuran dan dikuantisasi ke palet 64 warna.

Ilustrasi berwarna datar dengan garis tebal sangat diuntungkan palet: **4,2 MB → 161 KB, tanpa penurunan yang terlihat.** Aslinya disimpan di `img/sumber/`.

Aturan penting: **saldo akun dan saldo sumber dana tidak pernah dihitung terpisah.** Keduanya turunan dari satu matriks di `Calc.matriks()`, supaya tidak mungkin saling bertentangan.

## Data uji

Aplikasi berisi data contoh dari sesi pengujian. Sebelum dipakai sungguhan:
**Profil → Hapus semua data**, lalu onboarding ulang dengan angka asli.
