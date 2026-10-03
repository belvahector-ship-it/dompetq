/* ══════════════════════════════════════════════
   piutang.js — uang yang dipinjam orang

   Halaman detail yang dibuka dari beranda, bukan tab. Cara menghitung
   ada di Calc.piutang; di sini hanya tampilan dan alur mencatat.
   Mencatat pinjaman memakai formulir transaksi yang sama (TX.piutang),
   jadi pengecekan saldo dan pisah rekening ikut berlaku.

   Dimuat sebelum app.js. Memakai navTo, TX, segarkan, dan kawan-kawan
   dari app.js — semuanya baru dipanggil setelah aplikasi berjalan.
   ══════════════════════════════════════════════ */

const KUNCI_ABAIKAN_RAPIKAN = 'dompetq:piutang:abaikan';
function bacaAbaikanRapikan() {
  try { return Number(localStorage.getItem(KUNCI_ABAIKAN_RAPIKAN)) || 0; } catch (e) { return 0; }
}
function tulisAbaikanRapikan(n) {
  try { localStorage.setItem(KUNCI_ABAIKAN_RAPIKAN, String(n)); } catch (e) {}
}

/* keadaan layar rapikan catatan lama */
const RAPIKAN = { aktif:false, baris:[], pilih:{}, cari:'', terakhir:[], segarkan:null };

function pasangPiutang() {
  $('#heroProyeksi').onclick = () => navTo('piutang');
  $('#piutangBaru').onclick = () => bukaInputPiutang('keluar');
  $('#piutangKembali').onclick = () => {
    if (RAPIKAN.aktif) { tutupRapikan(); return; }
    navTo(layarSebelum || 'dashboard');
  };
}

/* Ajakan di beranda untuk catatan lama yang belum bertanda. Kalau pengguna
   bilang "bukan pinjaman", ajakan baru muncul lagi hanya bila ada catatan
   mirip yang bertambah. */
function renderAjakRapikan() {
  const w = kosong($('#piutangBox'));
  const n = Calc.kandidatPiutang(Store.db).length;
  if (!n || n <= bacaAbaikanRapikan()) return;

  w.appendChild(el('div', { class:'pt-rapikan' }, [
    el('div', { class:'pt-rp-body' }, [
      el('b', null, 'Ada uang yang dipinjam orang?'),
      n + ' catatan lama tampak seperti pinjaman atau pembayaran balik, tapi belum dikaitkan ke siapa pun.'
    ]),
    el('button', { class:'btn btn-sm',
                   onclick: () => { navTo('piutang'); bukaRapikan(); } }, 'Rapikan')
  ]));
}

/* Memilih (atau menambah) peminjam. bolehKosong menambah pilihan
   "Bukan piutang" untuk layar rapikan. urutan = id yang baru dipakai. */
function pilihPeminjam({ judul, terpilih, onPilih, bolehKosong, urutan }) {
  const pt = Calc.piutang(Store.db).orang;
  const rank = id => { const i = (urutan || []).indexOf(id); return i === -1 ? 999 : i; };
  const daftar = Store.daftarPeminjam().slice()
    .sort((a, b) => rank(a.id) - rank(b.id) || a.nama.localeCompare(b.nama, 'id'));

  const opsi = daftar.map(p => ({
    id: p.id, nama: p.nama, ikon: (p.nama[0] || '?').toUpperCase(),
    ket: pt[p.id] && pt[p.id].sisa > 0 ? 'Sisa ' + rp(pt[p.id].sisa) : null
  }));
  if (bolehKosong) opsi.unshift({ id:'', nama:'Bukan piutang', ket:'Lewati catatan ini' });

  Modal.pilih({
    judul, opsi, terpilih: terpilih || '',
    onPilih: o => onPilih(o.id ? Store.pihak(o.id) : null),
    tambah: { label:'+ Orang baru', aksi: () => Modal.form({
      judul:'Orang baru',
      medan:[{ nama:'nama', label:'Nama', placeholder:'mis. Ayuk' }],
      onSimpan: v => {
        const p = Store.tambahPeminjam(v.nama);
        if (!p) return 'Nama tidak boleh kosong.';
        onPilih(p);
      }
    })}
  });
}

/* Formulir transaksi yang sama, jenisnya dikunci: 'keluar' = meminjamkan,
   'masuk' = menerima pembayaran balik. */
function bukaInputPiutang(arah, pihakId) {
  bukaInput();
  if ($('#sheetInput').hidden) return;

  TX.jenis = arah;
  TX.piutang = { arah, pihak_id: pihakId || '' };
  $('#txJenis').hidden = true;
  judulSheet(arah === 'keluar' ? 'Pinjamkan uang' : 'Terima pembayaran');
  $('#txSave').textContent = arah === 'keluar' ? 'Simpan pinjaman' : 'Simpan pembayaran';

  /* dibayar balik ke sumber dana yang dulu meminjamkan, bukan sembarang */
  if (arah === 'masuk' && pihakId) {
    const o = Calc.piutang(Store.db).orang[pihakId];
    const terbesar = o && Object.entries(o.kantong)
      .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
    if (terbesar && Store.kantong(terbesar[0])) TX.kantong_id = terbesar[0];
  }
  renderTxRows();
}

