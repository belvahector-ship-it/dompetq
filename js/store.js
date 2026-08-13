/* ══════════════════════════════════════════════
   store.js — lapisan penyimpanan

   Sengaja dibuat sebagai adapter supaya penyimpanan
   bisa ditukar tanpa menyentuh kode lain.
     v1  : LocalAdapter  (localStorage — jalan hari ini)
     v2  : SheetsAdapter (Google Sheets di Drive pengguna)

   Bentuk data identik untuk keduanya. Nama field
   sengaja sama persis dengan nama kolom sheet.
   ══════════════════════════════════════════════ */

const SKEMA_VERSI = 1;
const LS_KEY = 'dompetq:db:v1';

function dbKosong() {
  return {
    versi_skema: SKEMA_VERSI,
    profil:   { nama:'', email:'', tanggal_mulai:'' },
    akun:     [],   // {id,nama,bank_kode,jenis,is_default,urutan,aktif}
    kantong:  [],   // {id,nama,jenis,is_default,warna,catatan}
    kategori: [],   // {id,nama,tipe,ikon}
    pihak:    [],   // {id,nama,tipe,kontak}
    transaksi:[]    // lihat konsep.md §6.3
  };
}

/* ── adapter lokal ───────────────────────────── */
const LocalAdapter = {
  nama: 'lokal',

  async muat() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const db = JSON.parse(raw);
      return validasiSkema(db) ? db : null;
    } catch (e) {
      console.error('Gagal membaca penyimpanan lokal:', e);
      return null;
    }
  },

  async simpan(db) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error('Gagal menulis penyimpanan lokal:', e);
      return false;   // penyebab tersering: kuota penuh atau mode penyamaran
    }
  },

  async hapus() { localStorage.removeItem(LS_KEY); }
};

/* Validasi bentuk data. Penting karena nanti pengguna
   bisa membuka spreadsheet-nya sendiri dan merusaknya. */
function validasiSkema(db) {
  if (!db || typeof db !== 'object') return false;
  const wajib = ['akun','kantong','kategori','transaksi'];
  return wajib.every(k => Array.isArray(db[k]));
}

