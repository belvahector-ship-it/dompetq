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

const VERSI_APP  = '1.0.0';
const TAHAP_APP  = 'beta';
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
    'https://belvahector-ship-it.github.io',
    'http://127.0.0.1:8765',
    'http://localhost:8765'
  ]
};
