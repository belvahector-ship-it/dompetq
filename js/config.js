/* ══════════════════════════════════════════════
   config.js — konfigurasi Google Cloud

   Client ID aplikasi web memang bersifat publik: ia
   selalu terlihat di source halaman mana pun yang
   memakainya. Aman berada di repo publik.

   Client secret TIDAK dipakai sama sekali oleh aplikasi
   ini dan TIDAK BOLEH ditulis di sini. Alur Google
   Identity Services untuk front-end statis tidak
   memerlukannya — pengamanan sesungguhnya ada pada
   daftar Authorized JavaScript origins di bawah.
   ══════════════════════════════════════════════ */

const VERSI_APP  = '1.3.0';
const TAHAP_APP  = 'beta';
/* Catatan perubahan — terbaru di atas. Ditampilkan saat versi di footer
   ditekan. Tiap rilis baru: tambah satu entri di paling atas. */
const CHANGELOG = [
  { versi:'1.3.0', tanggal:'5 Okt 2026', butir:[
    'Tab Transaksi kini hanya menampilkan transaksi hari ini, jadi halamannya tidak lagi panjang.',
    'Baru: pilih periode riwayat — kemarin, 7 hari terakhir, bulan ini, bulan lalu, semua riwayat, atau rentang tanggal sendiri.',
    'Daftar menampilkan 10 baris pertama; kalau lebih, gulir ke bawah di dalam daftarnya.',
    'Kotak cari tetap menelusuri seluruh riwayat, apa pun periode yang dipilih.'
  ]},
  { versi:'1.2.0', tanggal:'5 Okt 2026', butir:[
    'Baru: ketuk nomor versi di bagian bawah layar untuk melihat catatan perubahan ini.'
  ]},
  { versi:'1.1.1', tanggal:'5 Okt 2026', butir:[
    'Perbaikan: garis panjang (sumbu) pada candle dihapus karena menampilkan lonjakan saldo yang tidak pernah terjadi.',
    'Perbaikan: daftar transaksi tidak lagi ikut hilang kalau grafik gagal digambar.',
    'Berkas aplikasi kini dimuat dengan nomor versi, jadi pembaruan langsung terpakai tanpa perlu hapus cache.'
  ]},
  { versi:'1.1.0', tanggal:'5 Okt 2026', butir:[
    'Baru: grafik candle untung/rugi di tab Transaksi, per hari (satu bulan penuh) atau per bulan (satu tahun penuh).',
    'Tiap candle menunjukkan saldo total dari 00.00 sampai 00.00; geser untuk melihat 7 periode lain sekaligus.',
    'Ketuk candle untuk melihat saldo awal, akhir, dan selisih tiap rekening dan sumber dana.',
    'Pilih bulan atau tahun dengan tombol panah; skala mengikuti candle yang terlihat.'
  ]},
  { versi:'1.0.0', tanggal:'Agu 2026', butir:[
    'Rilis awal: catat pemasukan, pengeluaran, dan pindah dana antar rekening dan sumber dana (pribadi/titipan).',
    'Sinkron ke Google Sheets, pengingat, piutang, dan dana talangan.'
  ]}
];

const KREDIT_APP = 'ibstudio.my.id';
const KREDIT_URL = 'https://ibstudio.my.id';

const GOOGLE = {
  /* Proyek: DompetQ (dompetq-belva-2026)
     Pemilik: belvahector69@gmail.com */
  clientId: '126487346679-vchjia1p4squhh1vjimvk2sd8n4atvje.apps.googleusercontent.com',

  /* SATU scope saja untuk data: drive.file.

     Ia memberi akses penuh — baca dan tulis, lewat Drive API maupun
     Sheets API — tapi HANYA ke berkas yang dibuat aplikasi ini
     sendiri. Berkas lain di Drive pengguna tidak pernah terlihat.
     (konsep.md §9.2)

     `spreadsheets` sengaja TIDAK dipakai meski terdengar lebih tepat.
     Scope itu memberi akses ke SELURUH spreadsheet milik pengguna —
     jauh lebih luas daripada yang dibutuhkan aplikasi ini — dan
     Google menggolongkannya sensitive: memakainya berarti aplikasi
     tidak bisa keluar dari mode Testing tanpa lolos verifikasi
     keamanan. Dengan drive.file saja, aplikasi boleh dipublikasikan
     dan siapa pun bisa masuk. */
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.file'
  ].join(' '),

  /* Izin yang menentukan aplikasi bisa bekerja atau tidak. Google
     memberi centang TERPISAH untuk tiap izin dan kotaknya mulai
     kosong: pengguna bisa menekan "Lanjutkan" tanpa mencentangnya.
     Login tetap berhasil dan email tetap muncul — tapi setiap
     tulisan ke spreadsheet ditolak 403. Karena itu diperiksa ulang
     tepat sesudah login. */
  scopeWajib: [
    'https://www.googleapis.com/auth/drive.file'
  ],

  /* Dipakai pesan galat supaya pengguna tahu API mana yang harus
     diaktifkan, tanpa harus menebak nama proyeknya. */
  projectId: 'dompetq-belva-2026',

  /* Nama file spreadsheet yang dicari/dibuat di Drive pengguna */
  namaBerkas: 'dompetq-data',

  /* Origin yang terdaftar di Google Cloud. Menambah domain
     baru (mis. domain kustom) harus didaftarkan di sana dulu,
     kalau tidak login akan ditolak dengan origin_mismatch. */
  originTerdaftar: [
    'https://dompetq.my.id',
    'https://www.dompetq.my.id',
    'https://belvahector-ship-it.github.io',
    'http://127.0.0.1:8765',
    'http://localhost:8765'
  ]
};
