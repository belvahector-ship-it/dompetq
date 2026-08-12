# Konsep & Spesifikasi — Aplikasi Dompet Pribadi

**Status:** Draft konsep (prototyping)
**Tanggal:** 13 Agustus 2026
**Implementasi:** direncanakan via Claude Code

---

## 1. Ringkasan

Aplikasi web pencatat keuangan pribadi dengan satu pembeda utama dari aplikasi sejenis: **memisahkan "di mana uang berada" dari "milik siapa uang itu."**

Karena selain punya pendapatan pribadi, saya juga memegang uang kas warga, saldo di dompet/rekening saya bukan seluruhnya milik saya. Aplikasi ini harus bisa menjawab satu pertanyaan dengan cepat:

> "Dari total uang yang ada di tangan saya sekarang, berapa yang benar-benar boleh saya pakai?"

Web dulu, lalu dibungkus jadi APK WebView.

---

## 2. Konsep Kunci: Dua Dimensi Uang

Ini fondasi seluruh model data. Setiap rupiah punya **dua atribut yang independen**:

| Dimensi | Pertanyaan | Contoh nilai |
|---|---|---|
| **Akun** (wadah / likuiditas) | Uang ini fisiknya di mana? | Tunai dompet, BCA, BRI, GoPay, DANA, Brankas |
| **Kantong** (kepemilikan / dana) | Uang ini punya siapa? | Pribadi, Kas Warga, Titipan lain, Dana darurat |

Satu akun bisa berisi beberapa kantong. Satu kantong bisa tersebar di beberapa akun.

**Contoh nyata:**

```
BCA               Rp 5.000.000
├── Pribadi       Rp 3.200.000
└── Kas Warga     Rp 1.800.000

Tunai dompet      Rp   400.000
├── Pribadi       Rp   250.000
└── Kas Warga     Rp   150.000
```

**Turunan angka yang muncul di dashboard:**

- Total saldo fisik = Rp 5.400.000
- Kewajiban titipan (non-pribadi) = Rp 1.950.000
- **Uang pribadi bersih = Rp 3.450.000** ← angka yang paling sering saya butuhkan
- Dapat dibelanjakan (setelah dikurangi cicilan & kebutuhan pasti bulan ini) = dihitung di modul proyeksi

**Aturan yang harus dijaga sistem:**

1. Saldo tiap kantong tidak boleh negatif. Kalau kantong "Kas Warga" jadi negatif, artinya uang kas terpakai untuk keperluan pribadi — sistem harus memberi peringatan merah, bukan diam.
2. Transfer antar akun (misal tarik tunai dari BCA) **tidak** mengubah kantong. Yang berubah cuma lokasi fisiknya.
3. Transfer antar kantong (misal saya menyetorkan uang pribadi untuk menutup kas sementara) dicatat eksplisit sebagai jenis transaksi tersendiri, supaya jejaknya jelas.

Catatan: aplikasi kas warga sudah ada terpisah dan tetap jadi sumber kebenaran untuk pertanggungjawaban ke warga. Kantong "Kas Warga" di sini hanya cermin, untuk kepentingan saya pribadi.

---

## 3. Model Data

Satu spreadsheet Google Sheets, satu sheet per tabel.

### 3.1 `akun` — wadah fisik

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | `akun_bca`, `akun_tunai` |
| nama | string | "BCA 1234", "Tunai dompet" |
| jenis | enum | `tunai` / `bank` / `ewallet` / `lainnya` |
| mata_uang | string | default `IDR` |
| saldo_awal | number | saldo saat mulai pakai app |
| urutan | number | untuk sorting tampilan |
| aktif | boolean | arsipkan tanpa menghapus histori |

### 3.2 `kantong` — kepemilikan dana

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | `ktg_pribadi`, `ktg_kaswarga` |
| nama | string | "Pribadi", "Kas Warga RT" |
| jenis | enum | `milik_sendiri` / `titipan` |
| warna | string | untuk badge di UI |
| catatan | string | konteks bebas |

Kantong berjenis `titipan` otomatis dikeluarkan dari perhitungan uang pribadi bersih.

### 3.3 `transaksi` — inti sistem

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | UUID |
| timestamp | ISO 8601 | waktu kejadian |
| dibuat_pada | ISO 8601 | waktu input (audit trail) |
| jenis | enum | `masuk` / `keluar` / `transfer_akun` / `transfer_kantong` |
| nominal | number | selalu positif; arah ditentukan `jenis` |
| akun_id | string | akun sumber |
| akun_tujuan_id | string | diisi hanya untuk `transfer_akun` |
| kantong_id | string | kantong sumber |
| kantong_tujuan_id | string | diisi hanya untuk `transfer_kantong` |
| kategori_id | string | lihat 3.4 |
| sumber_id | string | agen/pihak terkait, lihat 3.5 |
| keterangan | string | teks bebas |
| bukti_url | string | tautan ke arsip-gratis.my.id |
| bukti_thumb | string | URL thumbnail, opsional |

