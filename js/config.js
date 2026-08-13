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

const GOOGLE = {
  /* Proyek: DompetQ (dompetq-belva-2026)
     Pemilik: belvahector69@gmail.com */
  clientId: '126487346679-vchjia1p4squhh1vjimvk2sd8n4atvje.apps.googleusercontent.com',

  /* Scope paling sempit yang memungkinkan pola satu
     spreadsheet per pengguna di Drive-nya sendiri.
     drive.file hanya memberi akses ke file yang DIBUAT
     aplikasi ini — bukan seluruh Drive. (konsep.md §9.2) */
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'
  ].join(' '),

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
