# DompetQ — Konsep & Spesifikasi

**Status:** Konsep v2 (menggantikan `konsep-dompet-app.md`)
**Tanggal:** 13 Agustus 2026
**Platform:** Web mobile-first → APK WebView

---

## 1. Ringkasan

Pencatat keuangan pribadi berbasis web yang memisahkan **"di mana uang berada"** dari **"milik siapa uang itu."**

Banyak orang memegang uang yang secara fisik ada di rekeningnya tapi bukan haknya — kas RT, uang arisan, dana kegiatan, titipan orang tua, modal usaha bersama. Saldo rekening jadi angka yang menipu.

Satu pertanyaan yang harus dijawab aplikasi ini dalam sedetik:

> "Dari total uang yang ada di tangan saya sekarang, berapa yang benar-benar boleh saya pakai?"

**Multi-user.** Siapa pun bisa login dengan akun Google, dan datanya tersimpan di Google Drive miliknya sendiri.

---

## 2. Posisi terhadap Aplikasi Sejenis

Riset singkat terhadap aplikasi yang beredar:

| Aplikasi | Model pemisahan dana | Kenapa belum cukup |
|---|---|---|
| Goodbudget | Envelope budgeting | Amplop = *rencana belanja*, bukan kepemilikan. Uang titipan tetap dihitung sebagai uang pengguna |
| Catat Uang | Workspace / buku terpisah | Buku terpisah menghilangkan angka gabungan — tidak bisa menjawab "total di tangan vs yang boleh dipakai" |
| Actual Budget | Envelope zero-based | Sama seperti Goodbudget; desktop-first, perlu self-host |
| Firefly III | Piggy bank + double-entry | Paling dekat secara akuntansi, tapi berat, butuh server, dan sangat tidak ramah HP |
| Spendee | Dompet bersama | Untuk berbagi antar orang, bukan menandai kepemilikan dana di satu orang |

**Celah yang diambil DompetQ:**

1. Amplop dimodelkan sebagai **kepemilikan**, bukan anggaran. Ini perbedaan konseptual, bukan sekadar penamaan.
2. **Mobile-first sungguhan** — dirancang untuk dipakai sambil berdiri di warung, bukan versi kecil dari tampilan desktop.
3. **Data milik pengguna** — tersimpan di Google Drive-nya sendiri, bukan di server pihak ketiga.
4. **Fitur muncul sesuai kondisi** — pengguna yang tidak memegang uang titipan tidak pernah melihat kerumitannya.

Yang sengaja **tidak** dikejar: sinkronisasi rekening bank otomatis, investasi, multi-mata uang, kolaborasi tim.

---

## 3. Konsep Kunci: Dua Dimensi Uang

Setiap rupiah punya dua atribut yang independen:

| Dimensi | Pertanyaan | Istilah di UI |
|---|---|---|
| **Akun** | Uang ini fisiknya di mana? | "Rekening & Dompet" |
| **Sumber Dana** | Uang ini punya siapa? | "Sumber Dana" |

Satu akun bisa berisi beberapa sumber dana. Satu sumber dana bisa tersebar di beberapa akun.

> **Catatan istilah:** di dalam kode entitas ini bernama `kantong`. Di UI selalu disebut **"Sumber Dana"** karena lebih dipahami pengguna awam. Jangan campur aduk keduanya di teks antarmuka.

**Ilustrasi** (bukan data awal — semua nama & angka diinput pengguna sendiri):

```
BCA               Rp 5.000.000
├── Pribadi       Rp 3.200.000
└── Kas RT        Rp 1.800.000

Tunai             Rp   400.000
├── Pribadi       Rp   250.000
└── Kas RT        Rp   150.000
```

Turunan angka di dashboard:

- Total saldo fisik = Rp 5.400.000
- Bukan milik saya = Rp 1.950.000
- **Uang saya bersih = Rp 3.450.000** ← angka utama
- Aman dipakai = setelah dikurangi kewajiban bulan ini (bagian 8)