**Prinsip:** transaksi bersifat *append-only*. Koreksi dilakukan dengan entri pembalik (`reversal`) yang menunjuk ID asli, bukan dengan mengedit baris lama. Ini menjaga log timestamp tetap jujur — penting justru karena ada uang titipan di dalamnya.

### 3.4 `kategori`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | |
| nama | string | "Makan", "Transport", "Iuran warga" |
| tipe | enum | `pemasukan` / `pengeluaran` |
| induk_id | string | untuk sub-kategori (opsional) |
| ikon | string | |

### 3.5 `sumber` — agen / pihak

Menjawab "uang ini datang dari siapa" atau "dibayarkan ke siapa": tempat kerja, klien, warga tertentu, marketplace, dsb. Dipisahkan dari kategori supaya bisa difilter silang — misalnya "semua pemasukan dari klien X sepanjang 2026."

| Kolom | Tipe |
|---|---|
| id | string |
| nama | string |
| tipe | `pemberi` / `penerima` / `keduanya` |
| kontak | string |

### 3.6 `kewajiban` — cicilan, hutang, kebutuhan pasti

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | |
| nama | string | "Cicilan laptop", "SPP semester" |
| jenis | enum | `cicilan` / `hutang` / `kebutuhan_rutin` / `kebutuhan_sekali` |
| nominal_per_periode | number | |
| periode | enum | `bulanan` / `mingguan` / `sekali` |
| tanggal_jatuh_tempo | date/number | tanggal dalam bulan, atau tanggal penuh |
| sisa_tenor | number | untuk cicilan |
| total_pokok | number | untuk hutang |
| akun_pembayar_id | string | biasanya dibayar dari akun mana |
| status | enum | `aktif` / `lunas` / `ditunda` |

### 3.7 `target` — tabungan / tujuan

| Kolom | Tipe |
|---|---|
| id | string |
| nama | string |
| nominal_target | number |
| tenggat | date |
| kantong_id | string |
| terkumpul | number (dihitung) |

### 3.8 `pengingat`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | |
| judul | string | |
| jenis | enum | `jatuh_tempo` / `catat_harian` / `kustom` |
| kewajiban_id | string | opsional, tautan ke kewajiban |
| jadwal_cron | string | atau field sederhana: hari + jam |
| kanal | enum | `email` / `notifikasi_browser` / `keduanya` |
| aktif | boolean |

---

## 4. Fitur & Prioritas

### MVP (v1) — target selesai dulu

1. Login Google (OAuth) — hanya akun saya yang diizinkan (whitelist email).
2. CRUD akun & kantong.
3. Input transaksi cepat: nominal → jenis → akun → kantong → kategori → simpan. Target: di bawah 10 detik per entri di HP.
4. Dashboard: saldo per akun, saldo per kantong, **uang pribadi bersih**.
5. Riwayat transaksi dengan filter (rentang tanggal, akun, kantong, kategori, sumber).
6. Upload bukti → arsip-gratis.my.id, simpan URL-nya.

### v2

7. Modul kewajiban + proyeksi bulanan (bagian 6).
8. Target/tabungan dengan progress bar.
9. Pengingat terjadwal.
10. Ekspor CSV / rekap bulanan.

### v3

11. Bungkus jadi APK WebView.
12. Mode offline (antrean transaksi lokal, sinkron saat online).
13. Grafik tren pengeluaran per kategori.

Fitur AI sengaja **belum** masuk. Kalau nanti diperlukan, kandidat paling bernilai adalah OCR bukti transfer dan auto-kategorisasi — keduanya bisa ditambahkan tanpa mengubah model data di atas.

---

## 5. Alur Pengguna Inti

### 5.1 Catat pengeluaran (paling sering)

```
Buka app (sudah login)
  → tombol besar "−" di dashboard
  → ketik nominal
  → pilih akun (default: akun terakhir dipakai)
  → pilih kantong (default: Pribadi)
  → pilih kategori (tampilkan 6 kategori tersering di atas)
  → [opsional] jepret/unggah bukti
  → Simpan
  → saldo di dashboard langsung ter-update (optimistic UI)
```

### 5.2 Terima uang kas dari warga

```
Tombol "+"
  → nominal
  → akun: Tunai dompet
  → kantong: Kas Warga        ← ini yang membedakan
  → kategori: Iuran warga
  → sumber: nama warga
  → unggah bukti transfer
  → Simpan
```

