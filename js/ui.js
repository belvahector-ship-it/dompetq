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

/* ── ikon ───────────────────────────────────
   Garis tebal seragam, mengikuti bahasa desain
   neo-brutalist: tanpa isian, tanpa gradasi. */
const IKON = {
  dompet:   '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/><circle cx="16" cy="14" r="1.4"/>',
  lapis:    '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  grafik:   '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  jam:      '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tag:      '<path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5L20 12l-8 8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  orang:    '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  awan:     '<path d="M7 18a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.6 1.4A3.5 3.5 0 0 1 17.5 18z"/>',
  kotak:    '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
  gembok:   '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  hati:     '<path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z"/>',
  peringatan:'<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.2v.1"/>',
  unduh:    '<path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M4.5 20h15"/>',
  cek:      '<path d="m5 12.5 4.5 4.5L19 7"/>'
};

function svgIkon(nama, ukuran) {
  const s = ukuran || 18;
  return `<svg class="ikon" viewBox="0 0 24 24" width="${s}" height="${s}" ` +
         `fill="none" stroke="currentColor" stroke-width="2.1" ` +
         `stroke-linecap="round" stroke-linejoin="round">${IKON[nama] || ''}</svg>`;
}

/* menyisipkan ikon di depan judul bagian */
function judulBagian(elemen, nama, teks, kanan) {
  kosong(elemen);
  elemen.appendChild(el('span', { class:'st-kiri', html: svgIkon(nama, 15) + '<span>' + esc(teks) + '</span>' }));
  if (kanan !== undefined) elemen.appendChild(el('small', null, kanan || ''));
  return elemen;
}

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
      /* baris terkunci — nilai yang tidak boleh diubah pengguna,
         mis. nama bank yang sudah dipilih dari daftar */
      if (m.tipe === 'statis') {
        wrap.appendChild(el('div', { class:'field' }, [
          el('span', null, m.label),
          el('div', { class:'terkunci' }, [
            m.ikon ? el('span', { class:'terkunci-ico' }, m.ikon) : null,
            el('b', null, m.nilai),
            el('span', { class:'terkunci-gembok', html: svgIkon('gembok', 14) })
          ])
        ]));
        return;
      }

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
              /* baris statis tidak punya input — nilainya sudah tetap */
              if (m.tipe === 'statis') { nilai[m.nama] = m.nilai; return; }
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