### 3.1 Jangkar logika: flag, bukan nama

Sistem **tidak boleh** bergantung pada string nama seperti `"Pribadi"`. Pengguna bebas menamai sumber dananya apa pun. Yang menentukan perhitungan adalah field:

- `kantong.jenis = milik_sendiri | titipan` → menentukan "uang saya bersih"
- `kantong.is_default = true` → sumber dana yang otomatis terpilih saat input cepat
- `akun.is_default = true` → akun yang otomatis terpilih

### 3.2 Aturan yang dijaga sistem

1. Saldo tiap sumber dana **tidak boleh negatif**. Kalau sumber dana titipan jadi negatif, artinya uang orang lain terpakai untuk keperluan pribadi — sistem memberi peringatan merah mencolok, bukan diam.
2. **Transfer antar akun** (tarik tunai) tidak mengubah sumber dana. Yang berubah hanya lokasi fisik.
3. **Transfer antar sumber dana** (nombokin kas pakai uang pribadi) dicatat sebagai jenis transaksi tersendiri agar jejaknya jelas.
4. Kalau pengguna hanya punya satu sumber dana bertipe `milik_sendiri`, **seluruh UI sumber dana disembunyikan**. Tidak ada pilihan sumber dana di form input, tidak ada blok "bukan milik saya" di dashboard. Aplikasi terasa seperti pencatat keuangan biasa.

---

## 4. Alur Aplikasi

### 4.1 Masuk

```
Login Google
  → cek Drive pengguna: ada file `dompetq-data`?
      ada       → baca, langsung ke Dashboard
      tidak ada → jalankan Onboarding
```

### 4.2 Onboarding (sekali seumur akun)

**Langkah 1 — Profil**
- Nama: prefill dari akun Google, boleh diedit
- Email: otomatis dari Google, tidak bisa diedit, hanya ditampilkan
- Tidak meminta alamat, nomor HP, atau data pribadi lain — tidak dipakai fitur apa pun

**Langkah 2 — Akun (rekening & dompet)**
- Pencarian dari **seed bank & e-wallet Indonesia** (lihat 6.1)
- Bisa multi-rekening, termasuk beberapa rekening di bank yang sama → pengguna memberi label sendiri ("BCA Gaji", "BCA Tabungan")
- Selalu ada opsi **"Lainnya / tulis sendiri"** untuk koperasi, bank daerah, paylater
- Minimal 1 akun

**Langkah 3 — Sumber Dana**

Pertanyaan: *"Apakah ada uang di rekening Anda yang bukan milik Anda sendiri?"*

- **Tidak** → sistem membuat satu sumber dana otomatis (`milik_sendiri`, `is_default`), namanya bisa diedit. Langkah 4 dilewati.
- **Ya** → pengguna menambah sumber dana satu per satu lewat tombol `+`. Nama bebas, tipe `titipan`. Tidak perlu menyebutkan jumlahnya di muka.

**Langkah 4 — Saldo awal**

Dua lapis. Ini bagian paling rawan salah dan harus dibuat sejelas mungkin.

```
4a. Nominal per akun
    BCA    Rp 5.000.000
    Tunai  Rp   400.000

4b. Pecah per sumber dana   ← hanya muncul kalau sumber dana > 1
    BCA    → Pribadi 3.200.000 | Kas RT 1.800.000    ✓ pas
    Tunai  → Pribadi   250.000 | Kas RT   150.000    ✓ pas
```

Validasi 4b: jumlah per baris harus persis sama dengan nominal akunnya. Tampilkan selisih secara langsung saat mengetik, dan **tidak boleh lanjut** sebelum semua pas.

Kalau sumber dana hanya satu, 4b dilewati dan seluruh saldo masuk ke sana.

**Langkah 5 — Kategori (boleh dilewati)**
- Daftar saran umum ditampilkan sebagai **centang-pilih**, bukan langsung dibuat semua
- Pengguna bisa menambah kategori sendiri
- Kategori juga selalu bisa dibuat langsung dari layar input transaksi, tanpa keluar ke pengaturan