Saldo fisik naik, tapi **uang pribadi bersih tidak berubah**. Ini perilaku yang benar dan jadi inti nilai aplikasi ini.

### 5.3 Setor uang kas ke rekening

```
Tombol "Transfer"
  → jenis: transfer_akun
  → dari: Tunai dompet → ke: BCA
  → kantong: Kas Warga (tidak berubah)
  → nominal
```

### 5.4 Tarik tunai untuk keperluan pribadi

Sama seperti 5.3, tapi kantong Pribadi. Tidak ada pengeluaran tercatat — hanya perpindahan wadah.

---

## 6. Modul Proyeksi Bulanan

Menjawab: "sampai akhir bulan, apakah uang saya cukup?"

```
Saldo pribadi awal periode
+ Pemasukan terjadwal yang belum masuk
− Cicilan jatuh tempo bulan ini
− Hutang yang harus dibayar bulan ini
− Kebutuhan rutin (kos, internet, transport, dll)
− Kebutuhan sekali yang sudah pasti
= Sisa proyeksi akhir bulan
```

Tampilan yang diinginkan:

- **Angka besar**: sisa proyeksi, hijau kalau positif, merah kalau negatif.
- **Timeline jatuh tempo**: daftar kewajiban urut tanggal, dengan penanda mana yang sudah lewat tanpa dibayar.
- **Peringatan dini**: kalau ada tanggal di mana saldo proyeksi jatuh di bawah nol *sebelum* akhir bulan — meskipun akhir bulannya positif. Ini kasus yang sering terlewat.
- **Uji ketahanan sederhana**: "kalau pemasukan X telat 2 minggu, apa yang bermasalah?"

Perhitungan cukup dilakukan di sisi klien (JavaScript) — datanya kecil, tidak perlu backend.

---

## 7. Arsitektur Teknis

### 7.1 Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Front-end | HTML + CSS + JS vanilla (atau Alpine.js) | statis, cepat, mudah di-hosting |
| Hosting | GitHub Pages / Netlify / Cloudflare Pages | gratis, HTTPS otomatis |
| Auth | Google Identity Services (GIS) | sekaligus dapat token untuk Sheets API |
| Data | Google Sheets API v4 + OAuth | read **dan** write, sesuai pilihan |
| Penyimpanan bukti | arsip-gratis.my.id | sudah ada, tinggal integrasi |
| Scheduler | Google Apps Script `time-driven trigger` | jalan tanpa server |
| APK | WebView wrapper (Capacitor / Median / Bubblewrap) | tahap akhir |

### 7.2 Catatan penting soal gviz

gviz (`/gviz/tq?tq=...`) **hanya bisa membaca**, tidak bisa menulis. Karena aplikasi ini butuh tulis, gunakan:

- **Sheets API v4** (`spreadsheets.values.append` / `.batchUpdate`) dengan token OAuth pengguna — dipilih untuk proyek ini.
- gviz masih boleh dipakai untuk **query baca yang berat** (filter, agregasi via bahasa query gviz) karena lebih ringan payload-nya, selama spreadsheet-nya dapat diakses oleh sesi yang sama.

Pola hibrida ini wajar: gviz untuk baca cepat, Sheets API untuk tulis.

### 7.3 Scope OAuth

```
https://www.googleapis.com/auth/spreadsheets   (baca-tulis spreadsheet)
openid email profile                            (identitas)
```

Batasi akses dengan `spreadsheets` saja, jangan minta `drive` penuh — mengurangi permukaan risiko dan mempermudah verifikasi OAuth kalau nanti dipublikasikan.

Karena ini aplikasi single-user, cara paling aman: **whitelist email** di sisi klien *dan* jangan pernah membagikan spreadsheet-nya ke publik. Keamanan sesungguhnya ada di izin spreadsheet, bukan di kode front-end — kode front-end selalu bisa dibaca siapa pun.

### 7.4 Masalah performa yang harus diantisipasi

Sheets bukan database. Beberapa mitigasi:

- **Cache lokal**: simpan salinan transaksi di `localStorage`/IndexedDB, sinkron delta berdasarkan `dibuat_pada`. Jangan tarik seluruh sheet tiap buka app.
- **Batasi tarikan**: dashboard cukup baca 3 bulan terakhir. Riwayat lama ditarik saat diminta.
- **Saldo jangan dihitung dari nol**: buat sheet `snapshot_bulanan` berisi saldo tiap akun+kantong di akhir tiap bulan. Saldo hari ini = snapshot terakhir + transaksi sesudahnya. Tanpa ini, aplikasi akan melambat setelah setahun.
- **Antrean tulis**: kalau koneksi putus saat simpan, masukkan ke antrean lokal dan coba lagi. Jangan biarkan transaksi hilang diam-diam.

### 7.5 Integrasi arsip-gratis.my.id

