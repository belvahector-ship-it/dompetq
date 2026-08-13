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

## Membungkus jadi APK

Aplikasi web yang sama dibungkus jadi aplikasi Android memakai [Capacitor](https://capacitorjs.com). Tidak ada kode yang ditulis dua kali: APK memuat berkas HTML/CSS/JS yang persis sama, dijalankan di WebView sistem.

**Yang perlu terpasang:** Node.js, Android Studio (dipakai untuk Android SDK + JDK bawaannya). JDK terpisah tidak perlu.

```bash
npm install
npm run apk:debug
```

Hasilnya di `rilis/dompetq-1.0.0-debug.apk` — salin ke HP, buka, izinkan pemasangan dari sumber tidak dikenal.

Untuk versi yang dipakai sehari-hari, pakai build release — lebih cepat dan tidak menyandang tanda *debuggable*:

```bash
npm run apk:rilis
```

| Perintah | Yang terjadi |
|---|---|
| `npm run siapkan` | Merakit `www/` dari `index.html`, `css/`, `js/`, `img/` |
| `npm run sinkron` | `siapkan` + menyalin `www/` ke proyek Android |
| `npm run apk:debug` | `sinkron` + Gradle `assembleDebug` |
| `npm run apk:rilis` | `sinkron` + Gradle `assembleRelease` (ditandatangani) |

`www/`, `assets/`, dan `rilis/` semuanya hasil rakitan dan tidak ikut ter-commit — semua bisa dibuat ulang dari sumber.

**Ikon dan layar pembuka** dibuat ulang dari `img/sumber/ikon-asli.png` lewat `node tools/buat-ikon.mjs`, lalu `npx capacitor-assets generate --android`. Lapisan depan ikon adaptif sengaja lebih kecil daripada ikon klasik karena Android memotong bagian luar canvas.

### Kunci penandatanganan

`android/dompetq.keystore` beserta `android/keystore.properties` adalah **identitas aplikasi ini**. Android hanya mau memasang pembaruan yang ditandatangani kunci yang sama. Kalau berkas itu hilang, tidak ada cara memulihkannya — satu-satunya jalan adalah menerbitkan aplikasi dengan `applicationId` baru, dan pengguna lama harus menghapus pasangan lamanya dulu.

Keduanya sudah masuk `.gitignore`. **Simpan cadangannya di luar folder proyek.**

## Versi native (native/)

Aplikasi Android sungguhan — Kotlin + Jetpack Compose + Room, **tanpa WebView sama sekali**. Dibangun terpisah supaya versi web dan APK Capacitor tetap utuh.

```bash
cd native
./gradlew assembleRelease
```

Hasilnya di `native/app/build/outputs/apk/release/`. `applicationId`-nya `id.my.ibstudio.dompetq.asli` — sengaja beda dari versi Capacitor supaya keduanya bisa terpasang berdampingan untuk dibandingkan.

**Yang hanya bisa dilakukan versi ini**

| | Capacitor (WebView) | Native |
|---|---|---|
| Notifikasi saat aplikasi tertutup | Tidak bisa — `Notification` tidak ada di WebView | Bisa, lewat `AlarmManager` + `NotificationManager` |
| Alarm tepat pada jamnya | Tidak ada | `setExactAndAllowWhileIdle`, turun ke alarm longgar kalau izin ditolak |
| Bertahan setelah HP restart | — | `BootReceiver` menjadwalkan ulang semua alarm |
| Jatuh tempo di kalender HP | — | Agenda berulang lewat `CalendarContract` |
| Izin runtime | — | Notifikasi, alarm tepat waktu, kalender |

Alasan `USE_EXACT_ALARM` **tidak** dipakai walau lebih praktis: Google Play membatasinya untuk aplikasi yang fungsi utamanya alarm atau kalender. Aplikasi keuangan yang memakainya berisiko ditolak. Yang dipakai `SCHEDULE_EXACT_ALARM`, diberikan pengguna lewat Pengaturan → Alarm & pengingat.

**Aturan uang diporting persis, bukan ditulis ulang dari ingatan.** `Calc.kt` adalah terjemahan langsung `js/calc.js`: matriks akun × sumber dana tetap satu-satunya sumber kebenaran, transaksi tetap append-only, koreksi tetap berupa entri pembalik.

**Diuji** — 22 unit test di `native/app/src/test/`, jalan tanpa perangkat:

```bash
cd native
./gradlew testDebugUnitTest
```

Yang diuji justru aturan yang paling mahal kalau salah: saldo akun dan saldo sumber dana harus selalu berasal dari matriks yang sama, entri pembalik harus menihilkan saldo tapi hilang dari laporan, arus kas harus bisa dibatasi ke dana milik sendiri, dan tanggal 31 pada bulan pendek harus jatuh di hari terakhir bulan itu.

### Sinkron di versi native

Spreadsheet yang dipakai **sama persis** dengan versi web: `dompetq-data` di Drive milik pengguna, dengan urutan kolom yang sama (`SkemaSheet.kt` adalah cerminan `SKEMA_SHEET` di [js/sheets.js](js/sheets.js)). Ada unit test yang menjaga urutan kolom itu tidak bergeser.

Login memakai `AuthorizationClient`, bukan alur web — Google memblokir OAuth di WebView dan `GoogleSignIn` lama sudah usang. **Tidak ada client ID di dalam kode Android**: aplikasi dikenali lewat `applicationId` + sidik jari SHA-1 yang didaftarkan di Google Cloud. Scope-nya disamakan dengan web (`drive.file` saja); meminta scope lebih luas di Android akan menghidupkan lagi keharusan verifikasi yang sengaja dihindari.

**OAuth client Android** sudah terdaftar di proyek yang sama (`dompetq-belva-2026`). Android dikenali lewat package + SHA-1, jadi client ID-nya tidak ditulis di kode mana pun — dicatat di sini hanya sebagai rujukan:

| Client | SHA-1 | Client ID |
|---|---|---|
| DompetQ Android (release) | `BC:17:…:0F:3A` | `126487346679-1mdei9o3s7rl7turbsegd1nq4a8rqegq` |
| DompetQ Android (debug) | `AE:E5:…:D7:6A` | `126487346679-tigdc4o6r9mrgb7mg63strj5brqg5g2f` |

Satu client Android hanya menampung **satu** sidik jari, jadi debug dan release memang harus terpisah. Kalau `android/dompetq.keystore` diganti, SHA-1 release berubah dan client-nya harus diperbarui — kalau tidak, login gagal tanpa pesan yang jelas.

Tiga bidang **sengaja tidak ikut sinkron**:

| Bidang | Alasan |
|---|---|
| `jam`, `menit` | Jam alarm itu setelan perangkat; versi web tidak punya alarm sama sekali |
| `kalender_event_id` | Id agenda hanya berlaku di satu HP |

Kalau ketiganya dimasukkan ke skema bersama, versi web akan menuliskannya kosong — ia tidak punya bidang itu — dan pengunduhan berikutnya memindahkan **semua alarm ke pukul 00:00** tanpa suara. Nilai lokalnya dipulihkan oleh `MesinSinkron.satukanPengingat`.

Sheet `pihak` milik versi web tidak pernah disentuh versi native: entitasnya belum ada di sini, dan ikut mengelolanya berarti mengosongkannya setiap kali Android menulis.

Saat dua sisi sama-sama berisi, aplikasi **tidak memilih sendiri** — muncul pilihan Satukan / Pakai Sheets / Pakai HP ini. Menyatukan aman karena transaksi ber-ID unik dan append-only.

**Belum diuji jalan di perangkat.** Kode ini lolos kompilasi, lint, dan unit test, tapi belum pernah dijalankan di HP atau emulator — tidak ada system image yang terpasang di mesin build. Alur layarnya belum terbukti.

### Yang berbeda di dalam APK Capacitor

| | Di browser | Di APK |
|---|---|---|
| Ekspor CSV/JSON | Unduhan browser | Ditulis ke cache lalu dilempar ke lembar berbagi sistem |
| Login Google Sheets | Jalan | **Belum jalan** — Google menolak OAuth di dalam WebView |
| Notifikasi sistem | Selagi aplikasi terbuka | Tidak ada; pengingat jatuh ke kartu dalam aplikasi |
| Huruf Archivo & Manrope | Dari Google Fonts | Perlu internet saat pertama; offline jatuh ke huruf sistem |

Ekspor sudah ditangani di `unduh()` pada [js/app.js](js/app.js) — `<a download>` diabaikan diam-diam oleh WebView Android, jadi di APK berkas ditulis lewat `@capacitor/filesystem` lalu diserahkan ke `@capacitor/share`.

Login Google butuh alur asli (`@codetrix-studio/capacitor-google-auth` atau sejenisnya) dengan OAuth client bertipe **Android** — Google memblokir alur web di WebView tersemat, apa pun origin-nya. Ini pekerjaan tersendiri, belum dikerjakan.

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

Notifikasi browser hanya muncul selagi aplikasi terbuka. Di dalam APK, `Notification` tidak tersedia sama sekali (WebView Android tidak mendukungnya), jadi pengingat jatuh ke kartu di dalam aplikasi — yang memang mekanisme utamanya. Notifikasi sistem yang muncul walau aplikasi tertutup butuh plugin `@capacitor/local-notifications`, belum dipasang.

**Kunci saldo**

Setelah saldo dipastikan benar, nominal rekening bisa dikunci dengan PIN agar tidak berubah tanpa sengaja. PIN disimpan sebagai SHA-256 dari garam + PIN, bukan apa adanya.

Ini **rem, bukan pengaman**. Siapa pun yang paham browser tetap bisa menembusnya — jangan pakai PIN yang sama dengan PIN bank.

Saldo tidak pernah diedit langsung. Kalau angka di aplikasi beda dengan kenyataan, selisihnya dicatat sebagai transaksi penyesuaian sehingga riwayat tetap utuh — selisih itu sendiri sering menandakan ada transaksi yang lupa dicatat.

**Belum** — sengaja ditunda (lihat konsep.md §10)

- Upload bukti transaksi
- Kewajiban, proyeksi 1–3 bulan, target tabungan
- Pengingat terjadwal

## Penyimpanan

**Lokal selalu jadi sumber baca.** Cepat, jalan tanpa internet, dan tidak pernah kehilangan data kalau Google sedang bermasalah.

**Google Sheets dipasang sebagai cermin** — tujuan tulis kedua, bukan pengganti. Gagal menulis ke Sheets tidak pernah menghilangkan transaksi karena salinannya sudah ada di perangkat. Tulis ke Sheets berjalan di latar dan tidak ditunggu; pengguna tidak boleh menunggu jaringan untuk mencatat satu pengeluaran.

Menyambungkan: **Profil → Sambungkan Google Sheets**. Spreadsheet `dompetq-data` dibuat di Drive milik pengguna sendiri.

Sambungannya bertahan antar-sesi. Yang disimpan di perangkat hanya email dan id berkas — **access token tidak pernah disimpan**: umurnya sejam, dan menaruh kredensial di `localStorage` berarti skrip apa pun yang berhasil masuk ke halaman bisa memanennya. Saat aplikasi dibuka, token diminta ulang ke Google tanpa jendela apa pun kalau izinnya masih berlaku; kalau sudah habis, aplikasi kembali ke keadaan "belum tersambung" tanpa pesan galat.

Pemulihan itu membandingkan **id transaksi**, bukan jumlahnya. Kalau Drive tidak memuat apa pun yang belum ada di perangkat, sambungan dipasang diam-diam; kalau perangkat lain lebih maju, datanya diambil; kalau dua perangkat sama-sama mencatat sejak terakhir tersambung, pengguna yang memutuskan — dan sebelum ada keputusan, aplikasi tidak menulis apa pun ke Drive.

Saat menyambung, ada tiga kemungkinan:

| Keadaan | Yang terjadi |
|---|---|
| Sheets masih kosong | Data perangkat diunggah |
| Perangkat masih kosong | Data Sheets diunduh |
| Dua-duanya berisi | Pengguna memilih: pakai Sheets, atau **satukan** |

Menyatukan aman karena transaksi ber-ID unik dan bersifat append-only — tidak ada yang dobel, tidak ada yang hilang. Master data (akun, sumber dana, kategori) tidak digabung otomatis; itu keputusan pengguna.

Spreadsheet lahir dengan 1000 baris dan Google **tidak** memperbesarnya sendiri — menulis melewatinya ditolak. Satu transaksi sehari menyentuh batas itu dalam tiga tahun, jadi jumlah baris diperiksa sebelum tiap tulis dan ditambah 500 sekaligus kalau kurang.

Tetap rutin unduh cadangan JSON dari halaman **Laporan** — itu satu-satunya salinan yang tidak bergantung pada browser maupun Google.

## Google Cloud

| | |
|---|---|
| Proyek | **DompetQ** — `dompetq-belva-2026` |
| Pemilik | belvahector69@gmail.com |
| API yang dipakai | Google Sheets API, Google Drive API — **keduanya harus Enable** |
| Scope | `openid`, `email`, `profile`, `drive.file` |
| OAuth client | `DompetQ Web`, tipe Web application |
| Origin terdaftar | GitHub Pages, `127.0.0.1:8765`, `localhost:8765` |

Client ID ada di [js/config.js](js/config.js) — memang publik, dan aman berada di repo ini.
Client secret **tidak dipakai** oleh aplikasi front-end statis dan tidak boleh masuk repo.

### Kenapa `drive.file` saja

`drive.file` memberi akses penuh — baca dan tulis, lewat Drive API maupun Sheets API — tapi **hanya ke berkas yang dibuat aplikasi ini sendiri**. Berkas lain di Drive pengguna tidak pernah terlihat.

Scope `spreadsheets` sengaja **tidak** dipakai meski namanya terdengar lebih tepat. Ia memberi akses ke *seluruh* spreadsheet milik pengguna, jauh melebihi kebutuhan aplikasi ini, dan Google menggolongkannya **sensitive**: selama scope itu diminta, aplikasi tidak bisa keluar dari mode Testing tanpa lolos verifikasi keamanan. Dengan `drive.file` saja, aplikasi boleh dipublikasikan dan siapa pun bisa masuk.

Konsekuensinya sekali saja: pengguna yang pernah menyambung dengan scope lama harus menyambung ulang.

### Supaya siapa pun bisa masuk

Selama **Publishing status** masih *Testing*, hanya email yang terdaftar sebagai test user yang bisa login — sisanya ditolak Google di layar login, bukan oleh aplikasi. Untuk membukanya:

1. **Google Auth Platform → Data Access** — deklarasikan `openid`, `email`, `profile`, `drive.file`. Scope yang tidak dideklarasikan bisa tidak muncul sebagai kotak centang di layar izin, dan itu membuat login "berhasil" tanpa izin yang dibutuhkan.
2. **Audience → Publish app.** Karena semua scope-nya non-sensitive, tidak ada verifikasi yang perlu diajukan.

### Kalau sinkron gagal

**Profil → Periksa sambungan.** Tombol itu menjalankan rantai yang sama persis dengan yang dipakai saat menyimpan — pustaka, login, izin, Drive API, berkas, baca, tulis — dan berhenti di langkah pertama yang gagal, lengkap dengan balasan mentah dari Google. "Salin laporan" menyalin hasilnya sebagai teks.

Ini ada karena semua penyebab di bawah tampak sama dari luar: satu baris "gagal menyimpan".

| Yang dilaporkan | Penyebabnya | Perbaikannya |
|---|---|---|
| *…API belum diaktifkan di proyek…* | Sheets API atau Drive API mati di Google Cloud | Cloud Console → APIs & Services → Library → Enable |
| *…izin berikut belum dicentang…* | Kotak centang di layar izin Google tidak dicentang | **Minta izin ulang** |
| Layar centang tidak muncul lagi | Google mengingat persetujuan lama yang kurang, lalu menjawab diam-diam dengan izin itu | **Minta izin ulang** — mencabut dulu, jadi Google bertanya dari awal |
| *Sesi Google berakhir* | Token habis; mode Testing membatasi 7 hari | Sambungkan lagi |
| *Baris judul di sheet "…" tidak dikenali* | Baris pertama terhapus saat mengedit langsung di Sheets | Kembalikan baris judul, atau biarkan aplikasi membuat berkas baru |
| *Google menolak isi permintaan: Unable to parse range* | Ada sheet yang dihapus atau diganti namanya | Kembalikan nama sheet-nya |

Izin Google diberikan lewat **kotak centang terpisah yang awalnya kosong**. Menekan "Lanjutkan" tanpa mencentangnya membuat login tetap berhasil — email pengguna muncul seperti biasa — sementara setiap tulisan ke spreadsheet ditolak. Karena itu izin diperiksa ulang tepat sesudah login, bukan dibiarkan gagal jauh kemudian saat menyimpan.

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