**Penutup:** sistem membuat spreadsheet `dompetq-data` di Drive pengguna, menulis seluruh sheet + data awal, lalu masuk ke dashboard.

### 4.3 Pemakaian harian

```
Buka app → Dashboard → tombol + → pilih jenis → isi → simpan
```

Empat jenis transaksi. Dua yang terakhir sering terlewat di aplikasi lain dan justru paling sering salah dicatat:

| Jenis | Kapan | Efek |
|---|---|---|
| **Masuk** | Terima gaji, terima setoran kas | Saldo naik |
| **Keluar** | Belanja, bayar | Saldo turun |
| **Transfer akun** | Tarik tunai, setor tunai, transfer antar rekening sendiri | Saldo total tetap — hanya pindah wadah. **Bukan pengeluaran** |
| **Transfer sumber dana** | Nombokin kas pakai uang pribadi, mengembalikannya | Saldo total tetap — hanya pindah kepemilikan |

Di UI, `+` masuk dan `−` keluar ditampilkan besar; transfer sekunder dan lebih kecil karena frekuensinya jauh lebih rendah.

---

## 5. Halaman & Navigasi

Dirancang **khusus tampilan HP**. Navigasi bawah 4 item + satu tombol tambah mengambang di tengah.

```
┌─────────────────────────────────┐
│  Dashboard                      │
│    ├── Uang saya bersih (besar) │
│    ├── Total fisik & titipan    │
│    ├── Saldo per akun           │
│    ├── Saldo per sumber dana    │
│    ├── Grafik tren pengeluaran  │
│    └── Proyeksi 1–3 bulan       │
├─────────────────────────────────┤
│  Transaksi                      │
│    Riwayat + filter + cari      │
├─────────────────────────────────┤
│  [ + ]  ← tombol mengambang     │
│    Input transaksi cepat        │
├─────────────────────────────────┤
│  Laporan                        │
│    Rekap bulanan + ekspor       │
├─────────────────────────────────┤
│  Profil                         │
│    ├── Data diri                │
│    ├── Kelola akun              │
│    ├── Kelola sumber dana       │
│    ├── Kelola kategori & pihak  │
│    ├── Kewajiban & target       │
│    ├── Pengingat                │
│    └── Ekspor data              │
└─────────────────────────────────┘
```

Semua penambahan data (akun baru, sumber dana baru, kategori baru) terjadi di **Profil** — konsisten dengan permintaan "menu edit profil bisa menambah apapun disana".

### 5.1 Dashboard

Urutan dari atas:

1. **Uang saya bersih** — angka paling besar di layar. Hijau. Kalau ada sumber dana titipan yang negatif, seluruh kartu jadi merah dengan peringatan eksplisit.
2. **Baris ringkas**: Total di tangan · Bukan milik saya (disembunyikan kalau tidak ada titipan)
3. **Saldo per akun** — daftar kartu horizontal yang bisa digeser
4. **Saldo per sumber dana** — badge berwarna, titipan diberi warna berbeda yang jelas
5. **Grafik tren** — pengeluaran per kategori, 30 hari terakhir
6. **Proyeksi** — ringkas, dengan tautan ke rincian (bagian 8)
7. **Transaksi terakhir** — 5 teratas

---

## 6. Model Data

Satu spreadsheet `dompetq-data` di Drive **milik pengguna**, satu sheet per tabel.

### 6.1 `akun`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | UUID |
| nama | string | label pengguna: "BCA Gaji" |
| bank_kode | string | dari seed, atau kosong kalau "tulis sendiri" |
| jenis | enum | `tunai` / `bank` / `ewallet` / `lainnya` |
| is_default | boolean | terpilih otomatis saat input |
| urutan | number | sorting tampilan |
| aktif | boolean | arsip tanpa menghapus histori |