/* ── Store: satu-satunya pintu ke data ───────── */
const Store = {
  db: null,

  /* Lokal selalu jadi sumber baca: cepat, jalan tanpa internet,
     dan tidak pernah kehilangan data kalau Google sedang bermasalah.
     Sheets dipasang sebagai CERMIN — tujuan tulis kedua, bukan
     pengganti. Gagal menulis ke Sheets tidak pernah menghilangkan
     transaksi, karena salinannya sudah ada di perangkat. */
  adapter: LocalAdapter,
  cermin: null,

  sinkron: { aktif:false, terakhir:null, sedang:false, galat:null },
  onSinkronBerubah: null,

  _pending: null,

  async init() {
    this.db = await this.adapter.muat();
    return this.db !== null;
  },

  mulaiBaru(profil) {
    this.db = dbKosong();
    this.db.profil = {
      nama: profil.nama || '',
      email: profil.email || '',
      tanggal_mulai: new Date().toISOString()
    };
    return this.db;
  },

  /* Dipasang oleh app.js untuk memberi tahu pengguna kalau tulis gagal.
     Gagal simpan TIDAK BOLEH didiamkan: pengguna akan terus mencatat
     sementara tidak ada yang tersimpan. */
  onGagalSimpan: null,

  _lapor(ok) {
    if (!ok && typeof this.onGagalSimpan === 'function') this.onGagalSimpan();
    return ok;
  },

  /* Tulis ditunda 250ms lalu digabung, supaya mengetik di form
     tidak memicu satu tulis per ketukan. Hanya untuk perubahan
     yang tidak kritis (rename, pengaturan).
     Pola yang sama nanti dipakai untuk batch Sheets API. */
  simpan() {
    clearTimeout(this._pending);
    this._pending = setTimeout(() => this._tulis(), 250);
  },

  /* Untuk apa pun yang menyangkut uang — tulis seketika, tanpa jeda.
     Jeda 250ms cukup untuk kehilangan satu transaksi kalau app ditutup
     atau di-refresh tepat sesudah simpan. */
  async simpanSekarang() {
    clearTimeout(this._pending);
    return this._tulis();
  },

  async _tulis() {
    const ok = await this.adapter.simpan(this.db);
    this._lapor(ok);
    this._cerminkan();
    return ok;
  },

  /* Tulis ke Sheets berjalan di latar dan TIDAK ditunggu. Pengguna
     tidak boleh menunggu jaringan untuk mencatat satu pengeluaran. */
  _cerminkan() {
    if (!this.cermin || !this.sinkron.aktif) return;
    this.sinkron.sedang = true;
    this._kabarkanSinkron();

    this.cermin.simpan(this.db).then(ok => {
      this.sinkron.sedang = false;
      if (ok) { this.sinkron.terakhir = new Date().toISOString(); this.sinkron.galat = null; }
      else    { this.sinkron.galat = 'Gagal menulis ke Google Sheets.'; }
      this._kabarkanSinkron();
    }).catch(e => {
      this.sinkron.sedang = false;
      this.sinkron.galat = e.message;
      this._kabarkanSinkron();
    });
  },

  _kabarkanSinkron() {
    if (typeof this.onSinkronBerubah === 'function') this.onSinkronBerubah(this.sinkron);
  },

  /* Dipanggil saat halaman ditutup — pastikan tulisan tertunda ikut turun. */
  flush() {
    if (this._pending) {
      clearTimeout(this._pending);
      this._pending = null;
      this.adapter.simpan(this.db);
      this._cerminkan();
    }
  },

  /* ── Google Sheets ──────────────────────────
     Menyambungkan akun: masuk, baca yang ada di Drive, lalu
     putuskan arah sinkronnya. Mengembalikan objek keputusan;
     kalau 'bentrok', pemanggil yang bertanya ke pengguna. */
  async sambungkanSheets() {
    await Google.masuk();
    const jauh = await SheetsAdapter.muat();
    const putusan = Sinkron.gabung(this.db, jauh);
    putusan.email = Google.profil ? Google.profil.email : '';
    return putusan;
  },

  /* Menerapkan keputusan sinkron. arah:
       'unggah'  — data perangkat menang, ditulis ke Sheets
       'unduh'   — data Sheets menang, menggantikan yang di perangkat
       'satukan' — transaksi digabung, master data dari perangkat */
  async terapkanSinkron(arah, jauh) {
    if (arah === 'unduh' && jauh) {
      this.db = jauh;
    } else if (arah === 'satukan' && jauh) {
      this.db.transaksi = Sinkron.satukanTransaksi(this.db.transaksi, jauh.transaksi);
    }

    this.cermin = SheetsAdapter;
    this.sinkron.aktif = true;
    this.sinkron.galat = null;

    await this.adapter.simpan(this.db);          // lokal dulu, selalu
    const ok = await SheetsAdapter.simpan(this.db);
    this.sinkron.sedang = false;
    if (ok) this.sinkron.terakhir = new Date().toISOString();
    else    this.sinkron.galat = 'Gagal menulis ke Google Sheets.';
    this._kabarkanSinkron();
    return ok;
  },

  putuskanSheets() {
    Google.keluar();
    SheetsAdapter.hapus();
    this.cermin = null;
    this.sinkron = { aktif:false, terakhir:null, sedang:false, galat:null };
    this._kabarkanSinkron();
  },

  async reset() {
    await this.adapter.hapus();
    this.db = null;
  },

  /* ── akun ── */
  tambahAkun({ nama, bank_kode, jenis }) {
    const a = {
      id: uid('akn'), nama, bank_kode: bank_kode || '',
      jenis: jenis || 'lainnya',
      is_default: this.db.akun.length === 0,
      urutan: this.db.akun.length, aktif: true
    };
    this.db.akun.push(a); this.simpan(); return a;
  },
  hapusAkun(id) {
    const dipakai = this.db.transaksi.some(
      t => t.akun_id === id || t.akun_tujuan_id === id);
    if (dipakai) return { ok:false, alasan:'terpakai' };
    this.db.akun = this.db.akun.filter(a => a.id !== id);
    if (this.db.akun.length && !this.db.akun.some(a => a.is_default))
      this.db.akun[0].is_default = true;
    this.simpan(); return { ok:true };
  },

  /* ── kantong (Sumber Dana) ── */
  tambahKantong({ nama, jenis }) {
    const k = {
      id: uid('ktg'), nama, jenis: jenis || 'titipan',
      is_default: jenis === 'milik_sendiri' && !this.db.kantong.some(x => x.is_default),
      warna: WARNA_KANTONG[this.db.kantong.length % WARNA_KANTONG.length],
      catatan: ''
    };
    this.db.kantong.push(k); this.simpan(); return k;
  },
  hapusKantong(id) {
    const dipakai = this.db.transaksi.some(
      t => t.kantong_id === id || t.kantong_tujuan_id === id);
    if (dipakai) return { ok:false, alasan:'terpakai' };
    this.db.kantong = this.db.kantong.filter(k => k.id !== id);
    /* Default HARUS jatuh ke dana milik sendiri. Kalau default berpindah
       ke kantong titipan, tiap pencatatan cepat akan salah kantong dan
       angka "uang saya bersih" ikut ngawur. */
    if (this.db.kantong.length && !this.db.kantong.some(k => k.is_default)) {
      const milik = this.db.kantong.find(k => k.jenis === 'milik_sendiri');
      (milik || this.db.kantong[0]).is_default = true;
    }
    this.simpan(); return { ok:true };
  },

  /* ── kategori ── */
  tambahKategori({ nama, tipe }) {
    const ada = this.db.kategori.find(
      k => k.tipe === tipe && k.nama.toLowerCase() === nama.toLowerCase());
    if (ada) return ada;
    const k = { id: uid('kat'), nama, tipe, ikon:'' };
    this.db.kategori.push(k); this.simpan(); return k;
  },
  hapusKategori(id) {
    const dipakai = this.db.transaksi.some(t => t.kategori_id === id);
    if (dipakai) return { ok:false, alasan:'terpakai' };
    this.db.kategori = this.db.kategori.filter(k => k.id !== id);
    this.simpan(); return { ok:true };
  },

  /* ── transaksi (append-only) ── */
  catat(t) {
    const tx = Object.assign({
      id: uid('trx'),
      timestamp: new Date().toISOString(),
      dibuat_pada: new Date().toISOString(),
      jenis:'keluar', nominal:0,
      akun_id:'', akun_tujuan_id:'',
      kantong_id:'', kantong_tujuan_id:'',
      kategori_id:'', pihak_id:'',
      keterangan:'', bukti_url:'', bukti_thumb:'',
      reversal_dari:''
    }, t);
    this.db.transaksi.push(tx);
    this.simpanSekarang();
    return tx;
  },

  /* Koreksi = entri pembalik, bukan edit baris lama.
     Log timestamp harus tetap jujur — ada uang orang
     lain di dalamnya. (konsep.md §6.3) */
  batalkan(txId) {
    const asli = this.db.transaksi.find(t => t.id === txId);
    if (!asli || asli.reversal_dari) return null;
    const sudah = this.db.transaksi.some(t => t.reversal_dari === txId);
    if (sudah) return null;

    const balik = Object.assign({}, asli, {
      id: uid('trx'),
      timestamp: asli.timestamp,
      dibuat_pada: new Date().toISOString(),
      reversal_dari: txId,
      keterangan: 'Koreksi: ' + (asli.keterangan || namaJenis(asli.jenis))
    });

    // membalik arah
    if (asli.jenis === 'masuk')            balik.jenis = 'keluar';
    else if (asli.jenis === 'keluar')      balik.jenis = 'masuk';
    else if (asli.jenis === 'saldo_awal')  balik.jenis = 'keluar';
    else if (asli.jenis === 'transfer_akun') {
      balik.akun_id = asli.akun_tujuan_id;
      balik.akun_tujuan_id = asli.akun_id;
    } else if (asli.jenis === 'transfer_kantong') {
      balik.kantong_id = asli.kantong_tujuan_id;
      balik.kantong_tujuan_id = asli.kantong_id;
    }

    this.db.transaksi.push(balik);
    this.simpanSekarang();
    return balik;
  },

  /* transaksi yang sudah dikoreksi, untuk ditandai di UI */
  sudahDikoreksi(txId) {
    return this.db.transaksi.some(t => t.reversal_dari === txId);
  },

  /* ── lookup ── */
  akun(id)     { return this.db.akun.find(a => a.id === id); },
  kantong(id)  { return this.db.kantong.find(k => k.id === id); },
  kategori(id) { return this.db.kategori.find(k => k.id === id); },

  akunDefault()    { return this.db.akun.find(a => a.is_default) || this.db.akun[0]; },
  kantongDefault() { return this.db.kantong.find(k => k.is_default) || this.db.kantong[0]; },

  /* true kalau pengguna tidak memegang uang titipan sama sekali.
     Seluruh UI sumber dana disembunyikan. (konsep.md §3.2 aturan 4) */
  modeSederhana() {
    return this.db.kantong.filter(k => k.jenis === 'titipan').length === 0;
  },

  /* ── cadangan ── */
  ekspor() { return JSON.stringify(this.db, null, 2); },
  async impor(json) {
    const db = JSON.parse(json);
    if (!validasiSkema(db)) throw new Error('Struktur file cadangan tidak dikenali.');
    this.db = db;
    await this.simpanSekarang();
  }
};

function uid(pre) {
  return pre + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function namaJenis(j) {
  return { masuk:'Pemasukan', keluar:'Pengeluaran',
           transfer_akun:'Pindah tempat', transfer_kantong:'Pindah sumber dana',
           saldo_awal:'Saldo awal' }[j] || j;
}
