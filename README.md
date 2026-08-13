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

**Belum** — sengaja ditunda (lihat konsep.md §10)

- Login Google & sinkron ke Google Sheets
- Upload bukti transaksi
- Kewajiban, proyeksi 1–3 bulan, target tabungan
- Pengingat terjadwal
- Bungkus APK

## Penyimpanan

Sekarang di `localStorage` browser — **hanya di perangkat itu**. Hapus riwayat browser = data hilang.
Rutin unduh cadangan dari halaman **Laporan → Unduh cadangan data (JSON)**.

Semua akses data lewat `Store` di [js/store.js](js/store.js), yang memakai adapter. Pindah ke Google Sheets nanti = menambah `SheetsAdapter` dengan antarmuka yang sama (`muat`, `simpan`, `hapus`). Tidak ada kode lain yang perlu berubah.

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
js/calc.js        semua perhitungan saldo (matriks akun × sumber dana)
js/ui.js          format rupiah/tanggal, modal, toast
js/app.js         routing, onboarding, layar
```

Aturan penting: **saldo akun dan saldo sumber dana tidak pernah dihitung terpisah.** Keduanya turunan dari satu matriks di `Calc.matriks()`, supaya tidak mungkin saling bertentangan.

## Data uji

Aplikasi berisi data contoh dari sesi pengujian. Sebelum dipakai sungguhan:
**Profil → Hapus semua data**, lalu onboarding ulang dengan angka asli.