**Seed bank & e-wallet** — bank besar dan e-wallet populer saja (~30 entri), disimpan sebagai JSON statis di front-end, bukan di spreadsheet:

- Bank: BCA, Mandiri, BRI, BNI, BSI, CIMB Niaga, Permata, Danamon, BTN, Panin, OCBC, Maybank, Mega, Bukopin, BTPN, Jago, SeaBank, Blu, Allo, Neo Commerce
- E-wallet: GoPay, OVO, DANA, ShopeePay, LinkAja, Flip, Jenius
- Lain: Tunai, Lainnya (tulis sendiri)

### 6.2 `kantong` — Sumber Dana

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | UUID |
| nama | string | bebas, diinput pengguna |
| jenis | enum | `milik_sendiri` / `titipan` |
| is_default | boolean | terpilih otomatis saat input |
| warna | string | badge di UI |
| catatan | string | konteks bebas |

Sumber dana bertipe `titipan` otomatis dikeluarkan dari perhitungan "uang saya bersih".

### 6.3 `transaksi` — inti sistem

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | UUID |
| timestamp | ISO 8601 | waktu kejadian |
| dibuat_pada | ISO 8601 | waktu input (audit trail) |
| jenis | enum | `masuk` / `keluar` / `transfer_akun` / `transfer_kantong` / `saldo_awal` |
| nominal | number | selalu positif; arah ditentukan `jenis` |
| akun_id | string | akun sumber |
| akun_tujuan_id | string | hanya untuk `transfer_akun` |
| kantong_id | string | sumber dana asal |
| kantong_tujuan_id | string | hanya untuk `transfer_kantong` |
| kategori_id | string | |
| pihak_id | string | agen/pihak terkait (6.5) |
| keterangan | string | teks bebas |
| bukti_url | string | tautan bukti |
| bukti_thumb | string | thumbnail, opsional |
| reversal_dari | string | id transaksi yang dikoreksi |

**Prinsip append-only.** Koreksi dilakukan dengan entri pembalik yang menunjuk ID asli, bukan mengedit baris lama. Log timestamp tetap jujur — penting justru karena ada uang orang lain di dalamnya.

**Saldo awal dicatat sebagai transaksi** berjenis `saldo_awal`, satu baris per kombinasi akun × sumber dana, bertanggal saat onboarding. Tidak perlu tabel terpisah, dan otomatis konsisten dengan prinsip append-only.

### 6.4 `kategori`

| Kolom | Tipe |
|---|---|
| id | string |
| nama | string |
| tipe | `pemasukan` / `pengeluaran` |
| induk_id | string (opsional) |
| ikon | string |

### 6.5 `pihak` — agen / lawan transaksi

Menjawab "dari siapa" / "ke siapa": tempat kerja, klien, warga tertentu, marketplace. Dipisahkan dari kategori agar bisa difilter silang — misalnya "semua pemasukan dari klien X sepanjang 2026".

| Kolom | Tipe |
|---|---|
| id | string |
| nama | string |
| tipe | `pemberi` / `penerima` / `keduanya` |
| kontak | string |

> Di dokumen lama entitas ini bernama `sumber`. Diganti jadi `pihak` agar tidak tertukar dengan "Sumber Dana".

### 6.6 `kewajiban` — cicilan, hutang, kebutuhan pasti

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | string | |
| nama | string | |
| jenis | enum | `cicilan` / `hutang` / `kebutuhan_rutin` / `kebutuhan_sekali` |
| nominal_per_periode | number | |
| periode | enum | `bulanan` / `mingguan` / `sekali` |
| tanggal_jatuh_tempo | date/number | |
| sisa_tenor | number | |
| total_pokok | number | |
| akun_pembayar_id | string | |
| status | enum | `aktif` / `lunas` / `ditunda` |

### 6.7 `target` — tabungan / tujuan

| Kolom | Tipe |
|---|---|
| id | string |
| nama | string |
| nominal_target | number |
| tenggat | date |
| kantong_id | string |
| terkumpul | number (dihitung) |