function renderPiutang() {
  const db = Store.db;

  $('#piutangUtama').hidden = RAPIKAN.aktif;
  $('#piutangRapikan').hidden = !RAPIKAN.aktif;
  $('#piutangKembali').textContent = RAPIKAN.aktif ? 'Batal' : 'Kembali';
  if (RAPIKAN.aktif) { renderRapikan(); return; }

  const r  = Calc.ringkas(db);
  const pt = Calc.piutang(db);

  const st = kosong($('#piutangStat'));
  st.appendChild(el('div', { class:'stat' }, [
    el('small', null, 'Dipinjam orang'), el('b', null, rp(pt.milikSendiri))
  ]));
  st.appendChild(el('div', { class:'stat' }, [
    el('small', null, 'Seharusnya uang saya'), el('b', { class:'pos' }, rp(r.uangSaya + pt.milikSendiri))
  ]));

  const cat = $('#piutangCatatan');
  const teks = ['Uang di tangan ' + rp(r.uangSaya) + ' + yang dipinjam ' + rp(pt.milikSendiri) + '.'];
  if (pt.titipan > 0)
    teks.push(rp(pt.titipan) + ' lagi adalah piutang dari dana titipan — tidak dihitung sebagai uangmu.');
  cat.textContent = teks.join(' ');
  cat.hidden = false;

  /* ajakan rapikan juga di sini: orang yang baru punya sedikit catatan
     bertanda mungkin belum sadar masih ada yang lama */
  const wr = kosong($('#piutangRapikanBox'));
  const n = Calc.kandidatPiutang(db).length;
  if (n) {
    wr.appendChild(el('div', { class:'pt-rapikan' }, [
      el('div', { class:'pt-rp-body' }, [
        el('b', null, 'Rapikan catatan lama'),
        n + ' catatan tampak seperti pinjaman atau pembayaran balik yang belum ada nama orangnya.'
      ]),
      el('button', { class:'btn btn-sm', onclick: bukaRapikan }, 'Rapikan')
    ]));
  }

  const aktif = pt.daftar.filter(o => o.sisa > 0).sort((a, b) =>
    new Date(a.tertua || a.terakhir) - new Date(b.tertua || b.terakhir));
  const wd = kosong($('#piutangDaftar'));
  if (!aktif.length) {
    wd.appendChild(kartuKosong('Tidak ada yang berutang padamu',
      'Tekan "Pinjamkan uang" saat meminjamkan, supaya uangnya tidak hilang dari hitunganmu.'));
  }
  aktif.forEach(o => wd.appendChild(kartuPiutang(o)));

  const wl = kosong($('#piutangLunas'));
  const lunas = pt.daftar.filter(o => o.sisa <= 0 && o.dipinjam > 0);
  if (lunas.length) {
    wl.appendChild(el('h3', { class:'sec-title' }, 'Sudah lunas'));
    wl.appendChild(el('div', { class:'pt-lunas' }, lunas.map(o =>
      el('button', { class:'pt-chip', onclick: () => riwayatPiutang(o.pihak.id) }, o.pihak.nama))));
  }
}

function kartuPiutang(o) {
  const hari = o.tertua ? Math.floor((Date.now() - new Date(o.tertua).getTime()) / 864e5) : 0;
  return el('div', { class:'pt-card' }, [
    el('button', { class:'pt-head', onclick: () => riwayatPiutang(o.pihak.id) }, [
      el('div', null, [
        el('b', null, o.pihak.nama),
        el('small', null, 'Dipinjamkan ' + rp(o.dipinjam) + ' · kembali ' + rp(o.dibayar)),
        el('small', { class: hari >= 30 ? 'pt-lama' : '' },
           'Sejak ' + tglSingkat(o.tertua || o.terakhir) + ' · ' + (hari <= 0 ? 'hari ini' : hari + ' hari'))
      ]),
      el('div', { class:'pt-sisa' }, rp(o.sisa))
    ]),
    el('div', { class:'pt-aksi' }, [
      el('button', { class:'btn btn-sm btn-primary',
                     onclick: () => bukaInputPiutang('masuk', o.pihak.id) }, 'Terima pembayaran'),
      el('button', { class:'btn btn-sm',
                     onclick: () => bukaInputPiutang('keluar', o.pihak.id) }, 'Pinjamkan lagi')
    ])
  ]);
}

