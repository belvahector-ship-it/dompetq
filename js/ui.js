/* ══════════════════════════════════════════════
   ui.js — format, elemen, modal, toast
   ══════════════════════════════════════════════ */

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ── format ─────────────────────────────────── */
const nfID = new Intl.NumberFormat('id-ID');

function rp(n, opt) {
  const v = Math.round(Number(n) || 0);
  const s = nfID.format(Math.abs(v));
  const tanda = v < 0 ? '−' : '';
  return (opt && opt.tanpaRp) ? tanda + s : tanda + 'Rp ' + s;
}

/* "Rp 1,2 jt" untuk ruang sempit */
function rpRingkas(n) {
  const v = Math.abs(Number(n) || 0);
  const t = (Number(n) || 0) < 0 ? '−' : '';
  if (v >= 1e9) return t + 'Rp ' + (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
  if (v >= 1e6) return t + 'Rp ' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
  if (v >= 1e4) return t + 'Rp ' + Math.round(v / 1e3) + ' rb';
  return rp(n);
}

/* input angka: ketik 50000 → tampil 50.000 */
function pasangFormatAngka(el) {
  el.addEventListener('input', () => {
    const pos = el.selectionStart, panjangLama = el.value.length;
    const angka = el.value.replace(/\D/g, '');
    el.value = angka ? nfID.format(Number(angka)) : '';
    const geser = el.value.length - panjangLama;
    const baru = Math.max(0, pos + geser);
    try { el.setSelectionRange(baru, baru); } catch (e) {}
  });
}
function bacaAngka(el) { return Number(String(el.value).replace(/\D/g, '')) || 0; }
function tulisAngka(el, n) { el.value = n ? nfID.format(Math.round(n)) : ''; }

/* ── tanggal ────────────────────────────────── */
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
               'Agustus','September','Oktober','November','Desember'];

function tglInput(d) {
  const x = new Date(d);
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
}
function pad2(n) { return String(n).padStart(2, '0'); }

function tglPanjang(d) {
  const x = new Date(d);
  return x.getDate() + ' ' + BULAN[x.getMonth()] + ' ' + x.getFullYear();
}

function tglRelatif(d) {
  const x = new Date(d), n = new Date();
  const hari = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) -
                           new Date(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5);
  if (hari === 0) return 'Hari ini';
  if (hari === 1) return 'Kemarin';
  if (hari > 1 && hari < 7) return HARI[x.getDay()] + ', ' + x.getDate() + ' ' + BULAN[x.getMonth()].slice(0, 3);
  return tglPanjang(d);
}

function awalBulan(d) { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), 1); }
function akhirBulan(d) { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59); }