### 6.8 `pengingat`

| Kolom | Tipe |
|---|---|
| id | string |
| judul | string |
| jenis | `jatuh_tempo` / `catat_harian` / `kustom` |
| kewajiban_id | string (opsional) |
| jadwal | string |
| kanal | `email` / `notifikasi` / `keduanya` |
| aktif | boolean |

### 6.9 `profil` & `snapshot_bulanan`

`profil`: satu baris — nama, email, tanggal_mulai, versi_skema.
`snapshot_bulanan`: saldo tiap akun × sumber dana di akhir tiap bulan (lihat 9.3).

---

## 7. Ekspor & Laporan

Permintaan: *"fitur ekspor buat portofolio."*

> **Asumsi yang saya ambil** — mohon dikoreksi kalau meleset: yang dimaksud adalah menghasilkan dokumen rapi berisi ringkasan kondisi keuangan, yang bisa ditunjukkan ke pihak lain (lampiran pengajuan, laporan pertanggungjawaban, bukti pengelolaan dana). Bukan portofolio investasi (saham/reksadana) — itu di luar cakupan aplikasi ini.

Tiga bentuk ekspor:

| Bentuk | Isi | Untuk apa |
|---|---|---|
| **CSV mentah** | Seluruh transaksi + master data | Cadangan, olah sendiri di Excel |
| **Rekap PDF** | Ringkasan periode: saldo, arus kas masuk/keluar, breakdown kategori, grafik | Laporan pribadi, lampiran pengajuan |
| **Laporan per sumber dana** | Mutasi satu sumber dana saja, urut tanggal, dengan tautan bukti | **Pertanggungjawaban dana titipan** — cetak mutasi Kas RT saja tanpa membuka keuangan pribadi |

Bentuk ketiga itu yang paling bernilai dan tidak dimiliki aplikasi mana pun yang saya periksa. Bendahara bisa menyerahkan laporan kas tanpa ikut membuka isi dompet pribadinya.

---

## 8. Modul Proyeksi

Menjawab: *"sampai akhir bulan, apakah uang saya cukup?"* Dashboard menampilkan proyeksi **1–3 bulan** ke depan.

```
Saldo milik sendiri di awal periode
+ Pemasukan terjadwal yang belum masuk
− Cicilan jatuh tempo periode ini
− Hutang yang harus dibayar
− Kebutuhan rutin
− Kebutuhan sekali yang sudah pasti
= Sisa proyeksi
```

Tampilan:

- **Angka besar** sisa proyeksi — hijau kalau positif, merah kalau negatif
- **Timeline jatuh tempo** urut tanggal, dengan penanda mana yang sudah lewat tanpa dibayar
- **Peringatan dini** — kalau ada tanggal di tengah periode saldo proyeksi jatuh di bawah nol, *meskipun* akhir periodenya positif. Kasus ini paling sering terlewat
- **Uji ketahanan** — "kalau pemasukan X telat 2 minggu, apa yang bermasalah?"

Proyeksi **hanya menghitung dana `milik_sendiri`**. Uang titipan tidak pernah masuk perhitungan "cukup atau tidak" — justru itu inti aplikasi ini.

Perhitungan dilakukan di sisi klien. Datanya kecil, tidak perlu backend.

---

## 9. Arsitektur Teknis

### 9.1 Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Front-end | HTML + CSS + JS vanilla (atau Alpine.js) | statis, cepat, mudah di-hosting |
| Hosting | GitHub Pages / Netlify / Cloudflare Pages | gratis, HTTPS otomatis |
| Auth | Google Identity Services | sekaligus token untuk Sheets & Drive API |
| Data | Google Sheets API v4, spreadsheet di Drive pengguna | tanpa server, data milik pengguna |
| Grafik | Chart.js | ringan, cukup untuk kebutuhan |
| Bukti | arsip-gratis.my.id | perlu klarifikasi endpoint (9.5) |
| Pengingat | Google Apps Script time-driven trigger | jalan tanpa server |
| APK | WebView wrapper (Capacitor / Median / Bubblewrap) | tahap akhir |