function riwayatPiutang(pihakId) {
  const o = Calc.piutang(Store.db).orang[pihakId];
  if (!o) return;

  const isi = el('div', { style:'margin:-6px 0 0' });
  isi.appendChild(el('div', { class:'rw-ringkas' }, [
    el('span', null, 'Sisa'), el('b', null, rp(o.sisa))
  ]));
  o.riwayat.slice().reverse().forEach(t => {
    const keluar = t.jenis === 'keluar';
    isi.appendChild(el('div', { class:'rw-baris' }, [
      el('div', null, [
        t.keterangan || (keluar ? 'Dipinjamkan' : 'Dibayar kembali'),
        el('small', null, tglPanjang(t.timestamp) + ' · ' + ((Store.akun(t.akun_id) || {}).nama || ''))
      ]),
      el('b', { class: keluar ? 'keluar' : 'masuk' }, (keluar ? '−' : '+') + rp(t.nominal))
    ]));
  });

  /* Modal.buka memakai satu modal yang sama, jadi menutupnya SETELAH aksi
     akan ikut menutup dialog berikutnya. Karena itu tutup:false lalu
     ditutup manual sebelum membuka yang lain. */
  const aksi = [{ label:'Tutup' }];
  if (o.sisa > 0) {
    aksi.push({ label:'Ikhlaskan', tutup:false,
                aksi: () => { Modal.tutup(); konfirmasiIkhlas(o); } });
    aksi.push({ label:'Terima bayar', gaya:'btn-primary', tutup:false,
                aksi: () => { Modal.tutup(); bukaInputPiutang('masuk', pihakId); } });
  } else {
    aksi.push({ label:'Pinjamkan lagi', gaya:'btn-primary', tutup:false,
                aksi: () => { Modal.tutup(); bukaInputPiutang('keluar', pihakId); } });
  }
  Modal.buka({ judul: o.pihak.nama, isi, aksi });
}

function konfirmasiIkhlas(o) {
  Modal.konfirmasi({
    judul:'Ikhlaskan sisa piutang',
    pesan:'Sisa ' + rp(o.sisa) + ' dari ' + o.pihak.nama + ' tidak lagi dihitung sebagai uangmu. ' +
          'Dicatat sebagai pengeluaran "Piutang diikhlaskan". Saldo rekening tidak berubah.',
    labelYa:'Ya, ikhlaskan', gayaYa:'btn-primary',
    onYa: () => {
      const n = Store.ikhlaskan(o.pihak.id);
      segarkan();
      toast(n ? 'Diikhlaskan · ' + rp(n) : 'Tidak ada sisa yang diikhlaskan');
    }
  });
}

/* ── rapikan catatan lama ──
   Pengguna memilih orang untuk tiap catatan, melihat hasil hitungannya,
   baru menerapkan. Menerapkan = entri koreksi (Store.tautkanBanyak),
   jadi saldo tidak berubah dan riwayat lama tetap utuh. */
function bukaRapikan() {
  RAPIKAN.aktif = true;
  RAPIKAN.baris = Calc.kandidatPiutang(Store.db);
  RAPIKAN.pilih = {};
  RAPIKAN.cari = '';
  RAPIKAN.terakhir = [];
  renderPiutang();
  $('#scr-piutang .scroll').scrollTop = 0;
}

function tutupRapikan() {
  RAPIKAN.aktif = false;
  RAPIKAN.segarkan = null;
  renderPiutang();
}

