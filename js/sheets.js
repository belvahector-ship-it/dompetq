/* ══════════════════════════════════════════════
   sheets.js — Google Identity Services + Sheets API

   Menyediakan dua hal:
     Google       : login, token, sesi
     SheetsAdapter: adapter penyimpanan dengan antarmuka
                    yang sama persis dengan LocalAdapter
                    (muat / simpan / hapus)

   Pola satu spreadsheet per pengguna, disimpan di Drive
   MILIK PENGGUNA. Pengembang tidak punya akses ke data
   siapa pun. (konsep.md §9.2)
   ══════════════════════════════════════════════ */

const GIS_SRC   = 'https://accounts.google.com/gsi/client';
const API_DRIVE = 'https://www.googleapis.com/drive/v3';
const API_SHEET = 'https://sheets.googleapis.com/v4/spreadsheets';

/* Satu sheet per tabel. Urutan kolom di sini adalah kontraknya —
   menambah kolom harus di BELAKANG, jangan menyisipkan di tengah,
   supaya spreadsheet lama tetap terbaca. */
const SKEMA_SHEET = {
  profil:    ['nama','email','tanggal_mulai','versi_skema',
              'kunci_hash','kunci_garam','saldo_terkunci'],
  akun:      ['id','nama','bank_kode','jenis','is_default','urutan','aktif'],
  kantong:   ['id','nama','jenis','is_default','warna','catatan'],
  kategori:  ['id','nama','tipe','induk_id','ikon'],
  pihak:     ['id','nama','tipe','kontak'],
  transaksi: ['id','timestamp','dibuat_pada','jenis','nominal',
              'akun_id','akun_tujuan_id','kantong_id','kantong_tujuan_id',
              'kategori_id','pihak_id','keterangan','bukti_url','bukti_thumb',
              'reversal_dari'],
  pengingat: ['id','judul','arah','nominal','jadwal_tipe','jadwal_nilai',
              'akun_id','kantong_id','kategori_id','aktif',
              'terakhir_dipenuhi','ditunda_sampai']
};

/* Kolom yang harus kembali jadi boolean/number saat dibaca —
   Sheets mengembalikan semuanya sebagai string. */
const KOLOM_BOOL   = new Set(['is_default','aktif','saldo_terkunci']);
const KOLOM_ANGKA  = new Set(['nominal','urutan','versi_skema','jadwal_nilai']);