Perlu diklarifikasi dulu bagaimana situs itu menerima unggahan. Dua kemungkinan:

- **Kalau ada endpoint upload**: kirim `FormData` dari front-end, terima URL file, simpan URL-nya di kolom `bukti_url`. Perlu CORS diizinkan untuk domain aplikasi dompet.
- **Kalau belum ada**: tambahkan endpoint sederhana yang menerima file + token rahasia, mengembalikan URL permanen. Sekalian buat thumbnail agar riwayat transaksi bisa menampilkan pratinjau tanpa memuat file penuh.

Alternatif sementara sebelum integrasi jadi: unggah ke folder Google Drive, simpan `fileId`-nya. Tapi ini menambah scope OAuth `drive.file`, jadi integrasi ke arsip sendiri lebih rapi.

### 7.6 Scheduler & pengingat

Apps Script terpasang pada spreadsheet yang sama, dengan trigger harian:

```
Setiap hari jam 07.00
  → baca sheet `kewajiban` dan `pengingat`
  → cari yang jatuh tempo dalam ≤ 3 hari
  → kirim email ke alamat sendiri (MailApp.sendEmail)
  → tandai sudah dikirim agar tidak dobel
```

Email lebih andal daripada notifikasi browser untuk kasus ini, karena tidak butuh app dalam keadaan terbuka. Notifikasi push baru masuk akal setelah tahap APK.

---

## 8. Struktur Halaman

```
/                  Dashboard — saldo, uang pribadi bersih, ringkas proyeksi
/transaksi         Riwayat + filter + input cepat
/akun              Kelola akun & kantong, lihat matriks akun × kantong
/kewajiban         Cicilan, hutang, kebutuhan pasti
/target            Tabungan & progress
/proyeksi          Timeline jatuh tempo & simulasi
/pengaturan        Kategori, sumber, pengingat, ekspor
```

Untuk HP, navigasi bawah dengan 4 item utama (Dashboard, Transaksi, Proyeksi, Lainnya) dan satu tombol tambah mengambang di tengah.

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Sheets melambat seiring data bertambah | app tidak terpakai | snapshot bulanan + cache lokal (7.4) |
| Kuota Sheets API terlampaui | gagal simpan | batch tulis, jangan tulis per keystroke |
| Token OAuth kedaluwarsa saat input | data hilang | antrean lokal + refresh token sebelum simpan |
| Uang kas terpakai tanpa sadar | masalah serius, bukan sekadar teknis | validasi kantong tidak boleh negatif + peringatan mencolok di dashboard |
| Salah input kantong | angka pribadi bersih jadi salah | default kantong = Pribadi, dan beri warna badge berbeda yang jelas untuk titipan |
| Lupa mencatat | data tidak akurat | pengingat harian + input yang benar-benar cepat |

Risiko terbesar aplikasi keuangan pribadi bukan bug, tapi **berhenti dipakai**. Semua keputusan desain sebaiknya dinilai dari satu ukuran: berapa detik untuk mencatat satu transaksi di HP sambil berdiri di warung.

---

## 10. Urutan Kerja untuk Claude Code

1. Siapkan spreadsheet dengan seluruh sheet dan header sesuai bagian 3.
2. Isi data awal: akun yang benar-benar dipakai, kantong (minimal Pribadi + Kas Warga), kategori dasar.
3. Bangun modul auth + baca — tampilkan saldo saja. Pastikan angkanya benar sebelum lanjut.
4. Bangun input transaksi (tulis). Uji kasus transfer antar akun dan antar kantong secara khusus — di sinilah bug paling mungkin muncul.
5. Dashboard lengkap dengan uang pribadi bersih.
6. Integrasi unggah bukti.
7. Modul kewajiban + proyeksi.
8. Apps Script untuk pengingat.
9. Cache lokal & snapshot bulanan.
10. Bungkus WebView.

Pakai app ini secara nyata mulai langkah 5. Sisa fitur akan jauh lebih tepat sasaran kalau dirancang setelah tahu apa yang benar-benar mengganggu saat dipakai sehari-hari.

---

## 11. Yang Masih Perlu Diputuskan

- Bagaimana cara unggah ke arsip-gratis.my.id (endpoint, autentikasi, CORS)?
- Apakah kantong "Kas Warga" perlu disinkronkan otomatis dengan aplikasi kas warga, atau cukup dicatat manual? (Manual dulu lebih sederhana dan tidak menambah titik kegagalan.)
- Perlu dukungan multi mata uang, atau IDR saja? (IDR saja untuk sekarang.)
- Kategori awal apa saja yang benar-benar dipakai — sebaiknya disusun dari melihat mutasi 1–2 bulan terakhir, bukan dikarang dari nol.