### 9.2 Penyimpanan: satu spreadsheet per pengguna, di Drive pengguna

```
Login → cari file `dompetq-data` milik app di Drive pengguna
  ketemu       → simpan fileId, baca
  tidak ketemu → Onboarding → buat spreadsheet baru + tulis semua sheet
```

Scope OAuth:

```
openid email profile                                  identitas
https://www.googleapis.com/auth/drive.file            buat & akses HANYA file buatan app
https://www.googleapis.com/auth/spreadsheets          baca-tulis isi spreadsheet
```

`drive.file` memberi akses **hanya ke file yang dibuat aplikasi ini** — bukan seluruh Drive. Ini scope paling sempit yang memungkinkan pola per-pengguna, dan jauh lebih aman daripada menyimpan data keuangan semua pengguna di satu spreadsheet milik pengembang.

Konsekuensi yang harus disadari:

- Pengembang **tidak punya akses** ke data pengguna mana pun. Ini fitur, bukan keterbatasan — tapi artinya tidak ada dashboard admin dan tidak bisa membantu memperbaiki data pengguna dari jauh.
- Pengguna bisa membuka spreadsheet-nya langsung dan merusaknya. Perlu validasi skema saat baca, dengan pesan yang jelas kalau strukturnya rusak.
- Kalau nanti dipublikasikan, `drive.file` + `spreadsheets` termasuk **sensitive scope** dan butuh verifikasi OAuth Google. Selama masih tahap uji (mode Testing, maks 100 pengguna), belum diperlukan.

### 9.3 Performa

Sheets bukan database. Mitigasi wajib:

- **Cache lokal** — salinan transaksi di IndexedDB, sinkron delta berdasarkan `dibuat_pada`. Jangan tarik seluruh sheet tiap buka app.
- **Batasi tarikan** — dashboard cukup 3 bulan terakhir; riwayat lama ditarik saat diminta.
- **Snapshot bulanan** — sheet berisi saldo tiap akun × sumber dana di akhir tiap bulan. Saldo hari ini = snapshot terakhir + transaksi sesudahnya. Tanpa ini aplikasi melambat setelah setahun.
- **Antrean tulis** — kalau koneksi putus saat simpan, masukkan ke antrean lokal dan coba lagi. Transaksi tidak boleh hilang diam-diam.

### 9.4 Optimistic UI

Simpan transaksi = langsung tampil di dashboard dan saldo langsung berubah, tanpa menunggu respons API. Kalau tulis gagal, tampilkan penanda "belum tersimpan" pada baris itu dengan tombol coba lagi. Target < 10 detik per entri di HP hanya tercapai kalau pengguna tidak pernah menunggu jaringan.

### 9.5 Integrasi bukti (arsip-gratis.my.id)

**Masih perlu diklarifikasi:** bagaimana situs itu menerima unggahan?

- **Kalau ada endpoint upload** — kirim `FormData` dari front-end, terima URL, simpan di `bukti_url`. Butuh CORS diizinkan untuk domain DompetQ.
- **Kalau belum ada** — tambahkan endpoint sederhana: terima file + token, kembalikan URL permanen, sekalian buat thumbnail agar riwayat bisa menampilkan pratinjau tanpa memuat file penuh.

Sifatnya **benar-benar opsional**: kalau upload gagal atau lambat, transaksi tetap tersimpan dan bukti bisa dilampirkan belakangan. Upload tidak boleh pernah memblokir penyimpanan transaksi.

### 9.6 Pengingat

Apps Script terpasang pada spreadsheet pengguna, trigger harian:

```
Setiap hari 07.00
  → baca sheet `kewajiban` dan `pengingat`
  → cari yang jatuh tempo ≤ 3 hari
  → kirim email ke pengguna (MailApp.sendEmail)
  → tandai sudah dikirim agar tidak dobel
```