/* ══════════ SESI GOOGLE ══════════ */
const Google = {
  token: null,          // { access_token, kedaluwarsa }
  profil: null,         // { email, nama, gambar }
  scopeDiberikan: [],   // izin yang BENAR-BENAR dicentang pengguna
  _tokenClient: null,
  _gisSiap: null,

  /* memuat pustaka GIS sekali saja */
  muatGIS() {
    if (this._gisSiap) return this._gisSiap;
    this._gisSiap = new Promise((selesai, gagal) => {
      if (window.google && google.accounts) return selesai();
      const s = document.createElement('script');
      s.src = GIS_SRC; s.async = true; s.defer = true;
      s.onload = () => selesai();
      s.onerror = () => gagal(new Error(
        'Gagal memuat Google Identity Services. Periksa koneksi internet.'));
      document.head.appendChild(s);
    });
    return this._gisSiap;
  },

  masuk() {
    return this.mintaToken({ prompt: 'consent' });
  },

  /* ── ingatan sesi ──

     Yang disimpan hanya email dan id berkas. Access token TIDAK
     disimpan: umurnya sejam, dan menaruh kredensial di localStorage
     berarti skrip apa pun yang berhasil masuk ke halaman bisa
     memanennya. Token selalu diminta ulang ke Google.

     Tanpa ini, sambungan Sheets putus setiap kali halaman dimuat
     ulang — pengguna harus menekan "Sambungkan" lagi tiap membuka
     aplikasi, dan setiap catatan sebelum itu tidak ikut tersalin. */
  _KUNCI_SESI: 'dompetq:google:v1',

  ingatSesi(fileId) {
    try {
      localStorage.setItem(this._KUNCI_SESI, JSON.stringify({
        email: this.profil ? this.profil.email : '',
        fileId: fileId || null
      }));
    } catch (e) {}
  },

  sesiTersimpan() {
    try { return JSON.parse(localStorage.getItem(this._KUNCI_SESI)); }
    catch (e) { return null; }
  },

  lupakanSesi() {
    try { localStorage.removeItem(this._KUNCI_SESI); } catch (e) {}
  },

  /* Dipanggil saat aplikasi dibuka. Meminta token tanpa mengganggu:
     kalau izinnya masih berlaku, Google memberikannya tanpa satu pun
     jendela muncul. Kalau tidak, kegagalannya ditelan — pengguna
     melihat tombol "Sambungkan" seperti biasa, bukan pesan galat
     untuk sesuatu yang tidak pernah mereka minta. */
  async pulihkan() {
    const sesi = this.sesiTersimpan();
    if (!sesi || !sesi.email) return null;
    try {
      await this.mintaToken({ prompt: '', hint: sesi.email });
      return sesi;
    } catch (e) {
      return null;
    }
  },

  /* Meminta layar izin muncul LAGI, lengkap dengan kotak centangnya.

     Perlu karena Google mengingat persetujuan sebelumnya: kalau
     pengguna dulu melewatkan satu kotak, permintaan berikutnya
     dijawab diam-diam dengan izin lama yang kurang itu — layar
     centangnya tidak pernah muncul lagi, dan kegagalannya terasa
     seperti tidak bisa diperbaiki. Mencabut dulu memaksa Google
     bertanya dari awal. */
  async masukUlang() {
    if (this.token && window.google && google.accounts) {
      await new Promise(r => {
        try { google.accounts.oauth2.revoke(this.token.access_token, r); }
        catch (e) { r(); }
      });
    }
    this.token = null;
    this.scopeDiberikan = [];
    return this.mintaToken({ prompt: 'consent' });
  },

  /* interaktif  : buka popup izin Google
     diam-diam   : perpanjang token tanpa mengganggu (prompt kosong) */
  async mintaToken(opsi) {
    await this.muatGIS();
    opsi = opsi || {};

    return new Promise((selesai, gagal) => {
      if (!this._tokenClient) {
        this._tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE.clientId,
          scope: GOOGLE.scopes,
          callback: () => {}          // diganti tiap permintaan
        });
      }

      this._tokenClient.callback = async (resp) => {
        if (resp.error) {
          return gagal(new Error(pesanOAuth(resp.error)));
        }
        this.token = {
          access_token: resp.access_token,
          /* dikurangi 60 detik supaya tidak pernah memakai token
             yang kedaluwarsa di tengah permintaan */
          kedaluwarsa: Date.now() + (Number(resp.expires_in) - 60) * 1000
        };
        this.scopeDiberikan = (resp.scope || '').split(' ').filter(Boolean);

        /* Diperiksa DI SINI, bukan saat menulis. Kalau izin spreadsheet
           tidak dicentang, kegagalannya muncul jauh kemudian sebagai
           "gagal menyimpan" — pengguna tidak akan pernah menghubungkannya
           dengan kotak centang yang terlewat di layar login. */
        const kurang = this.scopeKurang();
        if (kurang.length) {
          this.token = null;
          return gagal(new Error(pesanScopeKurang(kurang)));
        }

        try {
          await this.ambilProfil();
          /* Diingat begitu login berhasil, TIDAK menunggu berkasnya ada.
             Kalau tulisan pertama gagal — berkas belum terbuat — sesinya
             tetap harus bertahan, kalau tidak pengguna kehilangan
             sambungannya setiap kali halaman dimuat ulang justru pada saat
             sedang membereskan kegagalan itu. */
          const lama = this.sesiTersimpan();
          this.ingatSesi(lama && lama.fileId);
          selesai(this.token);
        } catch (e) { gagal(e); }
      };

      try {
        const minta = { prompt: opsi.prompt || '' };
        /* Menunjuk akun yang dulu dipakai, supaya perpanjangan diam-diam
           tidak berhenti di layar "pilih akun" pada pengguna yang punya
           beberapa akun Google. */
        if (opsi.hint) minta.hint = opsi.hint;
        this._tokenClient.requestAccessToken(minta);
      } catch (e) {
        gagal(new Error('Popup Google tidak bisa dibuka. Izinkan popup untuk situs ini.'));
      }
    });
  },

  masukSudah() {
    return !!(this.token && Date.now() < this.token.kedaluwarsa);
  },

  /* Izin wajib yang tidak dicentang pengguna di layar persetujuan. */
  scopeKurang() {
    return GOOGLE.scopeWajib.filter(s => this.scopeDiberikan.indexOf(s) === -1);
  },

  /* Dipanggil sebelum tiap permintaan API. Kalau token hampir habis,
     perpanjang diam-diam supaya pengguna tidak kehilangan input.
     (konsep.md §11 — token kedaluwarsa saat input) */
  async tokenValid() {
    if (this.masukSudah()) return this.token.access_token;
    await this.mintaToken({ prompt: '' });
    return this.token.access_token;
  },

  async ambilProfil() {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + this.token.access_token }
    });
    if (!r.ok) throw new Error('Gagal membaca identitas akun Google.');
    const j = await r.json();
    this.profil = { email: j.email, nama: j.name || '', gambar: j.picture || '' };
    return this.profil;
  },

  keluar() {
    if (this.token && window.google && google.accounts)
      google.accounts.oauth2.revoke(this.token.access_token, () => {});
    this.token = null;
    this.profil = null;
    this.scopeDiberikan = [];
    this.lupakanSesi();
  },

  /* pembungkus fetch: selalu pakai token segar, terjemahkan error.

     Mencoba ulang untuk kegagalan yang memang sementara (kuota per menit,
     server Google sedang goyah). Kegagalan konfigurasi — API belum aktif,
     izin kurang — TIDAK diulang: mengulanginya hanya menunda pesan yang
     justru perlu dibaca pengguna. */
  async api(url, opsi, percobaan) {
    percobaan = percobaan || 0;
    const t = await this.tokenValid();
    opsi = opsi || {};

    let r;
    try {
      r = await fetch(url, Object.assign({}, opsi, {
        headers: Object.assign({
          Authorization: 'Bearer ' + t,
          'Content-Type': 'application/json'
        }, opsi.headers || {})
      }));
    } catch (e) {
      /* fetch hanya melempar kalau jaringan benar-benar gagal —
         offline, DNS, atau CORS. */
      throw galatGoogle('Tidak ada koneksi ke Google. Data tetap tersimpan di perangkat.',
                        { jaringan: true });
    }

    if (!r.ok) {
      let err = {};
      try { err = (await r.json()).error || {}; } catch (e) {}

      const bolehUlang = (r.status === 429 || r.status >= 500);
      if (bolehUlang && percobaan < 3) {
        await jeda(500 * Math.pow(2, percobaan));   // 0,5s → 1s → 2s
        return this.api(url, opsi, percobaan + 1);
      }

      throw galatGoogle(pesanHTTP(r.status, err), {
        status: r.status,
        alasan: alasanGoogle(err),
        detail: err.message || '',
        url: url
      });
    }
    return r.status === 204 ? null : r.json();
  }
};