function renderRapikan() {
  const db = Store.db;
  const w = kosong($('#piutangRapikan'));

  w.appendChild(el('p', { class:'rp-intro' },
    'Tandai catatan lama yang sebenarnya pinjaman ke orang, atau pembayaran baliknya, lalu pilih orangnya. ' +
    'Saldo rekeningmu tidak berubah — catatan hanya diberi tanda siapa peminjamnya.'));

  const inp = el('input', { type:'search', placeholder:'Cari catatan lain (keterangan atau kategori)…',
                            value: RAPIKAN.cari, autocomplete:'off' });
  w.appendChild(el('div', { class:'rp-cari' }, [ inp ]));

  const daftar = el('div', { class:'tx-list' });
  const hasil = el('div');
  const tombol = el('button', { class:'btn btn-primary btn-block' }, 'Terapkan');
  w.appendChild(daftar);
  w.appendChild(hasil);
  w.appendChild(el('div', { class:'rp-aksi' }, [
    tombol,
    el('button', { class:'btn btn-ghost btn-block', onclick: () => {
      tulisAbaikanRapikan(Calc.kandidatPiutang(db).length);
      tutupRapikan();
      toast('Oke, ajakan ini disembunyikan');
    } }, 'Ini bukan pinjaman, jangan tanya lagi')
  ]));

  const sumber = () => {
    const k = RAPIKAN.cari.trim().toLowerCase();
    if (!k) return RAPIKAN.baris;
    const angka = k.replace(/\D/g, '');
    const skip = Calc.idDikoreksi(db);
    return db.transaksi.filter(t =>
      (t.jenis === 'keluar' || t.jenis === 'masuk') && !t.pihak_id && !t.reversal_dari && !skip.has(t.id) &&
      ((t.keterangan || '').toLowerCase().includes(k) ||
       ((Store.kategori(t.kategori_id) || {}).nama || '').toLowerCase().includes(k) ||
       (angka && String(t.nominal).includes(angka)))
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 40);
  };

  const barisRapikan = t => {
    const keluar = t.jenis === 'keluar';
    const kat = Store.kategori(t.kategori_id);
    const pid = RAPIKAN.pilih[t.id];
    const ph = pid ? Store.pihak(pid) : null;
    const row = el('div', { class:'tx rp-baris' }, [
      el('div', { class:'tx-ico ' + (keluar ? 'keluar' : 'masuk') }, keluar ? '−' : '+'),
      el('div', { class:'tx-mid' }, [
        el('b', null, t.keterangan || (kat ? kat.nama : namaJenis(t.jenis))),
        el('small', null, (kat ? kat.nama + ' · ' : '') + tglSingkat(t.timestamp)),
        el('span', { class:'rp-pill' + (ph ? ' ada' : '') },
           ph ? (keluar ? 'Dipinjam ' : 'Dibayar ') + ph.nama : 'Pilih orang')
      ]),
      el('div', { class:'tx-amt ' + (keluar ? 'keluar' : 'masuk') }, (keluar ? '−' : '+') + rp(t.nominal))
    ]);
    row.onclick = () => pilihPeminjam({
      judul: keluar ? 'Dipinjamkan ke siapa?' : 'Dibayar oleh siapa?',
      terpilih: pid || '', bolehKosong: true, urutan: RAPIKAN.terakhir,
      onPilih: p => {
        if (p) {
          RAPIKAN.pilih[t.id] = p.id;
          RAPIKAN.terakhir = [p.id].concat(RAPIKAN.terakhir.filter(x => x !== p.id));
        } else {
          delete RAPIKAN.pilih[t.id];
        }
        RAPIKAN.segarkan();
      }
    });
    return row;
  };

  RAPIKAN.segarkan = () => {
    const baris = sumber();
    kosong(daftar);
    if (!baris.length) {
      daftar.appendChild(el('p', { class:'empty' }, RAPIKAN.cari
        ? 'Tidak ketemu. Coba kata atau nominal lain.'
        : 'Tidak ada catatan yang cocok.\nCari catatan lain lewat kotak di atas.'));
    }
    baris.forEach(t => daftar.appendChild(barisRapikan(t)));

    /* dihitung dulu seolah sudah diterapkan, supaya angkanya bisa dicek
       dengan ingatan sebelum benar-benar disimpan */
    const n = Object.keys(RAPIKAN.pilih).length;
    kosong(hasil);
    if (n) {
      const sim = Object.assign({}, db, { transaksi: db.transaksi.map(t =>
        RAPIKAN.pilih[t.id] ? Object.assign({}, t, { pihak_id: RAPIKAN.pilih[t.id] }) : t) });
      const box = el('div', { class:'rp-hasil' }, [ el('b', null, 'Hasil kalau diterapkan') ]);
      Calc.piutang(sim).daftar.forEach(o => {
        box.appendChild(el('div', { class:'rp-hasil-baris' + (o.sisa < 0 ? ' minus' : '') }, [
          el('span', null, o.pihak.nama + (o.sisa < 0 ? ' (kelebihan bayar — cek lagi)' : '')),
          el('b', null, rp(o.sisa))
        ]));
      });
      hasil.appendChild(box);
    }
    tombol.textContent = n ? 'Terapkan (' + n + ')' : 'Terapkan';
    tombol.disabled = !n;
  };

  inp.addEventListener('input', () => { RAPIKAN.cari = inp.value; RAPIKAN.segarkan(); });
  tombol.onclick = () => {
    const n = Object.keys(RAPIKAN.pilih).length;
    if (!n) return;
    Modal.konfirmasi({
      judul:'Terapkan ke ' + n + ' catatan?',
      pesan:'Tiap catatan diberi tanda peminjam lewat entri koreksi. Saldo rekening tidak berubah dan riwayat lama tetap tersimpan.',
      labelYa:'Terapkan', gayaYa:'btn-primary',
      onYa: () => {
        const jml = Store.tautkanBanyak(Object.entries(RAPIKAN.pilih)
          .map(([txId, pihakId]) => ({ txId, pihakId })));
        RAPIKAN.aktif = false;
        RAPIKAN.segarkan = null;
        segarkan();
        toast(jml + ' catatan dikaitkan ke peminjam');
      }
    });
  };

  RAPIKAN.segarkan();
}