Email lebih andal daripada notifikasi browser karena tidak butuh app dalam keadaan terbuka. Push notification baru masuk akal setelah tahap APK.

Catatan: Apps Script harus dipasang otomatis ke spreadsheet baru. Ini butuh scope tambahan (`script.projects`) — kalau terlalu rumit, alternatifnya pengguna memasang sendiri sekali lewat panduan, atau fitur pengingat ditunda ke v2.

---

## 10. Prioritas Pengerjaan

### MVP (v1)

1. Login Google + deteksi/pembuatan spreadsheet di Drive pengguna
2. Onboarding lengkap 5 langkah (bagian 4.2)
3. Input transaksi cepat — 4 jenis, target < 10 detik di HP
4. Dashboard: uang saya bersih, saldo per akun, saldo per sumber dana
5. Riwayat + filter (tanggal, akun, sumber dana, kategori, pihak)
6. Kelola akun / sumber dana / kategori dari halaman Profil

### v2

7. Grafik tren pengeluaran
8. Kewajiban + proyeksi 1–3 bulan
9. Upload bukti
10. Ekspor: CSV, rekap PDF, laporan per sumber dana
11. Target/tabungan dengan progress bar

### v3

12. Cache lokal + snapshot bulanan
13. Pengingat terjadwal (Apps Script)
14. Mode offline penuh
15. APK WebView

Fitur AI sengaja belum masuk. Kandidat paling bernilai kalau nanti dibutuhkan: OCR bukti transfer dan auto-kategorisasi — keduanya bisa ditambahkan tanpa mengubah model data.

**Mulai pakai aplikasi ini secara nyata sejak langkah 6.** Sisa fitur akan jauh lebih tepat sasaran kalau dirancang setelah tahu apa yang benar-benar mengganggu saat dipakai sehari-hari.

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Salah isi saldo awal per sumber dana | seluruh angka salah sejak hari pertama | validasi selisih real-time di onboarding 4b, tidak bisa lanjut sebelum pas |
| Uang titipan terpakai tanpa sadar | masalah serius, bukan sekadar teknis | saldo sumber dana tidak boleh negatif + peringatan merah di dashboard |
| Salah pilih sumber dana saat input | angka bersih jadi salah | default = sumber dana `is_default`, warna badge titipan sangat berbeda |
| Transfer dicatat sebagai pengeluaran | saldo & laporan salah | jenis transfer dibuat menonjol saat memilih, dengan penjelasan singkat |
| Sheets melambat seiring data bertambah | app ditinggalkan | snapshot bulanan + cache lokal (9.3) |
| Kuota Sheets API terlampaui | gagal simpan | batch tulis, jangan tulis per keystroke |
| Token OAuth kedaluwarsa saat input | data hilang | antrean lokal + refresh token sebelum simpan |
| Pengguna merusak spreadsheet manual | app error tak terbaca | validasi skema saat baca + pesan pemulihan yang jelas |
| Lupa mencatat | data tidak akurat | pengingat harian + input yang benar-benar cepat |

Risiko terbesar aplikasi keuangan pribadi bukan bug, tapi **berhenti dipakai**. Semua keputusan desain dinilai dari satu ukuran: berapa detik untuk mencatat satu transaksi di HP sambil berdiri di warung.

---

## 12. Yang Masih Perlu Diputuskan

1. **"Ekspor buat portofolio"** — apakah asumsi di bagian 7 sudah benar?
2. **Endpoint arsip-gratis.my.id** — sudah ada API upload, atau perlu dibuat?
3. **Pengingat Apps Script** — pasang otomatis (butuh scope tambahan), pasang manual sekali oleh pengguna, atau tunda ke v3?
4. **Nama & branding** — "DompetQ" dipakai sebagai nama kerja. Sudah final?
5. **Publikasi OAuth** — tetap mode Testing (maks 100 pengguna, cukup untuk uji), atau mau langsung mengurus verifikasi Google supaya bisa dipakai siapa saja?