function jeda(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Error yang membawa serta keterangan mentah dari Google. Panel
   "Periksa sambungan" menampilkan keterangan itu apa adanya — pesan
   yang sudah diterjemahkan bagus untuk pengguna, tapi yang mentah
   itulah yang bisa dicari di internet kalau macetnya tidak biasa. */
function galatGoogle(pesan, info) {
  const e = new Error(pesan);
  Object.assign(e, info || {});
  return e;
}

/* Google menaruh sebab sebenarnya di beberapa tempat berbeda
   tergantung API-nya. Semuanya diperiksa. */
function alasanGoogle(err) {
  /* Yang paling spesifik menang. `status` selalu ada dan selalu kasar
     ("PERMISSION_DENIED" bisa berarti API mati, izin kurang, atau
     berkas milik orang lain), jadi ia diperiksa paling akhir —
     kalau tidak, ia menutupi sebab sebenarnya yang ada di `details`. */
  const d = (err.details || []).find(x => x.reason);
  if (d) return d.reason;                                  // mis. SERVICE_DISABLED
  const e = (err.errors || []).find(x => x.reason);
  if (e) return e.reason;
  return err.status || '';                                 // mis. PERMISSION_DENIED
}

function pesanOAuth(kode) {
  const peta = {
    popup_closed_by_user: 'Jendela login ditutup sebelum selesai.',
    access_denied: 'Izin ditolak. Aplikasi tidak bisa membuka spreadsheet tanpa izin itu.',
    popup_failed_to_open: 'Popup diblokir browser. Izinkan popup untuk situs ini.',
    idpiframe_initialization_failed: 'Browser memblokir cookie pihak ketiga. Izinkan cookie untuk accounts.google.com.'
  };
  return peta[kode] || ('Login Google gagal: ' + kode);
}

/* Nama izin dalam bahasa yang sama dengan yang dilihat pengguna
   di layar persetujuan Google — supaya mereka tahu kotak mana
   yang harus dicentang saat mengulang. */
const NAMA_SCOPE = {
  'https://www.googleapis.com/auth/drive.file':
    'Melihat, mengedit, membuat, dan menghapus file Google Drive tertentu yang Anda gunakan dengan aplikasi ini'
};

function pesanScopeKurang(kurang) {
  const daftar = kurang.map(s => '• ' + (NAMA_SCOPE[s] || s)).join('\n');
  return 'Login berhasil, tapi izin berikut belum dicentang:\n\n' + daftar +
         '\n\nDi layar izin Google, kotak centangnya terpisah dan ' +
         'awalnya kosong. Coba sambungkan lagi, lalu centang semuanya ' +
         'sebelum menekan "Lanjutkan".';
}

function pesanHTTP(status, err) {
  const detail = (err && err.message) || '';
  const alasan = alasanGoogle(err || {});

  /* Penyebab tersering waktu pertama kali memasang: API-nya sendiri
     belum dinyalakan di Google Cloud. Pesan bawaan Google panjang dan
     berbahasa Inggris, jadi diringkas — tapi tautan aktivasinya yang
     ada di dalamnya dipertahankan karena itu yang menyelesaikannya. */
  if (alasan === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(detail)) {
    const api = /sheets/i.test(detail) ? 'Google Sheets API'
              : /drive/i.test(detail)  ? 'Google Drive API'
              : 'Google API';
    return api + ' belum diaktifkan di proyek ' + GOOGLE.projectId + '. ' +
           'Buka Google Cloud Console → APIs & Services → Library, ' +
           'cari "' + api + '", lalu tekan Enable.';
  }

  if (alasan === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
      alasan === 'insufficientPermissions')
    return 'Izin yang diberikan kurang. Putuskan sambungan, lalu sambungkan ' +
           'lagi dan centang semua kotak izin di layar Google.';

  if (alasan === 'ACCESS_TOKEN_EXPIRED' || status === 401)
    return 'Sesi Google berakhir. Sambungkan lagi.';

  if (status === 403) {
    if (/quota|rate|limit/i.test(detail) || alasan === 'RATE_LIMIT_EXCEEDED')
      return 'Kuota Google API tercapai. Coba lagi beberapa saat lagi.';
    if (/billing/i.test(detail))
      return 'Proyek Google Cloud butuh akun penagihan aktif.';
    return 'Google menolak akses' + (detail ? ': ' + detail : '.');
  }

  if (status === 404) return 'Spreadsheet tidak ditemukan. Mungkin sudah dihapus dari Drive.';
  if (status === 400) return 'Google menolak isi permintaan' + (detail ? ': ' + detail : '.');
  if (status === 429) return 'Terlalu banyak permintaan ke Google. Sudah dicoba ulang tapi masih penuh.';
  if (status >= 500)  return 'Server Google sedang bermasalah. Data disimpan lokal dulu.';
  return 'Gagal menghubungi Google (' + status + ')' + (detail ? ': ' + detail : '');
}


/* ══════════ ADAPTER ══════════ */
const SheetsAdapter = {
  nama: 'sheets',
  fileId: null,
  galatTerakhir: null,         // Error terakhir, lengkap dengan keterangan mentah
  _antre: Promise.resolve(),   // tulis diserialkan, tidak pernah tumpang tindih

  /* ── mencari / membuat berkas ── */

  /* drive.file hanya melihat berkas yang DIBUAT aplikasi ini,
     jadi pencarian ini tidak pernah menyentuh berkas lain
     milik pengguna. */
  async cariBerkas() {
    /* Id yang sudah dikenal dipakai langsung — menghemat satu
       permintaan Drive tiap kali aplikasi dibuka. */
    const sesi = Google.sesiTersimpan();
    if (sesi && sesi.fileId) return sesi.fileId;

    const q = encodeURIComponent(
      `name='${GOOGLE.namaBerkas}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const j = await Google.api(
      `${API_DRIVE}/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);

    const id = (j.files && j.files[0]) ? j.files[0].id : null;
    if (id) Google.ingatSesi(id);
    return id;
  },

  async buatBerkas() {
    const j = await Google.api(API_SHEET, {
      method: 'POST',
      body: JSON.stringify({
        /* Locale sengaja TIDAK diisi. Sheets menolak 'id_ID' dengan
           "Unsupported locale" — daftar locale-nya mengikuti gaya Java,
           dan kode Java untuk bahasa Indonesia adalah 'in', bukan 'id'.
           Menebak-nebak kode yang benar tidak sepadan: kalau dikosongkan,
           Google memakai locale akun penggunanya sendiri, yang untuk
           pengguna Indonesia justru sudah tepat. */
        properties: { title: GOOGLE.namaBerkas },
        sheets: Object.keys(SKEMA_SHEET).map((nama, i) => ({
          properties: { title: nama, index: i }
        }))
      })
    });
    this.fileId = j.spreadsheetId;
    this._kapasitas = null;
    await this.tulisHeader();
    Google.ingatSesi(this.fileId);
    return this.fileId;
  },

  async tulisHeader() {
    const data = Object.keys(SKEMA_SHEET).map(nama => ({
      range: `${nama}!A1`,
      values: [SKEMA_SHEET[nama]]
    }));
    await Google.api(`${API_SHEET}/${this.fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    });
  },

  /* ── baca ── */

  /* Id berkas yang diingat bisa basi — pengguna berhak menghapus
     spreadsheet-nya dari Drive kapan pun, dan aplikasi tidak diberi
     tahu. Sekali 404, ingatannya dibuang dan pencarian diulang;
     kalau memang sudah tidak ada, berkas baru dibuat. */
  async _dengan404(fn) {
    try {
      return await fn();
    } catch (e) {
      if (e.status !== 404 || !this.fileId) throw e;
      this.fileId = null;
      this._kapasitas = null;
      Google.ingatSesi(null);
      return fn();
    }
  },

  async muat() {
    if (!Google.masukSudah()) return null;
    return this._dengan404(() => this._muat());
  },

  async _muat() {
    if (!this.fileId) this.fileId = await this.cariBerkas();
    if (!this.fileId) return null;              // pengguna baru → belum ada berkas

    const nama = Object.keys(SKEMA_SHEET);
    const rentang = nama.map(n => `ranges=${encodeURIComponent(n + '!A1:Z')}`).join('&');
    const j = await Google.api(
      `${API_SHEET}/${this.fileId}/values:batchGet?${rentang}&majorDimension=ROWS`);

    const db = dbKosong();
    (j.valueRanges || []).forEach((vr, i) => {
      const sheet = nama[i];
      const baris = vr.values || [];
      if (baris.length < 2) return;             // hanya header, belum ada isi

      const header = baris[0];

      /* Baris pertama dipakai sebagai nama kolom. Kalau pengguna
         menghapusnya lewat Sheets, baris pertama DATA yang naik jadi
         header — dan seluruh isi sheet terbaca dengan nama kolom
         ngawur tanpa satu pun error. Diperiksa di sini karena
         validasiSkema hanya melihat bentuk larik, bukan isi. */
      if (!header.some(k => SKEMA_SHEET[sheet].indexOf(k) !== -1)) {
        throw galatGoogle(
          'Baris judul di sheet "' + sheet + '" tidak dikenali. ' +
          'Kolom yang seharusnya ada: ' + SKEMA_SHEET[sheet].join(', ') + '. ' +
          'Kemungkinan baris pertama terhapus saat mengedit langsung di Sheets.',
          { rusak: true, sheet: sheet, fileId: this.fileId });
      }

      const isi = baris.slice(1).map(r => barisKeObjek(header, r));

      if (sheet === 'profil') {
        Object.assign(db.profil, isi[0] || {});
        db.versi_skema = Number(db.profil.versi_skema) || SKEMA_VERSI;
        delete db.profil.versi_skema;
      } else {
        db[sheet] = isi;
      }
    });

    /* Berkasnya ADA tapi isinya tidak terbaca — biasanya karena
       pengguna mengedit langsung di Sheets dan menghapus satu sheet
       atau menggeser kolom.

       Ini WAJIB dilempar, bukan dikembalikan null. Null berarti
       "belum ada data di Drive", dan logika sinkron akan menimpa
       spreadsheet itu dengan data perangkat — menghapus catatan yang
       sebenarnya masih ada di sana. */
    if (!validasiSkema(db)) {
      throw galatGoogle(
        'Spreadsheet ditemukan tapi strukturnya tidak dikenali. ' +
        'Sheet wajib: ' + Object.keys(SKEMA_SHEET).join(', ') + '. ' +
        'Buka spreadsheet-nya di Drive dan periksa apakah ada sheet ' +
        'yang terhapus atau berganti nama.',
        { rusak: true, fileId: this.fileId });
    }
    return lengkapiSkema(db);
  },

  /* ── tulis ── */

  /* Menulis ulang seluruh isi. Sederhana dan selalu konsisten;
     yang menjaga performanya adalah pemanggil, bukan di sini —
     Store.simpan() sudah menggabungkan tulisan beruntun.

     Permintaan tulis diserialkan lewat antrean supaya dua simpan
     yang berdekatan tidak saling menimpa. */
  simpan(db) {
    this._antre = this._antre
      .then(() => this._tulis(db))
      .then(ok => { if (ok) this.galatTerakhir = null; return ok; })
      .catch(e => {
        /* Sebabnya DISIMPAN, bukan cuma dicatat ke console. Sebelum ini
           pemanggil hanya menerima `false` dan menampilkan "Gagal menulis
           ke Google Sheets" — kalimat yang tidak memberi tahu siapa pun
           apa yang harus diperbaiki. */
        console.error('Gagal menulis ke Sheets:', e);
        this.galatTerakhir = e;
        return false;
      });
    return this._antre;
  },

  _tulis(db) {
    return this._dengan404(() => this._tulisSekali(db));
  },

  async _tulisSekali(db) {
    if (!Google.masukSudah() && !(await Google.tokenValid())) return false;
    if (!this.fileId) {
      this.fileId = (await this.cariBerkas()) || (await this.buatBerkas());
    }

    const data = [];
    for (const sheet in SKEMA_SHEET) {
      const kolom = SKEMA_SHEET[sheet];
      let baris;

      if (sheet === 'profil') {
        const p = Object.assign({}, db.profil, { versi_skema: db.versi_skema || SKEMA_VERSI });
        baris = [objekKeBaris(kolom, p)];
      } else {
        baris = (db[sheet] || []).map(o => objekKeBaris(kolom, o));
      }

      data.push({ range: `${sheet}!A1`, values: [kolom].concat(baris) });
    }

    await this.pastikanKapasitas(db);

    /* Bersihkan dulu, kalau tidak baris lama yang sudah dihapus
       akan tertinggal di bawah data baru. */
    await Google.api(`${API_SHEET}/${this.fileId}/values:batchClear`, {
      method: 'POST',
      body: JSON.stringify({ ranges: Object.keys(SKEMA_SHEET).map(n => `${n}!A1:Z`) })
    });

    await Google.api(`${API_SHEET}/${this.fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    });

    return true;
  },

  /* Spreadsheet baru lahir dengan 1000 baris. Menulis melewati batas
     itu ditolak Google dengan "exceeds grid limits" — bukan diperbesar
     otomatis.

     Untuk pencatat keuangan, 1000 baris bukan angka teoretis: satu
     transaksi sehari sudah menyentuhnya dalam tiga tahun. Setelah itu
     setiap simpan gagal, dan gagalnya di tengah jalan — data lokal
     terus bertambah sementara Sheets berhenti ikut. */
  _kapasitas: null,

  async pastikanKapasitas(db) {
    const butuh = {};
    let perlu = false;

    for (const sheet in SKEMA_SHEET) {
      /* +1 untuk baris header */
      const n = (sheet === 'profil' ? 1 : (db[sheet] || []).length) + 1;
      butuh[sheet] = n;
      if (!this._kapasitas || (this._kapasitas[sheet] || 0) < n) perlu = true;
    }
    /* Selama masih muat, tidak ada permintaan tambahan sama sekali. */
    if (!perlu) return;

    const j = await Google.api(`${API_SHEET}/${this.fileId}?fields=` +
      encodeURIComponent('sheets(properties(sheetId,title,gridProperties/rowCount))'));

    const kap = {}, minta = [];
    (j.sheets || []).forEach(s => {
      const p = s.properties;
      const punya = (p.gridProperties && p.gridProperties.rowCount) || 0;
      kap[p.title] = punya;

      const n = butuh[p.title];
      if (n && n > punya) {
        /* Dilebihkan 500 baris supaya penambahan berikutnya tidak
           terjadi tiap kali satu transaksi masuk. */
        const tambah = (n - punya) + 500;
        minta.push({ appendDimension: {
          sheetId: p.sheetId, dimension: 'ROWS', length: tambah } });
        kap[p.title] = punya + tambah;
      }
    });

    if (minta.length) {
      await Google.api(`${API_SHEET}/${this.fileId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests: minta })
      });
    }
    this._kapasitas = kap;
  },

  /* Tidak menghapus berkas pengguna — hanya melepas kaitannya.
     Menghapus data keuangan orang dari Drive-nya bukan wewenang
     aplikasi ini; kalau mau dihapus, pengguna melakukannya sendiri. */
  async hapus() {
    this.fileId = null;
    this._kapasitas = null;
    this.galatTerakhir = null;
  },

  /* tautan supaya pengguna bisa membuka spreadsheet-nya sendiri */
  tautan() {
    return this.fileId
      ? `https://docs.google.com/spreadsheets/d/${this.fileId}/edit`
      : null;
  },

  /* ── periksa sambungan ──

     Menjalankan rantai yang sama persis dengan yang dipakai saat
     menyimpan, satu langkah demi satu langkah, dan berhenti di
     langkah pertama yang gagal.

     Alasannya: "gagal menyambungkan" bisa berarti tujuh hal berbeda —
     API belum aktif, izin kurang, popup diblokir, origin belum
     terdaftar, kuota habis, berkas terhapus, struktur sheet rusak —
     dan semuanya tampak sama dari luar. Menebaknya satu per satu
     memakan waktu berjam-jam. Ini menunjuk langsung yang mana.

     Langkah tulisnya menulis ulang baris header dengan isi yang sama,
     jadi aman dijalankan kapan pun: tidak ada data pengguna yang
     berubah. */
  async diagnosa() {
    const hasil = [];
    const langkah = async (nama, fn) => {
      /* Sekali ada yang gagal, sisanya dilewati — langkah berikutnya
         pasti ikut gagal dan hanya menambah bising. */
      if (hasil.some(h => !h.ok)) {
        hasil.push({ nama, ok: null, pesan: 'dilewati' });
        return null;
      }
      try {
        const nilai = await fn();
        hasil.push({ nama, ok: true, pesan: (nilai && nilai.pesan) || 'baik' });
        return nilai;
      } catch (e) {
        hasil.push({
          nama, ok: false,
          pesan: e.message,
          mentah: [e.status && ('HTTP ' + e.status), e.alasan, e.detail]
                    .filter(Boolean).join(' · ')
        });
        return null;
      }
    };

    await langkah('Pustaka Google', async () => {
      await Google.muatGIS();
      return { pesan: 'termuat' };
    });

    await langkah('Sesi login', async () => {
      /* Kalau belum pernah menyetujui apa pun, perpanjangan diam-diam
         pasti gagal — yang dibutuhkan justru layar izin yang penuh. */
      if (Google.scopeDiberikan.length) await Google.tokenValid();
      else                              await Google.masuk();
      return { pesan: (Google.profil && Google.profil.email) || 'aktif' };
    });

    await langkah('Izin akses', async () => {
      const kurang = Google.scopeKurang();
      if (kurang.length) throw new Error(pesanScopeKurang(kurang));
      return { pesan: 'lengkap' };
    });

    await langkah('Google Drive API', async () => {
      this.fileId = await this.cariBerkas();
      return { pesan: this.fileId ? 'berkas ditemukan' : 'berkas belum ada' };
    });

    await langkah('Berkas spreadsheet', async () => {
      if (!this.fileId) {
        await this.buatBerkas();
        return { pesan: 'baru dibuat' };
      }
      return { pesan: this.fileId };
    });

    await langkah('Google Sheets API — baca', async () => {
      const j = await Google.api(
        `${API_SHEET}/${this.fileId}/values:batchGet` +
        `?ranges=${encodeURIComponent('profil!A1:Z1')}`);
      const ada = j.valueRanges && j.valueRanges[0] && j.valueRanges[0].values;
      return { pesan: ada ? 'terbaca' : 'kosong (belum ada isi)' };
    });

    await langkah('Google Sheets API — tulis', async () => {
      await this.tulisHeader();      // idempoten: isinya sama dengan sebelumnya
      return { pesan: 'berhasil' };
    });

    return hasil;
  }
};


/* ══════════ KONVERSI BARIS ↔ OBJEK ══════════ */

function barisKeObjek(header, baris) {
  const o = {};
  header.forEach((k, i) => {
    let v = baris[i];
    if (v === undefined) v = '';
    if (KOLOM_BOOL.has(k))       o[k] = (v === true || v === 'TRUE' || v === 'true' || v === '1');
    else if (KOLOM_ANGKA.has(k)) o[k] = Number(v) || 0;
    else                         o[k] = String(v);
  });
  return o;
}

function objekKeBaris(kolom, obj) {
  return kolom.map(k => {
    const v = obj ? obj[k] : '';
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return v;
  });
}


/* ══════════ SINKRON ══════════ */

/* Menyatukan data lokal dengan data di Sheets saat pengguna
   pertama kali menyambungkan akun.

   Transaksi bersifat append-only dan ber-ID unik, jadi
   penggabungan aman: ambil gabungan keduanya berdasarkan id.
   Master data (akun, kantong, kategori) TIDAK digabung — kalau
   dua sisi sama-sama berisi, pengguna yang memutuskan. */
const Sinkron = {
  gabung(lokal, jauh) {
    if (!jauh)  return { db: lokal, cara: 'unggah' };
    if (!lokal) return { db: jauh,  cara: 'unduh'  };

    const adaLokal = (lokal.transaksi || []).length;
    const adaJauh  = (jauh.transaksi  || []).length;

    if (!adaJauh)  return { db: lokal, cara: 'unggah' };
    if (!adaLokal) return { db: jauh,  cara: 'unduh'  };

    return { db: null, cara: 'bentrok', lokal, jauh };
  },

  /* Perbandingan untuk sambungan yang DIPULIHKAN sendiri saat aplikasi
     dibuka. Tidak boleh memakai gabung() di atas: gabung() menyatakan
     "bentrok" begitu kedua sisi sama-sama berisi, dan pada pemulihan
     biasa kedua sisi memang berisi hal yang sama persis — pengguna
     akan ditanya setiap kali membuka aplikasi tanpa alasan.

     Yang menentukan di sini bukan jumlah, tapi id mana yang dimiliki
     siapa. Transaksi ber-id unik dan append-only, jadi hubungan
     keduanya bisa dibaca pasti. */
  bandingkan(lokal, jauh) {
    if (!jauh)  return 'unggah';
    if (!lokal) return 'unduh';

    const idL = new Set((lokal.transaksi || []).map(t => t.id));
    const idJ = new Set((jauh.transaksi  || []).map(t => t.id));

    let hanyaL = false, hanyaJ = false;
    idL.forEach(id => { if (!idJ.has(id)) hanyaL = true; });
    idJ.forEach(id => { if (!idL.has(id)) hanyaJ = true; });

    if (hanyaL && hanyaJ) return 'bentrok';   // dua perangkat sama-sama mencatat
    if (hanyaJ)           return 'unduh';     // perangkat lain lebih baru
    return 'unggah';                          // sama, atau perangkat ini lebih baru
  },

  /* Menggabungkan transaksi dari dua sumber tanpa duplikat. */
  satukanTransaksi(a, b) {
    const peta = new Map();
    (a || []).forEach(t => peta.set(t.id, t));
    (b || []).forEach(t => { if (!peta.has(t.id)) peta.set(t.id, t); });
    return Array.from(peta.values())
      .sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
  }
};