/* ── elemen ─────────────────────────────────── */
function el(tag, attr, isi) {
  const e = document.createElement(tag);
  if (attr) for (const k in attr) {
    if (k === 'class') e.className = attr[k];
    else if (k === 'html') e.innerHTML = attr[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attr[k]);
    else if (attr[k] !== null && attr[k] !== undefined) e.setAttribute(k, attr[k]);
  }
  if (isi !== undefined && isi !== null) {
    (Array.isArray(isi) ? isi : [isi]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return e;
}
function kosong(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

const CHEVRON = '<svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>';

/* ── toast ──────────────────────────────────── */
let toastTimer;
function toast(pesan) {
  const t = $('#toast');
  t.textContent = pesan;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ── modal ──────────────────────────────────── */
const Modal = {
  buka({ judul, isi, aksi }) {
    $('#modalTitle').textContent = judul || '';
    const body = kosong($('#modalBody'));
    if (typeof isi === 'string') body.innerHTML = isi;
    else if (isi) body.appendChild(isi);

    const act = kosong($('#modalActions'));
    (aksi || []).forEach(a => {
      act.appendChild(el('button', {
        class: 'btn ' + (a.gaya || 'btn-ghost'),
        onclick: () => { if (a.aksi) a.aksi(); if (a.tutup !== false) Modal.tutup(); }
      }, a.label));
    });

    $('#modalBackdrop').hidden = false;
    $('#modal').hidden = false;
  },

  tutup() {
    $('#modalBackdrop').hidden = true;
    $('#modal').hidden = true;
  },

  /* pemilih daftar — dipakai untuk akun, kantong, kategori.
     Kotak cari muncul otomatis kalau daftarnya panjang. */
  pilih({ judul, opsi, terpilih, onPilih, tambah, cari }) {
    const list = el('div', { class:'opt-list' });
    const pakaiCari = cari !== false && opsi.length > 7;

    const gambar = (kata) => {
      kosong(list);
      const k = (kata || '').toLowerCase().trim();
      const hasil = k ? opsi.filter(o =>
        o.nama.toLowerCase().includes(k) || (o.ket || '').toLowerCase().includes(k)) : opsi;

      hasil.forEach(o => {
        list.appendChild(el('button', {
          class: 'opt' + (o.id === terpilih ? ' sel' : ''),
          onclick: () => { Modal.tutup(); onPilih(o); }
        }, [
          o.ikon ? el('div', { class:'opt-ico', style: o.warna ? `background:${o.warna}22;color:${o.warna}` : null }, o.ikon) : null,
          el('div', { class:'opt-body' }, [
            el('b', null, o.nama),
            o.ket ? el('small', null, o.ket) : null
          ]),
          o.kanan ? el('small', { class:'muted' }, o.kanan) : null
        ]));
      });

      if (!hasil.length) {
        list.appendChild(el('p', { class:'empty' },
          opsi.length ? 'Tidak ketemu. Coba kata lain, atau pilih "Lainnya".' : 'Belum ada pilihan.'));
      }
    };

    const wrap = el('div');
    if (pakaiCari) {
      const box = el('input', { type:'search', class:'cari-box',
                                placeholder:'Cari…', autocomplete:'off' });
      box.addEventListener('input', () => gambar(box.value));
      wrap.appendChild(box);
    }
    wrap.appendChild(list);
    gambar('');

    if (tambah) {
      wrap.appendChild(el('button', {
        class:'btn btn-dashed btn-block',
        onclick: () => { Modal.tutup(); tambah.aksi(); }
      }, tambah.label));
    }

    Modal.buka({ judul, isi: wrap, aksi: [{ label:'Tutup' }] });
    if (pakaiCari) setTimeout(() => wrap.querySelector('.cari-box').focus(), 80);
  },

  konfirmasi({ judul, pesan, labelYa, gayaYa, onYa }) {
    Modal.buka({
      judul,
      isi: el('p', { class:'muted', style:'margin:0' }, pesan),
      aksi: [
        { label:'Batal' },
        { label: labelYa || 'Ya', gaya: gayaYa || 'btn-primary', aksi: onYa }
      ]
    });
  },

  /* form isian sederhana */
  form({ judul, medan, labelSimpan, onSimpan }) {
    const wrap = el('div');
    const inputs = {};

    medan.forEach(m => {
      const lbl = el('label', { class:'field' });
      lbl.appendChild(el('span', null, m.label));
      let inp;
      if (m.tipe === 'select') {
        inp = el('select');
        m.opsi.forEach(o => inp.appendChild(el('option', { value:o.v }, o.t)));
        if (m.nilai) inp.value = m.nilai;
      } else {
        inp = el('input', { type: m.tipe || 'text', placeholder: m.placeholder || '',
                            value: m.nilai || '', autocomplete:'off' });
        if (m.tipe === 'angka') { inp.type = 'text'; inp.inputMode = 'numeric'; pasangFormatAngka(inp); }
      }
      lbl.appendChild(inp);
      inputs[m.nama] = inp;
      wrap.appendChild(lbl);
    });

    const err = el('div', { class:'err', hidden:'' });
    wrap.appendChild(err);

    Modal.buka({
      judul, isi: wrap,
      aksi: [
        { label:'Batal' },
        {
          label: labelSimpan || 'Simpan', gaya:'btn-primary', tutup:false,
          aksi: () => {
            const nilai = {};
            medan.forEach(m => {
              nilai[m.nama] = m.tipe === 'angka' ? bacaAngka(inputs[m.nama])
                                                 : inputs[m.nama].value.trim();
            });
            const salah = onSimpan(nilai);
            if (salah) { err.textContent = salah; err.hidden = false; }
            else Modal.tutup();
          }
        }
      ]
    });

    setTimeout(() => { const f = wrap.querySelector('input,select'); if (f) f.focus(); }, 60);
  }
};

/* inisial untuk avatar akun */
function inisialAkun(a) {
  const seed = SEED_AKUN.find(s => s.kode === a.bank_kode);
  if (seed && seed.ini) return seed.ini;
  return (a.nama || '?').trim().slice(0, 3).toUpperCase();
}
