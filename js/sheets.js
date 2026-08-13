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
        try {
          await this.ambilProfil();
          selesai(this.token);
        } catch (e) { gagal(e); }
      };

      try {
        this._tokenClient.requestAccessToken({ prompt: opsi.prompt || '' });
      } catch (e) {
        gagal(new Error('Popup Google tidak bisa dibuka. Izinkan popup untuk situs ini.'));
      }
    });
  },

  masukSudah() {
    return !!(this.token && Date.now() < this.token.kedaluwarsa);
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
  },

  /* pembungkus fetch: selalu pakai token segar, terjemahkan error */
  async api(url, opsi) {
    const t = await this.tokenValid();
    opsi = opsi || {};
    const r = await fetch(url, Object.assign({}, opsi, {
      headers: Object.assign({
        Authorization: 'Bearer ' + t,
        'Content-Type': 'application/json'
      }, opsi.headers || {})
    }));

    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).error.message; } catch (e) {}
      throw new Error(pesanHTTP(r.status, detail));
    }
    return r.status === 204 ? null : r.json();
  }
};

function pesanOAuth(kode) {
  const peta = {
    popup_closed_by_user: 'Jendela login ditutup sebelum selesai.',
    access_denied: 'Izin ditolak. Aplikasi tidak bisa membuka spreadsheet tanpa izin itu.',
    popup_failed_to_open: 'Popup diblokir browser. Izinkan popup untuk situs ini.'
  };
  return peta[kode] || ('Login Google gagal: ' + kode);
}

function pesanHTTP(status, detail) {
  if (status === 401) return 'Sesi Google berakhir. Coba masuk lagi.';
  if (status === 403) {
    if (/quota|rate/i.test(detail)) return 'Kuota Google API tercapai. Coba lagi beberapa saat lagi.';
    return 'Google menolak akses. Pastikan izin spreadsheet & Drive diberikan.';
  }
  if (status === 404) return 'Spreadsheet tidak ditemukan. Mungkin sudah dihapus dari Drive.';
  if (status === 429) return 'Terlalu banyak permintaan ke Google. Menunggu sebentar.';
  if (status >= 500)  return 'Server Google sedang bermasalah. Data disimpan lokal dulu.';
  return 'Gagal menghubungi Google (' + status + ')' + (detail ? ': ' + detail : '');
}


/* ══════════ ADAPTER ══════════ */
const SheetsAdapter = {
  nama: 'sheets',
  fileId: null,
  _antre: Promise.resolve(),   // tulis diserialkan, tidak pernah tumpang tindih

  /* ── mencari / membuat berkas ── */

  /* drive.file hanya melihat berkas yang DIBUAT aplikasi ini,
     jadi pencarian ini tidak pernah menyentuh berkas lain
     milik pengguna. */
  async cariBerkas() {
    const q = encodeURIComponent(
      `name='${GOOGLE.namaBerkas}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const j = await Google.api(
      `${API_DRIVE}/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
    return (j.files && j.files[0]) ? j.files[0].id : null;
  },

  async buatBerkas() {
    const j = await Google.api(API_SHEET, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: GOOGLE.namaBerkas, locale: 'id_ID' },
        sheets: Object.keys(SKEMA_SHEET).map((nama, i) => ({
          properties: { title: nama, index: i }
        }))
      })
    });
    this.fileId = j.spreadsheetId;
    await this.tulisHeader();
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

  async muat() {
    if (!Google.masukSudah()) return null;

    if (!this.fileId) this.fileId = await this.cariBerkas();
    if (!this.fileId) return null;              // pengguna baru → onboarding

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
      const isi = baris.slice(1).map(r => barisKeObjek(header, r));

      if (sheet === 'profil') {
        Object.assign(db.profil, isi[0] || {});
        db.versi_skema = Number(db.profil.versi_skema) || SKEMA_VERSI;
        delete db.profil.versi_skema;
      } else {
        db[sheet] = isi;
      }
    });

    return validasiSkema(db) ? lengkapiSkema(db) : null;
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
      .catch(e => { console.error('Gagal menulis ke Sheets:', e); return false; });
    return this._antre;
  },

  async _tulis(db) {
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

  /* Tidak menghapus berkas pengguna — hanya melepas kaitannya.
     Menghapus data keuangan orang dari Drive-nya bukan wewenang
     aplikasi ini; kalau mau dihapus, pengguna melakukannya sendiri. */
  async hapus() {
    this.fileId = null;
  },

  /* tautan supaya pengguna bisa membuka spreadsheet-nya sendiri */
  tautan() {
    return this.fileId
      ? `https://docs.google.com/spreadsheets/d/${this.fileId}/edit`
      : null;
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

  /* Menggabungkan transaksi dari dua sumber tanpa duplikat. */
  satukanTransaksi(a, b) {
    const peta = new Map();
    (a || []).forEach(t => peta.set(t.id, t));
    (b || []).forEach(t => { if (!peta.has(t.id)) peta.set(t.id, t); });
    return Array.from(peta.values())
      .sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
  }
};
