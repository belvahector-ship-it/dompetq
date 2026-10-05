/* ══════════════════════════════════════════════
   app.js — routing, onboarding, layar
   ══════════════════════════════════════════════ */

/* ═══════════ BOOT ═══════════ */
(async function boot() {
  pasangSaranBayangan();
  pasangFooter();
  const ada = await Store.init();
  if (ada) { masukApp(); }
  else     { OB.mulai(); }
})();

function masukApp() {
  $('#scr-onboarding').hidden = true;
  $('#bottomnav').hidden = false;
  pasangPengamanData();
  pasangNav();
  pasangSheetInput();
  pasangProfil();
  pasangLaporan();
  pasangTransaksi();
  pasangPiutang();
  navTo('dashboard');

  /* Diperiksa setelah layar siap, bukan di tengah pemuatan — pop-up
     yang muncul sebelum aplikasi terlihat membingungkan. */
  setTimeout(periksaPengingat, 700);
  pulihkanSambungan();
  pasangTarikOtomatis();
}

/* Menyambung kembali ke Google diam-diam saat aplikasi dibuka.
   Berjalan di latar dan tidak pernah menahan tampilnya layar —
   kalau izinnya sudah habis, tidak ada yang terlihat berubah. */
async function pulihkanSambungan() {
  let hasil;
  try { hasil = await Store.pulihkanSheets(); }
  catch (e) { return; }
  await terapkanHasilPulih(hasil);
}

/* Email sesi yang masih diingat tapi belum hidup lagi. Selama berisi,
   beranda menampilkan satu batang ketuk-untuk-menyambung. */
let perluSambungLagi = null;

async function terapkanHasilPulih(hasil) {
  const sebelum = perluSambungLagi;
  perluSambungLagi = null;

  if (hasil.cara === 'perlu-tap') {
    perluSambungLagi = hasil.email;
    if (layarAktif === 'dashboard') renderDashboard();
    return;
  }

  if (hasil.cara === 'tidak') {
    if (sebelum && layarAktif === 'dashboard') renderDashboard();
    return;
  }

  if (hasil.cara === 'siap' || hasil.cara === 'galat') {
    if (layarAktif === 'profil')         renderSheets();
    else if (layarAktif === 'dashboard') renderDashboard();
    return;
  }

  if (hasil.cara === 'unduh') {
    await Store.terapkanSinkron('unduh', hasil.jauh);
    segarkan();
    toast('Data terbaru diambil dari Google Sheets');
    return;
  }

  /* Kedua sisi sama-sama maju — sudah disatukan sendiri oleh Store.
     Yang tersisa hanya menggambar ulang dan memberi tahu apa yang
     masuk, supaya perubahan yang tiba-tiba muncul tidak terasa
     seperti aplikasi berubah sendiri. */
  if (hasil.cara === 'satukan') {
    segarkan();
    if (hasil.masuk) toast(hasil.masuk + ' catatan dari perangkat lain ikut masuk');
    return;
  }
}

/* ── menarik perubahan saat aplikasi kembali dilihat ──

   Sinkron selama ini satu arah setelah aplikasi terbuka: perangkat
   ini menulis, tapi tidak pernah membaca lagi. Dua perangkat yang
   sama-sama dibiarkan terbuka jadi tidak pernah bertemu.

   Ditahan 30 detik supaya berpindah-pindah tab tidak berubah jadi
   hujan permintaan ke Google. */
let tarikTerakhir = 0;

function pasangTarikOtomatis() {
  const coba = async () => {
    if (document.hidden || !Store.sinkron.aktif || Store.sinkron.sedang) return;
    if (Date.now() - tarikTerakhir < 30000) return;
    tarikTerakhir = Date.now();

    const h = await Store.tarikSekarang();
    if (h.cara === 'ok' && h.masuk) {
      segarkan();
      toast(h.masuk + ' catatan baru dari perangkat lain');
    } else if (layarAktif === 'profil') {
      renderSheets();
    }
  };

  document.addEventListener('visibilitychange', coba);
  window.addEventListener('focus', coba);
}

/* Hanya untuk penyambungan MANUAL pertama kali, ketika belum jelas
   data mana yang dimaksud pengguna. Pemulihan otomatis tidak lagi
   memakai ini — perangkat yang sudah terikat ke spreadsheet yang sama
   langsung disatukan tanpa bertanya (lihat Store.pulihkanSheets). */
function tanyaBentrok(lokal, jauh) {
  const pakai = async (arah) => {
    toast('Menyinkronkan…');
    const ok = await Store.terapkanSinkron(arah, jauh);
    renderProfil();
    toast(ok ? 'Tersambung ke Google Sheets' : 'Tersambung, tapi tulis pertama gagal');
    segarkan();
  };

  Modal.buka({
    judul: 'Dua-duanya sudah berisi',
    isi: el('div', null, [
      el('p', { class:'muted', style:'margin-top:0' },
        `Di perangkat ini ada ${lokal.transaksi.length} transaksi, ` +
        `di Google Sheets ada ${jauh.transaksi.length}. Mau diapakan?`),
      el('p', { class:'fineprint', style:'margin:0' },
        'Menyatukan adalah pilihan paling aman: transaksi punya ID unik, ' +
        'jadi tidak ada yang dobel dan tidak ada yang hilang.')
    ]),
    aksi: [
      { label:'Batal' },
      { label:'Pakai Sheets', aksi: () => pakai('unduh') },
      { label:'Satukan', gaya:'btn-primary', aksi: () => pakai('satukan') }
    ]
  });
}

/* ═══════════ NAVIGASI ═══════════ */
let layarAktif = 'dashboard';
/* layar sebelum masuk ke halaman piutang — tujuan tombol Kembali */
let layarSebelum = 'dashboard';

function navTo(nama) {
  if (nama === 'piutang' && layarAktif !== 'piutang') layarSebelum = layarAktif;
  if (nama !== 'piutang') { RAPIKAN.aktif = false; RAPIKAN.segarkan = null; }
  layarAktif = nama;
  ['dashboard','transaksi','laporan','profil','piutang'].forEach(n => {
    $('#scr-' + n).hidden = (n !== nama);
  });
  $$('#bottomnav button[data-nav]').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nama));

  if (nama === 'dashboard') renderDashboard();
  if (nama === 'transaksi') renderTransaksi();
  if (nama === 'laporan')   renderLaporan();
  if (nama === 'profil')    renderProfil();
  if (nama === 'piutang')   renderPiutang();
}

function pasangNav() {
  $$('#bottomnav button[data-nav]').forEach(b =>
    b.onclick = () => navTo(b.dataset.nav));
  $('#fab').onclick = () => bukaInput();
}

function segarkan() {
  navTo(layarAktif);
}

/* Footer kredit — kecil, satu baris, di dasar layar yang bisa digulir.
   Disisipkan lewat JS supaya versinya cukup diubah di satu tempat. */
function pasangFooter() {
  const isi = () => el('footer', { class:'kredit' }, [
    el('span', null, 'DompetQ'),
    el('span', { class:'kredit-versi' }, TAHAP_APP + ' v' + VERSI_APP),
    el('span', { class:'kredit-pisah' }, '·'),
    el('a', { href: KREDIT_URL, target:'_blank', rel:'noopener' }, KREDIT_APP)
  ]);

  $$('.pad-bottom').forEach(p => p.parentElement.insertBefore(isi(), p));
  const ob = $('.ob-step[data-step="0"]');
  if (ob) ob.appendChild(isi());
}

/* Saran isian selalu berupa BAYANGAN (placeholder), tidak pernah teks
   sungguhan yang harus dihapus dulu. Dan begitu kolom disentuh,
   bayangannya menyingkir supaya tidak mengganggu saat mengetik. */
function pasangSaranBayangan() {
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return;
    if (!t.placeholder) return;
    t.dataset.saran = t.placeholder;
    t.placeholder = '';
  });
  document.addEventListener('focusout', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.saran) return;
    t.placeholder = t.dataset.saran;   // muncul lagi kalau ditinggalkan
    delete t.dataset.saran;
  });
}

/* Dua jaring pengaman penyimpanan. */
let peringatanSimpanTampil = false;

function pasangPengamanData() {
  /* 1. Gagal tulis tidak boleh didiamkan. Kalau kuota penuh atau browser
        dalam mode penyamaran, pengguna harus tahu SEKARANG — bukan setelah
        sebulan mencatat ke ruang hampa. */
  Store.onGagalSimpan = () => {
    if (peringatanSimpanTampil) return;
    peringatanSimpanTampil = true;
    Modal.buka({
      judul: 'Data gagal disimpan',
      isi: el('p', { class:'muted', style:'margin:0' },
        'Browser menolak menyimpan. Biasanya karena penyimpanan penuh, atau ' +
        'kamu sedang membuka aplikasi ini di mode penyamaran (incognito). ' +
        'Catatan yang baru kamu buat berisiko hilang saat halaman ditutup. ' +
        'Unduh cadangan dari halaman Laporan sekarang, lalu buka di jendela biasa.'),
      aksi: [{ label:'Mengerti', gaya:'btn-primary',
               aksi: () => { peringatanSimpanTampil = false; } }]
    });
  };

  /* 2. Status sinkron di halaman Profil ikut berubah sendiri. */
  Store.onSinkronBerubah = () => {
    if (layarAktif === 'profil') renderSheets();
  };

  /* 3. Tulis tertunda ikut turun saat halaman ditutup atau berpindah ke latar. */
  const turunkan = () => Store.flush();
  window.addEventListener('pagehide', turunkan);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') turunkan();
  });
}

/* ══════════════════════════════════════════════
   ONBOARDING
   ══════════════════════════════════════════════ */
const OB = {
  step: 0,
  nama: '', email: '',
  akun: [],            // {key,nama,bank_kode,jenis,saldo}
  punyaTitipan: null,  // true/false
  namaPribadi: '',
  titipan: [],         // {key,nama}
  titipanNominal: {},  // {kantongKey: total} — cara utama, tanpa memilah tempat
  modeRinci: false,    // true kalau pengguna memilih mengatur sendiri per tempat
  matriks: {},         // matriks[akunKey][kantongKey] = nominal
  katKeluar: new Set(),
  katMasuk: new Set(),

  mulai() {
    ['dashboard','transaksi','laporan','profil'].forEach(n => $('#scr-' + n).hidden = true);
    $('#scr-onboarding').hidden = false;
    $('#bottomnav').hidden = true;
    this.katKeluar = new Set(['Makan & Minum','Belanja Harian','Transport','Pulsa & Internet','Lain-lain']);
    this.katMasuk  = new Set(['Gaji','Lain-lain']);
    this.tampil(0);
    this.pasang();
  },

  pasang() {
    $$('[data-ob-next]').forEach(b => b.onclick = () => this.maju());
    $$('[data-ob-back]').forEach(b => b.onclick = () => this.mundur());
    $('#obMasukGoogle').onclick = () => this.masukGoogle();

    $('#obAddAkun').onclick = () => this.dialogAkun();
    $('#obAddKantong').onclick = () => this.dialogKantong();

    $$('#obPunyaTitipan .choice').forEach(b => b.onclick = () => {
      $$('#obPunyaTitipan .choice').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      this.punyaTitipan = b.dataset.val === 'ya';
      $('#obTitipanWrap').hidden = !this.punyaTitipan;
      if (this.punyaTitipan && !this.titipan.length) this.renderKantong();
    });

    $('#obNamaPribadi').oninput = e => this.namaPribadi = e.target.value;
    $('#obNama').oninput  = e => this.nama = e.target.value;
    $('#obEmail').oninput = e => this.email = e.target.value;

    this.renderKategori();
  },

  tampil(s) {
    this.step = s;
    $$('.ob-step').forEach(e => e.hidden = Number(e.dataset.step) !== s);
    $('#obBar').style.width = (s / 6 * 100) + '%';
    $('.ob-wrap').scrollTop = 0;

    if (s === 4) this.renderSaldo();
    if (s === 5) this.renderTitipan();
  },

  /* ── perangkat baru, data lama ──
     Jalan pintas dari layar pertama: masuk Google, ambil spreadsheet
     yang sudah ada, dan lewati onboarding sama sekali. */
  async masukGoogle() {
    const tombol = $('#obMasukGoogle');
    const teksAsli = tombol.textContent;
    tombol.disabled = true;
    tombol.textContent = 'Menghubungi Google…';

    let hasil;
    try {
      hasil = await Store.masukDenganGoogle();
    } catch (e) {
      Modal.buka({
        judul: 'Gagal masuk',
        isi: el('p', { class:'muted', style:'margin:0;white-space:pre-line' }, e.message),
        aksi: [{ label:'Tutup', gaya:'btn-primary' }]
      });
      return;
    } finally {
      tombol.disabled = false;
      tombol.textContent = teksAsli;
    }

    if (hasil.cara === 'ada') {
      masukApp();
      toast(hasil.jumlah + ' transaksi dimuat dari Google Sheets');
      return;
    }

    /* Akunnya benar, tapi belum pernah ada data di sana. Onboarding
       tetap dijalankan; sambungannya dipasang otomatis di akhir. */
    Modal.buka({
      judul: 'Belum ada data di akun itu',
      isi: el('p', { class:'muted', style:'margin:0' },
        (hasil.email ? hasil.email + ' berhasil masuk, tapi b' : 'B') +
        'elum ada catatan DompetQ di Google Drive-nya. ' +
        'Lanjutkan pengaturan awal — datanya akan otomatis tersalin ke sana setelah selesai.'),
      aksi: [{ label:'Lanjutkan', gaya:'btn-primary', aksi: () => this.maju() }]
    });
  },

  maju() {
    const s = this.step;

    if (s === 1) {
      if (!this.nama.trim()) { toast('Isi nama dulu ya'); $('#obNama').focus(); return; }
    }
    if (s === 2) {
      if (!this.akun.length) { toast('Tambahkan minimal satu tempat uang'); return; }
    }
    if (s === 3) {
      if (this.punyaTitipan === null) { toast('Pilih salah satu dulu'); return; }
      if (this.punyaTitipan && !this.titipan.length) {
        toast('Tambahkan minimal satu sumber dana titipan'); return;
      }
      if (this.punyaTitipan && !this.namaPribadi.trim()) this.namaPribadi = 'Sumber utama';
    }
    if (s === 4) {
      // lompati matriks kalau tidak ada titipan
      if (!this.punyaTitipan) { this.tampil(6); return; }
    }
    if (s === 5) {
      if (this.modeRinci) {
        if (this.cekMatriks()) { toast('Masih ada rincian yang belum pas'); return; }
      } else {
        const t = this.totalTitipan(), f = this.totalFisik();
        if (t > f) { toast('Dana titipan melebihi total uang yang ada'); return; }
      }
    }
    if (s === 6) { this.selesai(); return; }

    this.tampil(s + 1);
  },

  mundur() {
    if (this.step === 6 && !this.punyaTitipan) { this.tampil(4); return; }
    this.tampil(Math.max(0, this.step - 1));
  },

  /* ── akun ── */
  dialogAkun() {
    dialogPilihBank(({ seed, nama }) => {
      this.akun.push({
        key: uid('t'), nama,
        bank_kode: seed.kode === 'lainnya' ? '' : seed.kode,
        jenis: seed.jenis, saldo: 0
      });
      this.renderAkun();
    });
  },

  renderAkun() {
    const w = kosong($('#obAkunList'));
    this.akun.forEach(a => {
      w.appendChild(el('div', { class:'chip' }, [
        el('div', { class:'chip-ico' }, inisialAkun(a)),
        el('div', { class:'chip-body' }, [
          el('b', null, a.nama),
          el('small', null, { tunai:'Uang fisik', bank:'Rekening bank',
                              ewallet:'E-wallet', lainnya:'Lainnya' }[a.jenis])
        ]),
        el('button', { class:'chip-x', onclick: () => {
          this.akun = this.akun.filter(x => x.key !== a.key); this.renderAkun();
        }}, '×')
      ]));
    });
  },

  /* ── sumber dana titipan ── */
  dialogKantong() {
    Modal.form({
      judul: 'Sumber dana titipan',
      medan: [{ nama:'nama', label:'Namanya apa?', placeholder:'mis. Kas RT, Arisan, Dana Kegiatan' }],
      onSimpan: (v) => {
        if (!v.nama) return 'Nama tidak boleh kosong.';
        this.titipan.push({ key: uid('t'), nama: v.nama });
        this.renderKantong();
      }
    });
  },

  renderKantong() {
    const w = kosong($('#obKantongList'));
    if (!this.titipan.length) {
      w.appendChild(el('p', { class:'empty', style:'padding:16px' },
        'Belum ada. Tambahkan uang yang kamu pegang tapi bukan milikmu.'));
    }
    this.titipan.forEach((k, i) => {
      w.appendChild(el('div', { class:'chip' }, [
        el('div', { class:'chip-ico', style:`background:${WARNA_KANTONG[(i+1) % WARNA_KANTONG.length]}22;color:${WARNA_KANTONG[(i+1) % WARNA_KANTONG.length]}` }, 'T'),
        el('div', { class:'chip-body' }, [ el('b', null, k.nama), el('small', null, 'Titipan') ]),
        el('button', { class:'chip-x', onclick: () => {
          this.titipan = this.titipan.filter(x => x.key !== k.key); this.renderKantong();
        }}, '×')
      ]));
    });
  },

  /* ── saldo per akun ── */
  renderSaldo() {
    const w = kosong($('#obSaldoList'));
    this.akun.forEach(a => {
      const inp = el('input', { type:'text', inputmode:'numeric', placeholder:'0' });
      pasangFormatAngka(inp);
      tulisAngka(inp, a.saldo);
      inp.addEventListener('input', () => {
        a.saldo = bacaAngka(inp);
        this.hitungTotalFisik();
      });

      w.appendChild(el('div', { class:'saldo-row' }, [
        el('label', null, a.nama),
        el('div', { class:'saldo-in' }, [ el('span', null, 'Rp'), inp ])
      ]));
    });
    this.hitungTotalFisik();
  },

  hitungTotalFisik() {
    const t = this.akun.reduce((s, a) => s + (a.saldo || 0), 0);
    $('#obTotalFisik').textContent = rp(t);
  },

  /* ── dana titipan: total dulu, pemilahan belakangan ──
     Uang titipan sering tersebar di beberapa tempat dan pemegangnya
     jarang hafal pecahannya. Memaksa mengisi matriks di sini membuat
     orang menebak — dan tebakan di aplikasi keuangan lebih buruk
     daripada tidak tahu. Jadi: minta totalnya, sisanya dihitung. */

  totalFisik() {
    return this.akun.reduce((s, a) => s + (a.saldo || 0), 0);
  },

  totalTitipan() {
    return this.titipan.reduce((s, t) => s + (this.titipanNominal[t.key] || 0), 0);
  },

  renderTitipan() {
    const w = kosong($('#obTitipanNominal'));

    this.titipan.forEach((t, i) => {
      const inp = el('input', { type:'text', inputmode:'numeric', placeholder:'0' });
      pasangFormatAngka(inp);
      tulisAngka(inp, this.titipanNominal[t.key] || 0);
      inp.addEventListener('input', () => {
        this.titipanNominal[t.key] = bacaAngka(inp);
        this.hitungTitipan();
        if (this.modeRinci) this.renderMatriks();
      });

      const warna = WARNA_KANTONG[(i + 1) % WARNA_KANTONG.length];
      w.appendChild(el('div', { class:'saldo-row' }, [
        el('label', null, [
          el('span', { class:'kt-dot', style:'background:' + warna + ';display:inline-block;margin-right:7px;vertical-align:-1px' }),
          t.nama
        ]),
        el('div', { class:'saldo-in' }, [ el('span', null, 'Rp'), inp ])
      ]));
    });

    $('#obRinciToggle').onclick = () => {
      this.modeRinci = !this.modeRinci;
      $('#obRinciWrap').hidden = !this.modeRinci;
      $('#obRinciToggle').textContent = this.modeRinci
        ? 'Cukup pakai total saja' : 'Atur sendiri per tempat';
      if (this.modeRinci) this.renderMatriks();
      this.hitungTitipan();
    };

    this.hitungTitipan();
  },

  /* Kartu hitung: total semua tempat − titipan = uang pribadi.
     Inilah pemeriksaan "apakah pas" yang menggantikan matriks. */
  hitungTitipan() {
    const fisik = this.totalFisik();
    const titip = this.modeRinci ? this.titipanRinci() : this.totalTitipan();
    const pribadi = fisik - titip;
    const lebih = pribadi < 0;

    const baris = (label, nilai, kelas) => el('div', { class:'hitung-baris ' + (kelas || '') }, [
      el('span', null, label),
      el('b', null, rp(nilai))
    ]);

    const w = kosong($('#obHitung'));
    w.className = 'hitung' + (lebih ? ' bahaya' : '');
    w.appendChild(baris('Total semua tempat', fisik));
    w.appendChild(baris('Dana titipan', -titip));
    w.appendChild(el('div', { class:'hitung-garis' }));
    w.appendChild(baris(lebih ? 'Kelebihan' : 'Uang kamu sendiri', pribadi, 'hasil'));

    /* teks dibungkus satu span — kalau tidak, <b> di dalamnya ikut
       jadi item flex dan terlempar ke kolom sendiri */
    w.appendChild(el('p', { class:'hitung-pesan', html:
      svgIkon(lebih ? 'peringatan' : 'cek', 15) + '<span>' + (lebih
        ? 'Dana titipan melebihi total uang yang ada. Cek lagi angkanya.'
        : 'Sudah pas. Angka inilah yang muncul sebagai <b>uang saya bersih</b>.') + '</span>'
    }));
  },

  /* jumlah titipan versi rinci, dibaca dari matriks */
  titipanRinci() {
    let n = 0;
    this.akun.forEach(a => {
      const sel = this.matriks[a.key] || {};
      Object.keys(sel).forEach(k => { if (k !== '_pribadi') n += sel[k] || 0; });
    });
    return n;
  },

  /* Menempatkan tiap dana titipan ke tempat dengan saldo terbesar
     yang masih sanggup menampungnya, UTUH — tidak dipecah kecuali
     memang tidak muat.

     Aplikasi butuh matriks akun × sumber dana secara internal, tapi
     pengguna tidak perlu mengisinya. Pembagian proporsional sempat
     dicoba dan hasilnya buruk: "Kas RT Rp 412.011 di BCA" adalah
     angka yang tidak pernah diucapkan siapa pun, dan pengguna jadi
     melihat catatan yang terasa mengada-ada. Penempatan utuh
     menghasilkan angka yang bisa dibaca dan mudah dikoreksi lewat
     transaksi pindah sumber dana kalau ternyata meleset. */
  alokasiOtomatis() {
    const sisa = {};
    const hasil = {};
    this.akun.forEach(a => { sisa[a.key] = a.saldo || 0; hasil[a.key] = {}; });

    this.titipan.forEach(t => {
      let perlu = this.titipanNominal[t.key] || 0;
      if (perlu <= 0) return;

      /* tempat terbesar lebih dulu — paling mungkin memang di situ */
      const urut = this.akun.slice().sort((x, y) => sisa[y.key] - sisa[x.key]);
      for (const a of urut) {
        if (perlu <= 0) break;
        const ambil = Math.min(perlu, sisa[a.key]);
        if (ambil <= 0) continue;
        hasil[a.key][t.key] = (hasil[a.key][t.key] || 0) + ambil;
        sisa[a.key] -= ambil;
        perlu -= ambil;
      }
    });

    /* sisanya milik pengguna sendiri */
    this.akun.forEach(a => {
      if (sisa[a.key] > 0) hasil[a.key]['_pribadi'] = sisa[a.key];
    });

    return hasil;
  },

  /* ── matriks akun × sumber dana (mode rinci, opsional) ── */
  daftarKantong() {
    return [{ key:'_pribadi', nama: this.namaPribadi || 'Sumber utama', jenis:'milik_sendiri' }]
      .concat(this.titipan.map(t => ({ key:t.key, nama:t.nama, jenis:'titipan' })));
  },

  renderMatriks() {
    const w = kosong($('#obMatriks'));
    const kts = this.daftarKantong();

    /* Mulai dari hasil pembagian otomatis, bukan dari nol — pengguna
       tinggal menggeser angka yang sudah mendekati benar. */
    const awal = this.alokasiOtomatis();

    this.akun.forEach(a => {
      if (!this.matriks[a.key] || !Object.keys(this.matriks[a.key]).length) {
        this.matriks[a.key] = Object.assign({}, awal[a.key] || {});
      }

      const card = el('div', { class:'mx-card', 'data-akun': a.key });
      card.appendChild(el('div', { class:'mx-head' }, [
        el('b', null, a.nama),
        el('span', null, rp(a.saldo || 0))
      ]));

      kts.forEach(k => {
        const inp = el('input', { type:'text', inputmode:'numeric', placeholder:'0' });
        pasangFormatAngka(inp);
        tulisAngka(inp, this.matriks[a.key][k.key] || 0);
        inp.addEventListener('input', () => {
          this.matriks[a.key][k.key] = bacaAngka(inp);
          this.updateSelisih(a);
        });

        card.appendChild(el('div', { class:'mx-in' }, [
          el('div', { class:'mx-lab' }, k.nama),
          el('div', { class:'saldo-in' }, [ el('span', null, 'Rp'), inp ])
        ]));
      });

      card.appendChild(el('div', { class:'mx-foot' }));
      w.appendChild(card);
      this.updateSelisih(a);
    });
  },

  updateSelisih(a) {
    const card = $(`.mx-card[data-akun="${a.key}"]`);
    if (!card) return;
    const jml = Object.values(this.matriks[a.key] || {}).reduce((s, v) => s + (v || 0), 0);
    const selisih = (a.saldo || 0) - jml;
    const foot = $('.mx-foot', card);

    if (selisih === 0) {
      foot.className = 'mx-foot ok'; foot.textContent = '✓ Sudah pas';
      card.classList.remove('bad');
    } else if (selisih > 0) {
      foot.className = 'mx-foot bad'; foot.textContent = 'Kurang ' + rp(selisih);
      card.classList.add('bad');
    } else {
      foot.className = 'mx-foot bad'; foot.textContent = 'Lebih ' + rp(-selisih);
      card.classList.add('bad');
    }
    if (this.modeRinci) this.hitungTitipan();
  },

  cekMatriks() {
    return this.akun.some(a => {
      const jml = Object.values(this.matriks[a.key] || {}).reduce((s, v) => s + (v || 0), 0);
      return jml !== (a.saldo || 0);
    });
  },

  /* ── kategori ── */
  renderKategori() {
    const bikin = (wrap, daftar, set) => {
      const w = kosong(wrap);
      daftar.forEach(n => {
        const b = el('button', { class:'pill' + (set.has(n) ? ' sel' : '') }, n);
        b.onclick = () => {
          if (set.has(n)) set.delete(n); else set.add(n);
          b.classList.toggle('sel');
        };
        w.appendChild(b);
      });
    };
    bikin($('#obKatKeluar'), SEED_KATEGORI_KELUAR, this.katKeluar);
    bikin($('#obKatMasuk'),  SEED_KATEGORI_MASUK,  this.katMasuk);
  },

  /* ── selesai ── */
  async selesai() {
    Store.mulaiBaru({ nama: this.nama, email: this.email });

    // akun
    const petaAkun = {};
    this.akun.forEach(a => {
      const baru = Store.tambahAkun({ nama:a.nama, bank_kode:a.bank_kode, jenis:a.jenis });
      petaAkun[a.key] = baru.id;
    });

    // sumber dana
    const petaKantong = {};
    const pribadi = Store.tambahKantong({
      nama: this.punyaTitipan ? (this.namaPribadi || 'Sumber utama') : 'Uang Saya',
      jenis: 'milik_sendiri'
    });
    petaKantong['_pribadi'] = pribadi.id;

    if (this.punyaTitipan) {
      this.titipan.forEach(t => {
        petaKantong[t.key] = Store.tambahKantong({ nama:t.nama, jenis:'titipan' }).id;
      });
    }

    // kategori
    this.katKeluar.forEach(n => Store.tambahKategori({ nama:n, tipe:'pengeluaran' }));
    this.katMasuk.forEach(n  => Store.tambahKategori({ nama:n, tipe:'pemasukan' }));

    // saldo awal → transaksi, satu baris per sel matriks
    const kat = Store.tambahKategori({ nama:'Saldo Awal', tipe:'pemasukan' });
    const waktu = new Date().toISOString();

    /* Mode rinci pakai isian pengguna; mode biasa pakai pembagian
       proporsional dari total yang diisi di langkah 5. */
    const sebaran = this.punyaTitipan
      ? (this.modeRinci ? this.matriks : this.alokasiOtomatis())
      : {};

    this.akun.forEach(a => {
      if (this.punyaTitipan) {
        const sel = sebaran[a.key] || {};
        Object.keys(sel).forEach(kKey => {
          const n = sel[kKey] || 0;
          if (n === 0) return;
          Store.catat({
            timestamp: waktu, jenis:'saldo_awal', nominal: n,
            akun_id: petaAkun[a.key], kantong_id: petaKantong[kKey],
            kategori_id: kat.id, keterangan:'Saldo awal'
          });
        });
      } else if (a.saldo > 0) {
        Store.catat({
          timestamp: waktu, jenis:'saldo_awal', nominal: a.saldo,
          akun_id: petaAkun[a.key], kantong_id: pribadi.id,
          kategori_id: kat.id, keterangan:'Saldo awal'
        });
      }
    });

    await Store.simpanSekarang();
    masukApp();
    toast('Siap dipakai. Selamat mencatat!');

    /* Kalau tadi sudah masuk Google di layar pertama, sambungannya
       dipasang sekarang — tanpa ini pengguna harus menekan
       "Sambungkan" lagi di Profil untuk sesuatu yang sudah mereka
       lakukan lima menit sebelumnya. */
    const cermin = await Store.pasangCerminSetelahOnboarding();
    if (cermin) {
      renderSheets();
      toast(cermin.ok ? 'Tersalin ke Google Sheets'
                      : 'Tersambung, tapi tulis pertama gagal — cek di Profil');
    }
  }
};

/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
function renderDashboard() {
  const db = Store.db;
  const r  = Calc.ringkas(db);
  const sederhana = Store.modeSederhana();

  const rk = Calc.rekonsiliasi(db);
  const cek = $('#cekRekonsiliasi');
  if (cek) {
    cek.hidden = false;
    cek.className = 'rekon ' + (rk.selisih === 0 && !rk.yatim.baris ? 'ok' : 'bahaya');
    cek.textContent = rk.selisih === 0 && !rk.yatim.baris
      ? 'Total semua rekening ' + rp(rk.totalRekening) + ' = total semua sumber dana'
      : 'Tidak cocok: rekening ' + rp(rk.totalRekening) + ', sumber dana ' + rp(rk.totalSumber);
  }

  const jam = new Date().getHours();
  $('#dashSapaan').textContent =
    jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' :
    jam < 19 ? 'Selamat sore' : 'Selamat malam';
  $('#dashNama').textContent = db.profil.nama || 'DompetQ';

  /* kartu utama */
  const bahaya = r.negatifSel.length > 0 || r.yatim.baris > 0;
  $('#heroCard').className = 'hero-card' + (bahaya ? ' alert' : '');
  $('#heroCard').querySelector('small').textContent =
    sederhana ? 'Total uang saya' : 'Uang saya bersih';
  $('#heroBersih').textContent = rp(r.uangSaya);

  const sub = kosong($('#heroSub'));
  if (!sederhana) {
    sub.appendChild(el('div', null, [ 'Total di tangan', el('b', null, rp(r.totalFisik)) ]));
    sub.appendChild(el('div', null, [ 'Bukan milik saya', el('b', null, rp(r.titipan)) ]));
  } else {
    sub.appendChild(el('div', null, [ 'Tersebar di ' + db.akun.length + ' tempat' ]));
  }

  renderSambungLagi();

  /* Uang di tangan memang segitu, tapi sebagian sedang dipinjam orang.
     Yang dihitung hanya piutang dari dana milik sendiri — piutang dari
     dana titipan bukan uang saya. */
  const pt = Calc.piutang(db);
  const hp = kosong($('#heroProyeksi'));
  hp.hidden = !(pt.milikSendiri > 0);
  if (!hp.hidden) {
    hp.appendChild(el('div', { class:'hp-baris' }, [
      el('span', null, 'Masih dipinjam orang'), el('b', null, '+' + rp(pt.milikSendiri))
    ]));
    hp.appendChild(el('div', { class:'hp-baris hp-total' }, [
      el('span', null, 'Seharusnya uang saya'),
      el('span', { style:'display:flex;align-items:center',
                   html:'<b>' + esc(rp(r.uangSaya + pt.milikSendiri)) + '</b>' + CHEVRON })
    ]));
  }

  renderAjakRapikan();

  /* peringatan */
  const wb = kosong($('#warnBox'));
  r.negatifSel.forEach(n => {
    const titipan = n.kantong.jenis === 'titipan';
    wb.appendChild(el('div', { class:'warn' }, [
      el('div', null, [
        el('b', null, n.kantong.nama + ' di ' + n.akun.nama + ' minus ' + rp(Math.abs(n.nilai))),
        titipan
          ? 'Uang titipan tercatat lebih besar dari yang ada di rekening ini. Pindahkan dari sumber dana lain lewat "Pindah".'
          : 'Uang pribadi tercatat lebih besar dari yang ada di rekening ini. Pindahkan dari sumber dana lain lewat "Pindah".'
      ])
    ]));
  });
  /* Pengingat talangan: uang pribadi yang masih nyangkut di dana titipan. */
  Calc.talangan(db).forEach(o => {
    const akhir = o.item[o.item.length - 1];
    wb.appendChild(el('div', { class:'warn amber' }, [
      el('div', { style:'flex:1;min-width:0' }, [
        el('b', null, 'Dana pribadi nyangkut di ' + o.kantong.nama + ' ' + rp(o.sisa)),
        akhir ? (akhir.keterangan || 'Talangan') + ' · ' + tglRelatif(akhir.timestamp) : ''
      ]),
      el('button', { class:'btn btn-sm', style:'align-self:center',
                     onclick: () => dialogGantiTalangan(o) }, 'Sudah diganti')
    ]));
  });

  if (r.yatim.baris > 0) {
    wb.appendChild(el('div', { class:'warn amber' }, [
      el('div', null, [
        el('b', null, rp(r.yatim.nilai) + ' tidak ikut total'),
        'Ada saldo yang merujuk rekening atau sumber dana yang sudah tidak ada. Ditolkan dengan entri penyesuaian; riwayat lama tetap tersimpan.'
      ]),
      el('button', { class:'btn btn-sm', style:'margin-top:8px', onclick: () => {
        Modal.konfirmasi({
          judul:'Nolkan saldo yatim',
          pesan:'Setiap saldo yang merujuk rekening atau sumber dana yang sudah tidak ada akan ditolkan dengan entri penyesuaian. Tidak ada transaksi yang dihapus, dan rekening yang masih ada tidak berubah.',
          labelYa:'Ya, nolkan', gayaYa:'btn-primary',
          onYa: () => { const n = Store.nolkanYatim(); segarkan(); toast(n + ' saldo yatim ditolkan'); }
        });
      } }, 'Nolkan saldo yatim')
    ]));
  }

  renderPengingatBeranda();

  /* ikon judul bagian */
  judulBagian($('#stAkun'), 'dompet', 'Rekening & dompet');
  judulBagian($('#stKantong'), 'lapis', 'Sumber dana');
  judulBagian($('#stTerakhir'), 'jam', 'Terakhir dicatat');

  /* akun */
  const wa = kosong($('#dashAkun'));
  db.akun.filter(a => a.aktif).forEach(a => {
    wa.appendChild(el('div', { class:'acc-card' }, [
      el('small', null, a.nama),
      el('b', null, rp(r.saldoAkun[a.id] || 0))
    ]));
  });
  if (!db.akun.length) wa.appendChild(el('p', { class:'empty' }, 'Belum ada akun.'));

  /* sumber dana */
  $('#dashKantongWrap').hidden = sederhana;
  if (!sederhana) {
    const wk = kosong($('#dashKantong'));
    kantongTampil(r.matriks).forEach(k => {
      const v = r.saldoKantong[k.id] || 0;
      const dipinjam = pt.perKantong[k.id] || 0;
      wk.appendChild(el('div', { class:'kt-row' }, [
        el('div', { class:'kt-dot', style:'background:' + k.warna }),
        el('div', { class:'kt-nm' }, k.nama),
        el('span', { class:'tag ' + (k.jenis === 'titipan' ? 'titipan' : 'milik') }, labelJenis(k)),
        el('div', { class:'kt-val' + (v < 0 ? ' neg' : '') }, rp(v)),
        dipinjam > 0 ? el('div', { class:'kt-pinjam' }, '+' + rp(dipinjam) + ' sedang dipinjam orang') : null
      ]));
    });
  }

  /* grafik 30 hari */
  const kini = new Date();
  const lalu = new Date(kini.getTime() - 30 * 864e5);
  const pk = Calc.perKategori(db, lalu, kini, 'keluar');
  judulBagian($('#stGrafik'), 'grafik', 'Pengeluaran 30 hari', pk.total ? rp(pk.total) : '');
  renderBars($('#dashBars'), pk, 'Belum ada pengeluaran dalam 30 hari terakhir.');

  /* Dibiayai dari mana: hanya berarti kalau ada lebih dari satu sumber
     dana pribadi (mis. Uang Pribadi = pendapatan, KUP = pinjaman). */
  const ws = kosong($('#dashSumberBulan'));
  const pribadi = db.kantong.filter(k => k.jenis === 'milik_sendiri');
  const ps = Calc.pengeluaranPerSumber(db, awalBulan(kini), kini);
  const totalPribadi = pribadi.reduce((s, k) => s + (ps[k.id] || 0), 0);
  $('#dashSumberWrap').hidden = pribadi.length < 2 || !totalPribadi;
  if (!$('#dashSumberWrap').hidden) {
    judulBagian($('#stSumberBulan'), 'lapis', 'Pengeluaran bulan ini dibiayai dari', rp(totalPribadi));
    renderBars(ws, {
      rows: pribadi.filter(k => ps[k.id]).map(k => ({ nama: k.nama, nilai: ps[k.id] }))
        .sort((a, b) => b.nilai - a.nilai)
    }, '');
  }

  /* transaksi terakhir */
  const wt = kosong($('#dashTx'));
  const akhir = db.transaksi.slice().sort((a, b) =>
    new Date(b.dibuat_pada) - new Date(a.dibuat_pada)).slice(0, 5);
  if (!akhir.length) {
    wt.appendChild(kartuKosong('Belum ada transaksi',
      'Tekan tombol + di bawah untuk mencatat yang pertama.'));
  } else {
    akhir.forEach(t => wt.appendChild(barisTx(t)));
  }
}

/* ── batang "sambungkan lagi" ──

   Popup Google hanya boleh dibuka dari dalam penanganan klik, jadi
   sambungan tidak bisa hidup sendiri saat halaman dimuat. Tanpa batang
   ini kegagalan itu tidak terlihat sama sekali: aplikasi tampak
   seperti belum pernah tersambung, catatan dari perangkat lain tidak
   pernah muncul, dan pengguna tidak diberi satu pun petunjuk bahwa
   yang kurang hanyalah satu ketukan. */
function renderSambungLagi() {
  const w = kosong($('#sambungBox'));
  if (!perluSambungLagi) return;

  const jalan = async (tombol) => {
    tombol.disabled = true;
    tombol.textContent = 'Menyambungkan…';
    let hasil;
    try {
      hasil = await Store.sambungLagi();
    } catch (e) {
      perluSambungLagi = Google.sesiTersimpan() && Google.sesiTersimpan().email;
      renderDashboard();
      toast(e.message);
      return;
    }
    await terapkanHasilPulih(hasil);
    if (Store.sinkron.aktif) toast('Tersambung lagi ke Google Sheets');
  };

  w.appendChild(el('div', { class:'sambung-bar' }, [
    el('div', { class:'sambung-ikon', html: svgIkon('awan', 17) }),
    el('div', { class:'sambung-body' }, [
      el('b', null, 'Google Sheets belum aktif'),
      el('small', null, perluSambungLagi + ' — ketuk untuk mengambil catatan dari perangkat lain')
    ]),
    el('button', { class:'btn btn-sm btn-primary',
                   onclick: (e) => jalan(e.currentTarget) }, 'Sambungkan')
  ]));
}

/* ── pengingat di beranda ──

   Pop-up saat aplikasi dibuka gampang ditutup refleks, dan sesudah
   ditutup tidak ada jejaknya sampai aplikasi dibuka lagi besok.
   Di beranda ia tetap ada: selama belum dijawab, ia masih di sana
   setiap kali pengguna melihat saldonya.

   Yang sudah jatuh tempo tampil sebagai kartu lengkap dengan
   tombolnya. Yang belum tampil sebagai satu baris tenang — cukup
   untuk tahu apa yang sedang menunggu, tidak cukup untuk mengganggu. */
function renderPengingatBeranda() {
  const db = Store.db;
  const wrap = $('#dashPengingatWrap');

  /* Belum pernah membuat pengingat sama sekali → bagian ini tidak
     ada. Beranda bukan tempat menawarkan fitur. */
  if (!(db.pengingat || []).some(p => p.aktif)) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const jatuh = Pengingat.perluDitanya(db);
  const nanti = Pengingat.berikutnya(db);
  const w = kosong($('#dashPengingat'));

  judulBagian($('#stPengingatDash'), 'jam', 'Pengingat',
              jatuh.length ? jatuh.length + ' menunggu' : '');

  jatuh.forEach(item => w.appendChild(kartuPengingat(item)));

  /* Tiga saja. Sisanya ada di Profil — beranda tidak boleh berubah
     jadi daftar jadwal. */
  nanti.slice(0, jatuh.length ? 1 : 3).forEach(item => {
    w.appendChild(barisPengingatNanti(item));
  });
}

/* ── baris pengingat yang belum jatuh tempo ──

   Dulu baris ini cuma kabar: tidak bisa disentuh. Padahal cicilan
   justru sering dibayar SEBELUM tanggalnya — begitu tagihannya sampai,
   bukan begitu jatuh temponya tiba. Tanpa jalan mencatatnya di sini,
   pembayaran itu masuk sebagai pengeluaran biasa dan pengingatnya
   tetap bertanya di tanggal jatuh tempo, menanyakan sesuatu yang sudah
   dibayar seminggu sebelumnya.

   Tombolnya sengaja kecil dan tanpa warna: barisnya tetap kabar,
   bukan ajakan. */
function barisPengingatNanti(item) {
  const p = item.p;
  const lunas = item.dibayarDimuka;

  const ket = lunas
    ? 'Sudah dicatat · berikutnya ' + tglSingkat(item.jatuh)
    : Pengingat.teksSisa(item.sisa) + (p.nominal ? ' · ' + rp(p.nominal) : '');

  /* Tombol mencatat SELALU ada, juga pada baris yang sudah lunas —
     item.jatuh di situ sudah menunjuk periode berikutnya yang belum
     dibayar. Melunasi dua bulan sekaligus adalah hal biasa, dan tanpa
     ini pengguna harus membatalkan tandanya dulu hanya untuk bisa
     membayar lagi. */
  const aksi = el('div', { class:'igt-nanti-aksi-wrap' });
  if (lunas) {
    aksi.appendChild(el('button', {
      class:'igt-nanti-aksi batal',
      onclick: () => batalPengingatDimuka(item)
    }, 'Batal'));
  }
  aksi.appendChild(el('button', {
    class:'igt-nanti-aksi',
    onclick: () => catatPengingatDimuka(item)
  }, p.arah === 'masuk' ? 'Terima' : 'Bayar'));

  return el('div', { class:'igt-nanti' + (lunas ? ' lunas' : '') }, [
    lunas
      ? el('div', { class:'igt-lunas-ikon', html: svgIkon('cek', 13) })
      : el('div', { class:'igt-titik ' + (p.arah === 'masuk' ? 'masuk' : 'keluar') }),
    el('div', { class:'igt-nanti-body' }, [
      el('b', null, p.judul),
      el('small', null, ket)
    ]),
    aksi
  ]);
}

/* Mencatat pembayaran untuk periode yang BELUM jatuh tempo.

   Dua tanggal yang berbeda, dan bedanya penting:
     tanggal transaksi — hari ini, karena uangnya keluar hari ini
     periode yang ditandai — jatuh tempo mendatang yang dilunasi
   Kalau keduanya disamakan, transaksinya tercatat di masa depan dan
   saldo bulan ini terlihat lebih besar dari kenyataan. */
function catatPengingatDimuka(item) {
  const p = item.p;
  bukaInputDariPengingat(p, new Date(), tglInput(item.jatuh));

  /* Jatuh temponya disebutkan di dalam formulir — lewat TX, bukan
     ditempel langsung ke DOM. renderTxRows menggambar ulang isinya
     tiap kali jenis atau pilihan berubah, jadi catatan yang ditempel
     akan hilang pada sentuhan pertama. */
  TX.pengingat.dimuka = tglPanjang(item.jatuh);
  renderTxRows();
}

function batalPengingatDimuka(item) {
  Modal.konfirmasi({
    judul: 'Batalkan tanda sudah dibayar?',
    pesan: 'Pengingat "' + item.p.judul + '" akan bertanya lagi pada jatuh tempo terdekat. ' +
           'Transaksi yang sudah kamu catat TIDAK ikut terhapus — kalau memang salah catat, ' +
           'koreksi transaksinya lewat tab Transaksi.',
    labelYa: 'Ya, batalkan', gayaYa: 'btn-primary',
    onYa: () => { Pengingat.batalDimuka(item.p); segarkan(); toast('Tanda dilepas'); }
  });
}

function kartuPengingat(item) {
  const p = item.p;
  const masuk = p.arah === 'masuk';

  const kartu = el('div', { class:'igt-kartu' }, [
    el('div', { class:'igt-kepala' }, [
      el('div', { class:'tx-ico ' + (masuk ? 'masuk' : 'keluar') }, masuk ? '+' : '−'),
      el('div', { class:'igt-judul' }, [
        el('b', null, p.judul),
        el('small', null, 'Jatuh ' + Pengingat.teksTelat(item.telat) +
          (p.nominal ? ' · ' + rp(p.nominal) : ''))
      ])
    ]),
    el('p', { class:'igt-tanya' }, masuk ? 'Uangnya sudah kamu terima?' : 'Sudah kamu bayar?'),
    el('div', { class:'igt-aksi' }, [
      el('button', { class:'btn btn-sm btn-ghost', onclick: () => {
        Pengingat.tundaSehari(p); renderDashboard(); toast('Diingatkan lagi besok');
      }}, 'Nanti'),
      el('button', { class:'btn btn-sm btn-ghost', onclick: () => {
        Pengingat.lewati(p); renderDashboard(); toast('Periode ini dilewati');
      }}, 'Lewati'),
      el('button', { class:'btn btn-sm btn-primary', onclick: () => {
        /* Belum ditandai terpenuhi di sini — lihat catatan di
           bukaInputDariPengingat. */
        bukaInputDariPengingat(p, item.jatuh, item.jatuhStr);
      }}, 'Catat')
    ])
  ]);

  return kartu;
}

/* Keadaan kosong dengan maskot — layar kosong yang cuma berisi teks
   abu-abu terasa seperti aplikasi rusak, bukan aplikasi baru. */
function kartuKosong(judul, pesan) {
  return el('div', { class:'kosong-kartu' }, [
    el('img', { src:'img/maskot.png', alt:'', class:'kosong-maskot' }),
    el('b', null, judul),
    el('small', null, pesan)
  ]);
}

function renderBars(wrap, pk, kosongPesan) {
  const w = kosong(wrap);
  if (!pk.rows.length) {
    w.appendChild(el('p', { class:'empty' }, kosongPesan));
    return;
  }
  const maks = pk.rows[0].nilai || 1;
  pk.rows.slice(0, 8).forEach(r => {
    w.appendChild(el('div', { class:'bar-row' }, [
      el('div', { class:'bar-top' }, [
        el('span', null, r.nama),
        el('b', null, rp(r.nilai))
      ]),
      el('div', { class:'bar-track' }, [
        el('div', { class:'bar-fill', style:'width:' + Math.max(3, r.nilai / maks * 100) + '%' })
      ])
    ]));
  });
}

/* satu baris transaksi */
function barisTx(t) {
  const db = Store.db;
  const transfer = t.jenis === 'transfer_akun' || t.jenis === 'transfer_kantong';
  const gaya = transfer ? 'transfer' : (t.jenis === 'keluar' ? 'keluar' : 'masuk');
  const dikoreksi = Store.sudahDikoreksi(t.id);

  const awalan = t.reversal_dari ? 'Koreksi — ' : '';
  let judul, ket;
  if (t.jenis === 'transfer_akun') {
    judul = awalan + 'Pindah tempat';
    ket = (Store.akun(t.akun_id) || {}).nama + ' → ' + (Store.akun(t.akun_tujuan_id) || {}).nama;
  } else if (t.jenis === 'transfer_kantong') {
    judul = awalan + 'Pindah sumber dana';
    ket = (Store.kantong(t.kantong_id) || {}).nama + ' → ' + (Store.kantong(t.kantong_tujuan_id) || {}).nama;
  } else {
    const k = Store.kategori(t.kategori_id);
    const ph = t.pihak_id ? Store.pihak(t.pihak_id) : null;
    judul = t.keterangan || (ph
      ? (t.jenis === 'keluar' ? 'Pinjaman ke ' : 'Pembayaran dari ') + ph.nama
      : (k ? k.nama : namaJenis(t.jenis)));
    const bagian = [ (Store.akun(t.akun_id) || {}).nama ];
    if (!Store.modeSederhana()) bagian.push((Store.kantong(t.kantong_id) || {}).nama);
    if (k && t.keterangan) bagian.unshift(k.nama);
    if (ph && t.keterangan) bagian.unshift(ph.nama);
    ket = bagian.filter(Boolean).join(' · ');
  }

  const tanda = transfer ? '' : (t.jenis === 'keluar' ? '−' : '+');
  const row = el('div', { class:'tx', style: dikoreksi ? 'opacity:.45' : null }, [
    el('div', { class:'tx-ico ' + gaya }, transfer ? '⇄' : (t.jenis === 'keluar' ? '−' : '+')),
    el('div', { class:'tx-mid' }, [
      el('b', null, judul + (dikoreksi ? ' (dikoreksi)' : '')),
      el('small', null, ket + ' · ' + tglRelatif(t.timestamp))
    ]),
    el('div', { class:'tx-amt ' + gaya }, tanda + rp(t.nominal, { tanpaRp:false }))
  ]);

  row.onclick = () => detailTx(t);
  return row;
}

function detailTx(t) {
  const dikoreksi = Store.sudahDikoreksi(t.id);
  const baris = [];
  const tambah = (l, v) => v && baris.push(`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)"><span class="muted">${l}</span><b style="text-align:right">${esc(v)}</b></div>`);

  tambah('Jenis', namaJenis(t.jenis));
  tambah('Nominal', rp(t.nominal));
  tambah('Tanggal', tglPanjang(t.timestamp));
  tambah('Tempat', (Store.akun(t.akun_id) || {}).nama);
  if (t.akun_tujuan_id) tambah('Ke tempat', (Store.akun(t.akun_tujuan_id) || {}).nama);
  if (!Store.modeSederhana()) {
    tambah('Sumber dana', (Store.kantong(t.kantong_id) || {}).nama);
    if (t.kantong_tujuan_id) tambah('Ke sumber dana', (Store.kantong(t.kantong_tujuan_id) || {}).nama);
  }
  tambah('Kategori', (Store.kategori(t.kategori_id) || {}).nama);
  tambah(t.jenis === 'keluar' ? 'Dipinjam oleh' : 'Dibayar oleh',
         t.pihak_id && (Store.pihak(t.pihak_id) || {}).nama);
  tambah('Keterangan', t.keterangan);
  tambah('Dicatat', tglPanjang(t.dibuat_pada));
  if (t.koreksi_dari) tambah('Asal', 'Hasil koreksi transaksi sebelumnya');

  const bisaDiubah = !dikoreksi && !t.reversal_dari;
  const isi = el('div', { style:'margin:-6px 0 0' });
  isi.appendChild(el('div', { html: baris.join('') }));

  /* Pilihan kedua sengaja dibuat kecil dan di bawah: yang dibutuhkan
     sehari-hari adalah MEMPERBAIKI isian, bukan membatalkan. */
  if (bisaDiubah) {
    isi.appendChild(el('button', {
      class:'tx-batal-tautan',
      onclick: () => {
        Modal.tutup();
        Modal.konfirmasi({
          judul:'Batalkan transaksi',
          pesan:'Transaksi asli tetap tersimpan sebagai riwayat, lalu ditambahkan entri pembalik. Saldo kembali seperti sebelum transaksi ini.',
          labelYa:'Ya, batalkan', gayaYa:'btn-primary',
          onYa: () => { Store.batalkan(t.id); segarkan(); toast('Transaksi dibatalkan'); }
        });
      }
    }, 'Batalkan saja, tanpa diganti'));
  }

  const aksi = [{ label:'Tutup' }];
  if (bisaDiubah) {
    aksi.push({
      label:'Koreksi', gaya:'btn-primary',
      /* Modal.buka menimpa modal yang sama, jadi menutupnya SETELAH
         aksi berjalan akan langsung menutup dialog berikutnya. */
      tutup: false,
      aksi: () => { Modal.tutup(); bukaInputKoreksi(t); }
    });
  }

  Modal.buka({
    judul: dikoreksi ? 'Transaksi (sudah dikoreksi)' : 'Detail transaksi',
    isi,
    aksi
  });
}

/* ══════════════════════════════════════════════
   INPUT TRANSAKSI
   ══════════════════════════════════════════════ */
const TX = { jenis:'keluar', sub:'akun', akun_id:'', akun_tujuan_id:'',
             kantong_id:'', kantong_tujuan_id:'', kategori_id:'',
             /* diisi hanya kalau formulir ini dibuka dari sebuah
                pengingat: { id, jatuhStr } */
             pengingat: null,
             /* id transaksi yang sedang dikoreksi — kalau terisi, menyimpan
                berarti membalik baris lama lalu mencatat baris baru */
             edit: null,
             /* jenis asli baris yang dikoreksi. 'saldo_awal' tidak punya
                tombolnya sendiri di segmen, jadi harus diingat terpisah
                supaya tidak berubah diam-diam jadi pemasukan biasa. */
             jenisAsli: '',
             /* terisi hanya saat formulir dipakai untuk piutang:
                { arah:'keluar'|'masuk', pihak_id }. Jenis dikunci, kategori
                diisi otomatis, dan transaksinya bertanda peminjam. */
             piutang: null,
             /* 'milik_sendiri' | 'titipan' — langkah pertama memilih sumber */
             jenisUang: null,
             /* centang "talangi dulu pakai uang pribadi" untuk pengeluaran titipan */
             talangan: false };

function pasangSheetInput() {
  pasangFormatAngka($('#txNominal'));

  $$('#txJenis button').forEach(b => b.onclick = () => {
    $$('#txJenis button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    TX.jenis = b.dataset.j;
    TX.kategori_id = '';
    renderTxRows();
  });

  $('#txCancel').onclick = tutupInput;
  $('#sheetBackdrop').onclick = tutupInput;
  /* garis di atas sheet: ditekan atau ditarik ke bawah = tutup.
     Refleks yang sudah dipunyai semua orang dari aplikasi lain. */
  $('#sheetGrip').onclick = tutupInput;
  pasangTarikTutup($('#sheetInput'), $('#sheetGrip'), tutupInput);
  $('#modalBackdrop').onclick = () => Modal.tutup();
  $('#txSave').onclick = simpanTx;
}

/* Sumber dana milik sendiri yang paling banyak isinya di rekening ini.
   Default formulir mengikuti ini, bukan sumber dana default global —
   kalau tidak, rekening berisi 61 juta di KUP bPd tampak "Rp 0" hanya
   karena Uang Pribadi kebetulan kosong. */
/* Label jenis sumber dana. Pribadi/Titipan adalah ATRIBUT sumber dana,
   bukan sumber dana itu sendiri. */
function labelJenis(k) { return k.jenis === 'titipan' ? 'Titipan' : 'Pribadi'; }

/* Sumber dana yang ditampilkan di daftar: yang aktif, plus yang diarsipkan
   tapi ternyata masih punya saldo — uang tidak boleh tersembunyi. */
function kantongTampil(m) {
  m = m || Calc.matriks(Store.db);
  const adaIsi = id => Object.keys(m).some(ak => (m[ak][id] || 0) !== 0);
  return Store.db.kantong.filter(k => !k.arsip || adaIsi(k.id));
}

function bukaInput() {
  /* Default selalu sumber dana pribadi default (mis. Uang Pribadi =
     pendapatan). Sumber lain (mis. pinjaman KUP) hanya dipakai kalau
     dipilih sendiri atau disetujui saat Uang Pribadi kurang — supaya
     terlihat kapan pengeluaran mulai memakan uang pinjaman. */
  const ak = Store.akunDefault();
  const kt = Store.kantongDefault();
  if (!ak || !kt) { toast('Tambahkan akun dulu di Profil'); return; }

  TX.jenis = 'keluar'; TX.sub = 'akun';
  TX.akun_id = ak.id; TX.akun_tujuan_id = '';
  TX.kantong_id = kt.id; TX.kantong_tujuan_id = '';
  TX.kategori_id = '';
  TX.pengingat = null;
  TX.edit = null;
  TX.jenisAsli = '';
  TX.piutang = null;
  TX.jenisUang = null;
  TX.talangan = false;
  $('#txJenis').hidden = false;
  judulSheet('');

  $$('#txJenis button').forEach(x => x.classList.toggle('active', x.dataset.j === 'keluar'));
  $('#txNominal').value = '';
  $('#txKet').value = '';
  $('#txTgl').value = tglInput(new Date());
  $('#txSave').textContent = 'Simpan';
  $('#txError').hidden = true;

  renderTxRows();
  $('#sheetBackdrop').hidden = false;
  $('#sheetInput').hidden = false;
  setTimeout(() => $('#txNominal').focus(), 120);
}

function tutupInput() {
  $('#sheetBackdrop').hidden = true;
  $('#sheetInput').hidden = true;
  $('#sheetInput').style.transform = '';
  TX.edit = null;
  TX.jenisAsli = '';
  TX.piutang = null;
  TX.jenisUang = null;
  TX.talangan = false;
  $('#txJenis').hidden = false;
  judulSheet('');
  $('#txSave').textContent = 'Simpan';
}

/* judul sheet — kosong = formulir catat biasa (tanpa judul, seperti dulu) */
function judulSheet(teks) {
  const j = $('#txJudul');
  if (!j) return;
  j.textContent = teks || '';
  j.hidden = !teks;
}

/* Buka formulir yang sama seperti mencatat, tapi sudah terisi data
   transaksi lama. Semua isian bisa diubah: jenis, nominal, tanggal,
   tempat, sumber dana, kategori, dan keterangan. */
function bukaInputKoreksi(t) {
  if (!t || t.reversal_dari || Store.sudahDikoreksi(t.id)) {
    toast('Transaksi ini tidak bisa dikoreksi');
    return;
  }
  bukaInput();

  TX.edit = t.id;
  TX.jenisAsli = t.jenis;
  TX.akun_id = t.akun_id || '';
  TX.akun_tujuan_id = t.akun_tujuan_id || '';
  TX.kantong_id = t.kantong_id || '';
  TX.kantong_tujuan_id = t.kantong_tujuan_id || '';
  TX.kategori_id = t.kategori_id || '';
  TX.jenisUang = null;

  if (t.jenis === 'transfer_akun')          { TX.jenis = 'transfer'; TX.sub = 'akun'; }
  else if (t.jenis === 'transfer_kantong')  { TX.jenis = 'transfer'; TX.sub = 'kantong'; }
  else if (t.jenis === 'saldo_awal')        { TX.jenis = 'masuk';    TX.sub = 'akun'; }
  else                                      { TX.jenis = t.jenis;    TX.sub = 'akun'; }

  $$('#txJenis button').forEach(x => x.classList.toggle('active', x.dataset.j === TX.jenis));
  tulisAngka($('#txNominal'), t.nominal);
  $('#txKet').value = t.keterangan || '';
  $('#txTgl').value = tglInput(t.timestamp);
  judulSheet('Koreksi transaksi');
  $('#txSave').textContent = 'Simpan koreksi';

  /* Transaksi piutang tetap piutang saat dikoreksi — kalau tidak, tandanya
     hilang diam-diam dan pinjamannya jatuh balik jadi pengeluaran biasa. */
  const ph = t.pihak_id && Store.pihak(t.pihak_id);
  if (ph && ph.tipe === 'peminjam' && (t.jenis === 'keluar' || t.jenis === 'masuk')) {
    TX.piutang = { arah: t.jenis, pihak_id: t.pihak_id };
    $('#txJenis').hidden = true;
  }

  renderTxRows();
  setTimeout(() => $('#txNominal').focus(), 120);
}

/* Tarik ke bawah untuk menutup. Hanya dari gagang — kalau seluruh
   permukaan sheet bisa ditarik, menggulir isi form jadi kacau. */
function pasangTarikTutup(sheet, gagang, tutup) {
  let mulai = null;

  const turun = e => {
    mulai = (e.touches ? e.touches[0] : e).clientY;
    sheet.style.transition = 'none';
  };
  const geser = e => {
    if (mulai === null) return;
    const y = (e.touches ? e.touches[0] : e).clientY - mulai;
    if (y > 0) sheet.style.transform = 'translateY(' + y + 'px)';
  };
  const lepas = e => {
    if (mulai === null) return;
    const y = (e.changedTouches ? e.changedTouches[0] : e).clientY - mulai;
    mulai = null;
    sheet.style.transition = '';
    if (y > 90) tutup(); else sheet.style.transform = '';
  };

  gagang.addEventListener('touchstart', turun, { passive:true });
  gagang.addEventListener('touchmove', geser, { passive:true });
  gagang.addEventListener('touchend', lepas);
  gagang.addEventListener('mousedown', turun);
  document.addEventListener('mousemove', geser);
  document.addEventListener('mouseup', lepas);
}

/* baris pemilih */
function pickRow(label, nilai, placeholder, onClick, warna) {
  return el('button', { class:'pick', onclick:onClick }, [
    el('span', { class:'pk-lab' }, label),
    el('span', { class:'pk-val' + (nilai ? '' : ' ph'), html:
      (warna ? `<i style="width:8px;height:8px;border-radius:50%;background:${warna};display:inline-block"></i> ` : '') +
      esc(nilai || placeholder) + CHEVRON })
  ]);
}

function renderTxRows() {
  const db = Store.db;
  const w = kosong($('#txRows'));
  const sederhana = Store.modeSederhana();

  /* sub-pilihan untuk transfer */
  if (TX.jenis === 'transfer' && !sederhana) {
    const seg = el('div', { class:'seg', style:'margin-bottom:2px' });
    [['akun','Antar tempat'], ['kantong','Antar sumber dana']].forEach(([v, t]) => {
      seg.appendChild(el('button', {
        class: TX.sub === v ? 'active' : '',
        onclick: () => { TX.sub = v; renderTxRows(); }
      }, t));
    });
    w.appendChild(seg);
  } else if (TX.jenis === 'transfer') {
    TX.sub = 'akun';
  }

  /* dihitung sekali, bukan sekali per akun — Calc.ringkas menelusuri
     seluruh transaksi, memanggilnya di dalam map() jadi O(akun × transaksi) */
  const saldoAkun = Calc.ringkas(db).saldoAkun;

  const pilihAkun = (field, judul) => () => Modal.pilih({
    judul,
    opsi: db.akun.filter(a => a.aktif).map(a => ({
      id:a.id, nama:a.nama, ikon:inisialAkun(a),
      kanan: rp(saldoAkun[a.id] || 0)
    })),
    terpilih: TX[field],
    onPilih: o => {
      TX[field] = o.id;
      renderTxRows();
    },
    tambah: { label:'+ Tambah tempat baru', aksi: () => dialogTambahAkun(id => { TX[field] = id; renderTxRows(); }) }
  });

  const pilihKantong = (field, judul, jenis) => () => {
    const selAkun = Calc.matriks(db)[TX.akun_id] || {};
    const namaAk = (Store.akun(TX.akun_id) || {}).nama || '';
    return Modal.pilih({
    judul,
    opsi: Store.kantongAktif().filter(k => !jenis || k.jenis === jenis).map(k => ({
      id:k.id, nama:k.nama, ikon: k.jenis === 'titipan' ? 'T' : 'P', warna:k.warna,
      ket: labelJenis(k) + (namaAk ? ' · isi di ' + namaAk : ''),
      kanan: rp(selAkun[k.id] || 0)
    })),
    terpilih: TX[field],
    onPilih: o => { TX[field] = o.id; renderTxRows(); }
  });
  };

  const namaAkun = id => (Store.akun(id) || {}).nama;
  const objKantong = id => Store.kantong(id) || {};

  /* Dua langkah: jenis uang (pribadi/titipan), lalu sumbernya — hanya dari
     jenis itu. Sumber titipan wajib dipilih sendiri, supaya uang satu pihak
     (mis. titipan ibu) tidak pernah keluar dari sumber pihak lain (kas RT). */
  const barisSumber = judul => {
    const aktif = Store.kantongAktif();
    const adaTitipan = aktif.some(k => k.jenis === 'titipan');
    const jumlahPribadi = aktif.filter(k => k.jenis !== 'titipan').length;
    if (!adaTitipan && jumlahPribadi <= 1) return;

    const k = objKantong(TX.kantong_id);
    const jenisKini = TX.jenisUang || k.jenis || 'milik_sendiri';
    TX.jenisUang = jenisKini;

    if (adaTitipan) {
      const seg = el('div', { class:'seg' });
      [['milik_sendiri', 'Uang pribadi'], ['titipan', 'Uang titipan']].forEach(([v, t]) => {
        seg.appendChild(el('button', {
          class: jenisKini === v ? 'active' : '',
          onclick: () => {
            if (TX.jenisUang === v) return;
            TX.jenisUang = v;
            TX.kantong_id = v === 'titipan' ? '' : Store.kantongDefault().id;
            renderTxRows();
          }
        }, t));
      });
      w.appendChild(seg);
    }

    const cocok = k.id && k.jenis === jenisKini;
    w.appendChild(pickRow(jenisKini === 'titipan' ? 'Titipan dari' : 'Sumber uang pribadi',
      cocok ? k.nama : '', jenisKini === 'titipan' ? 'Wajib dipilih' : 'Pilih',
      pilihKantong('kantong_id', judul, jenisKini), cocok ? k.warna : null));

    /* Talangan: belanja untuk titipan dibayar dulu pakai uang pribadi,
       lalu tercatat sebagai dana pribadi yang nyangkut sampai diganti. */
    if (jenisKini === 'titipan' && TX.jenis === 'keluar' && !TX.piutang && !TX.edit) {
      const cb = el('input', { type:'checkbox' });
      cb.checked = !!TX.talangan;
      cb.onchange = () => { TX.talangan = cb.checked; };
      w.appendChild(el('label', { class:'talangan-cek' }, [
        cb, el('span', null, 'Talangi dulu pakai uang pribadi (dicatat sebagai rembes)')
      ]));
    }
  };

  if (TX.jenis === 'keluar' || TX.jenis === 'masuk') {
    if (TX.piutang) {
      const ph = Store.pihak(TX.piutang.pihak_id);
      w.appendChild(pickRow(TX.piutang.arah === 'keluar' ? 'Dipinjam oleh' : 'Dibayar oleh',
        ph ? ph.nama : '', 'Pilih orang', () => pilihPeminjam({
          judul: TX.piutang.arah === 'keluar' ? 'Dipinjamkan ke siapa?' : 'Dibayar oleh siapa?',
          terpilih: TX.piutang.pihak_id,
          onPilih: p => { TX.piutang.pihak_id = p.id; renderTxRows(); }
        })));
    }

    w.appendChild(pickRow(TX.piutang && TX.piutang.arah === 'masuk' ? 'Masuk ke tempat' : 'Dari / ke tempat',
      namaAkun(TX.akun_id), 'Pilih', pilihAkun('akun_id', 'Pilih tempat')));

    barisSumber(TX.jenis === 'keluar' ? 'Uang siapa yang dipakai?' : 'Uang ini milik siapa?');

    const tipe = TX.jenis === 'keluar' ? 'pengeluaran' : 'pemasukan';
    const kat = Store.kategori(TX.kategori_id);
    if (!TX.piutang) w.appendChild(pickRow('Kategori', kat ? kat.nama : '', 'Pilih', () => Modal.pilih({
      judul:'Kategori ' + tipe,
      opsi: db.kategori.filter(k => k.tipe === tipe).map(k => ({ id:k.id, nama:k.nama })),
      terpilih: TX.kategori_id,
      onPilih: o => { TX.kategori_id = o.id; renderTxRows(); },
      tambah: { label:'+ Kategori baru', aksi: () => Modal.form({
        judul:'Kategori baru',
        medan:[{ nama:'nama', label:'Nama kategori', placeholder:'mis. Servis motor' }],
        onSimpan: v => {
          if (!v.nama) return 'Nama tidak boleh kosong.';
          TX.kategori_id = Store.tambahKategori({ nama:v.nama, tipe }).id;
          renderTxRows();
        }
      })}
    })));

  } else if (TX.sub === 'akun') {
    w.appendChild(pickRow('Dari', namaAkun(TX.akun_id), 'Pilih', pilihAkun('akun_id', 'Dari mana?')));
    w.appendChild(pickRow('Ke', namaAkun(TX.akun_tujuan_id), 'Pilih', pilihAkun('akun_tujuan_id', 'Ke mana?')));
    barisSumber('Uang siapa yang dipindah?');
    if (!sederhana) {
      w.appendChild(el('p', { class:'fineprint', style:'margin:2px 0 0' },
        'Uang cuma berpindah tempat. Kepemilikannya tidak berubah, dan ini bukan pengeluaran.'));
    }

  } else {
    w.appendChild(pickRow('Di tempat', namaAkun(TX.akun_id), 'Pilih', pilihAkun('akun_id', 'Uangnya ada di mana?')));
    const a = objKantong(TX.kantong_id), b = objKantong(TX.kantong_tujuan_id);
    w.appendChild(pickRow('Dari sumber dana', a.nama, 'Pilih', pilihKantong('kantong_id', 'Dari sumber dana mana?'), a.warna));
    w.appendChild(pickRow('Ke sumber dana', b.nama, 'Pilih', pilihKantong('kantong_tujuan_id', 'Ke sumber dana mana?'), b.warna));
    w.appendChild(el('p', { class:'fineprint', style:'margin:2px 0 0' },
      'Mis. menutup kas pakai uang pribadi. Uang tetap di tempat yang sama, hanya kepemilikannya berpindah.'));
  }

  /* Pembayaran di muka: periode yang dilunasi berbeda dari tanggal
     transaksinya, dan bedanya harus terbaca sebelum menekan simpan. */
  if (TX.pengingat && TX.pengingat.dimuka) {
    w.appendChild(el('p', { class:'fineprint', style:'margin:2px 0 0' },
      'Untuk jatuh tempo ' + TX.pengingat.dimuka +
      '. Tanggal di bawah tetap hari uangnya benar-benar berpindah.'));
  }
}

function simpanTx() {
  const err = $('#txError');
  const gagal = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;

  const nominal = bacaAngka($('#txNominal'));
  if (nominal <= 0) return gagal('Nominal belum diisi.');
  if (!TX.akun_id) return gagal('Pilih tempat uangnya dulu.');

  /* Yang diperiksa adalah OBJEKNYA, bukan id-nya terisi atau tidak.
     Id bisa menunjuk rekening/sumber dana/kategori yang sudah tidak
     ada — misalnya dari pengingat lama. Transaksi seperti itu
     tersimpan diam-diam lalu tidak muncul di kartu rekening mana pun. */
  if (!Store.akun(TX.akun_id))
    return gagal('Tempat uangnya sudah tidak ada. Pilih ulang.');
  if (!TX.kantong_id)
    return gagal(TX.jenisUang === 'titipan' ? 'Pilih titipan dari siapa.' : 'Pilih sumber dananya dulu.');
  if (!Store.kantong(TX.kantong_id))
    return gagal('Sumber dananya sudah tidak ada. Pilih ulang.');

  const tgl = $('#txTgl').value;
  const kini = new Date();
  const stamp = tgl
    ? new Date(tgl + 'T' + pad2(kini.getHours()) + ':' + pad2(kini.getMinutes()) + ':00').toISOString()
    : kini.toISOString();

  let calon = {
    timestamp: stamp, nominal,
    akun_id: TX.akun_id, kantong_id: TX.kantong_id,
    keterangan: $('#txKet').value.trim()
  };

  if (TX.jenis === 'keluar' || TX.jenis === 'masuk') {
    if (TX.piutang) {
      if (!TX.piutang.pihak_id || !Store.pihak(TX.piutang.pihak_id))
        return gagal(TX.piutang.arah === 'keluar' ? 'Pilih siapa yang meminjam.' : 'Pilih siapa yang membayar.');
      calon.pihak_id = TX.piutang.pihak_id;
      /* saat mengoreksi, kategori lama dipertahankan */
      calon.kategori_id = (TX.kategori_id && Store.kategori(TX.kategori_id))
        ? TX.kategori_id : Store.kategoriPiutang(TX.piutang.arah).id;
      calon.jenis = TX.piutang.arah;
    } else {
      if (!TX.kategori_id || !Store.kategori(TX.kategori_id))
        return gagal('Pilih kategori dulu.');
      calon.jenis = TX.jenis;
      calon.kategori_id = TX.kategori_id;
    }
    /* saldo awal yang dikoreksi tetap saldo awal selama arahnya
       tidak diubah pengguna — kalau tidak, angkanya pindah ke
       laporan pemasukan dan arus kas bulan itu ikut melar. */
    if (TX.edit && TX.jenisAsli === 'saldo_awal' && TX.jenis === 'masuk')
      calon.jenis = 'saldo_awal';

  } else if (TX.sub === 'akun') {
    if (!TX.akun_tujuan_id || !Store.akun(TX.akun_tujuan_id))
      return gagal('Pilih tempat tujuan.');
    if (TX.akun_tujuan_id === TX.akun_id) return gagal('Tempat asal dan tujuan tidak boleh sama.');
    calon.jenis = 'transfer_akun';
    calon.akun_tujuan_id = TX.akun_tujuan_id;

  } else {
    if (!TX.kantong_tujuan_id || !Store.kantong(TX.kantong_tujuan_id))
      return gagal('Pilih sumber dana tujuan.');
    if (TX.kantong_tujuan_id === TX.kantong_id) return gagal('Sumber dana asal dan tujuan tidak boleh sama.');
    calon.jenis = 'transfer_kantong';
    calon.kantong_tujuan_id = TX.kantong_tujuan_id;
  }

  /* saldo tidak boleh minus — ditolak, bukan sekadar diperingatkan.
     Saat mengoreksi, baris lama akan dibalik, jadi dampaknya dihitung
     terhadap data TANPA baris itu. Kalau tidak, memperbaiki salah ketik
     nominal besar selalu memunculkan tolakan palsu. */
  if (TX.talangan && calon.jenis === 'keluar' && !TX.edit && !TX.piutang &&
      (Store.kantong(calon.kantong_id) || {}).jenis === 'titipan') {
    if (!Store.catatTalangan(calon, calon.nominal))
      return gagal('Uang pribadi di ' + ((Store.akun(calon.akun_id) || {}).nama || 'rekening ini') +
                   ' tidak cukup untuk menalangi ' + rp(calon.nominal) + '.');
    return selesaiCatatan('Ditalangi uang pribadi · ' + rp(calon.nominal));
  }

  const dbUji = TX.edit
    ? Object.assign({}, Store.db, { transaksi: Store.db.transaksi.filter(t => t.id !== TX.edit) })
    : Store.db;

  /* Pembayaran tidak boleh melebihi sisa piutang orang itu. Kalau memang
     ada bonus atau bunga, catat terpisah sebagai pemasukan biasa. */
  if (TX.piutang && TX.piutang.arah === 'masuk') {
    const o = Calc.piutang(dbUji).orang[TX.piutang.pihak_id];
    const sisa = o ? Math.max(0, o.sisa) : 0;
    if (nominal > sisa) {
      const nama = (Store.pihak(TX.piutang.pihak_id) || {}).nama || 'orang itu';
      return gagal(sisa > 0
        ? `Sisa piutang ${nama} cuma ${rp(sisa)}.`
        : `${nama} tidak punya sisa piutang.`);
    }
  }

  const dampak = Calc.cekDampak(dbUji, calon);
  if (dampak.length) {
    const d = dampak[0];
    /* Namanya diambil lewat penjaga: rujukannya bisa kosong kalau
       akun/kantong sudah terhapus, dan menyusun kalimatnya tidak boleh
       melempar galat sebelum sempat ditampilkan. */
    const namaAkun = (d.akun && d.akun.nama) || 'tempat itu';
    const namaKantong = (d.kantong && d.kantong.nama) || 'Saldo';

    /* Pengeluaran baru (bukan transfer, bukan sedang mengoreksi) masih
       mungkin tertolong: sumber dana yang sama bisa saja masih ada di
       rekening lain. Tawarkan pisah dulu sebelum menolak total —
       dari pada memaksa pengguna mencatatnya manual jadi dua baris. */
    if (calon.jenis === 'keluar' && !TX.edit && d.akun && d.kantong) {
      /* Sumber dana pribadi yang dipilih kurang di rekening ini: tawarkan
         menutup sisanya dari sumber dana pribadi lain DI REKENING YANG SAMA
         (mis. pinjaman KUP). Selalu ditanya — inilah titik di mana
         pengeluaran mulai memakan uang dari sumber lain. Titipan tidak
         pernah ditawarkan otomatis. */
      if (d.kantong.jenis === 'milik_sendiri') {
        const sel = Calc.matriks(dbUji)[calon.akun_id] || {};
        const ada = Math.max(0, sel[calon.kantong_id] || 0);
        let sisa = nominal - ada;
        const legs = ada > 0 ? [Object.assign({}, calon, { nominal: ada })] : [];
        Store.kantongAktif()
          .filter(k => k.id !== calon.kantong_id && k.jenis === 'milik_sendiri' && (sel[k.id] || 0) > 0)
          .sort((a, b) => (sel[b.id] || 0) - (sel[a.id] || 0))
          .forEach(k => {
            if (sisa <= 0) return;
            const ambil = Math.min(sisa, sel[k.id]);
            legs.push(Object.assign({}, calon, { kantong_id: k.id, nominal: ambil }));
            sisa -= ambil;
          });

        if (sisa <= 0) {
          const tambahan = legs.filter(l => l.kantong_id !== calon.kantong_id)
            .map(l => rp(l.nominal) + ' dari ' + Store.kantong(l.kantong_id).nama).join(' dan ');
          Modal.konfirmasi({
            judul: namaKantong + ' di ' + namaAkun + ' kurang',
            pesan: namaKantong + ' di ' + namaAkun + ' tinggal ' + rp(ada) + '. ' +
                   'Ambil sisanya, ' + tambahan + '?',
            labelYa: 'Ya, ambil', gayaYa: 'btn-primary',
            onYa: () => finalTxTerpisah(legs)
          });
          return;
        }
      }

      if (d.kantong.jenis === 'titipan' && !TX.piutang) {
        return bukaPilihanTalangan(calon, dbUji, Math.max(0, d.sesudah + nominal));
      }

      const tersediaUtama = Math.max(0, d.sesudah + nominal);
      const kurang = nominal - tersediaUtama;
      const lain = Calc.sumberLain(dbUji, calon.kantong_id, calon.akun_id);
      const totalLain = lain.reduce((s, x) => s + x.nilai, 0);

      if (totalLain >= kurang) {
        return bukaPisahRekening(calon, {
          namaKantong, namaAkunUtama: namaAkun, tersediaUtama, kurang, lain
        });
      }
      return gagal(`${namaKantong} di semua rekening cuma ${rp(tersediaUtama + totalLain)}, ` +
                   `kurang ${rp(nominal - tersediaUtama - totalLain)} dari ${rp(nominal)}.`);
    }

    return gagal(`${namaKantong} di ${namaAkun} tidak cukup untuk ini. Saldo akan jadi ${rp(d.sesudah)}.`);
  }
  finalTx(calon);
}

/* Dialog pisah rekening: pengeluaran lebih besar dari saldo satu rekening,
   tapi sumber dana yang sama masih ada di rekening lain. Baris utama
   (sampai batas tersedia) otomatis, sisanya diisi pengguna per rekening,
   diprefill rakus dari saldo terbesar supaya biasanya tinggal konfirmasi. */
function bukaPisahRekening(calon, info) {
  const { namaKantong, namaAkunUtama, tersediaUtama, kurang, lain } = info;
  const wrap = el('div');

  wrap.appendChild(el('p', { class:'muted', style:'margin:0 0 12px' },
    `${namaKantong} di ${namaAkunUtama} cuma cukup ${rp(tersediaUtama)} dari ${rp(calon.nominal)}. ` +
    `Pisahkan sisanya ${rp(kurang)} dari rekening lain:`));

  const baris = [];
  let sisaPrefill = kurang;
  lain.forEach(s => {
    const ambil = Math.min(s.nilai, sisaPrefill);
    sisaPrefill -= ambil;

    const lbl = el('label', { class:'field' });
    lbl.appendChild(el('span', null, `${s.akun.nama} (tersedia ${rp(s.nilai)})`));
    const inp = el('input', { type:'text', inputMode:'numeric', autocomplete:'off' });
    pasangFormatAngka(inp);
    tulisAngka(inp, ambil);
    lbl.appendChild(inp);
    wrap.appendChild(lbl);
    baris.push({ akun: s.akun, maksimal: s.nilai, input: inp });
  });

  const sisaEl = el('p', { class:'muted', style:'margin:8px 0 0;font-weight:600' });
  wrap.appendChild(sisaEl);

  const hitungSisa = () => {
    const total = baris.reduce((s, b) => s + bacaAngka(b.input), 0);
    const sisa = kurang - total;
    sisaEl.textContent = sisa === 0 ? 'Pas — siap disimpan.'
      : sisa > 0 ? `Masih kurang ${rp(sisa)}.` : `Kelebihan ${rp(-sisa)}.`;
    sisaEl.style.color = sisa === 0 ? '#1a7a4c' : '#c0392b';
    return sisa;
  };
  baris.forEach(b => b.input.addEventListener('input', hitungSisa));
  hitungSisa();

  const err = el('div', { class:'err', hidden:'' });
  wrap.appendChild(err);

  Modal.buka({
    judul: 'Saldo kurang di ' + namaAkunUtama,
    isi: wrap,
    aksi: [
      { label:'Batal' },
      {
        label:'Simpan', gaya:'btn-primary', tutup:false,
        aksi: () => {
          for (const b of baris) {
            if (bacaAngka(b.input) > b.maksimal) {
              err.textContent = `${b.akun.nama} cuma punya ${rp(b.maksimal)}.`;
              err.hidden = false;
              return;
            }
          }
          const sisa = hitungSisa();
          if (sisa !== 0) {
            err.textContent = sisa > 0 ? `Masih kurang ${rp(sisa)} lagi.` : `Kelebihan ${rp(-sisa)}, kurangi dulu.`;
            err.hidden = false;
            return;
          }

          const legs = [];
          if (tersediaUtama > 0) legs.push(Object.assign({}, calon, { nominal: tersediaUtama }));
          baris.forEach(b => {
            const n = bacaAngka(b.input);
            if (n > 0) legs.push(Object.assign({}, calon, { akun_id: b.akun.id, nominal: n }));
          });

          Modal.tutup();
          finalTxTerpisah(legs);
        }
      }
    ]
  });
}

/* Simpan beberapa baris 'keluar' sekaligus — hasil dari dialog pisah
   rekening. Sama seperti finalTx, tapi tidak pernah untuk TX.edit:
   koreksi transaksi yang sudah dipisah tetap ditangani satu per satu. */
/* Penutup sesudah catatan tersimpan lewat jalur khusus (talangan). */
function selesaiCatatan(pesan) {
  if (TX.pengingat) {
    const p = (Store.db.pengingat || []).find(x => x.id === TX.pengingat.id);
    if (p) Pengingat.tandaiTerpenuhi(p, TX.pengingat.jatuhStr);
    TX.pengingat = null;
  }
  tutupInput();
  segarkan();
  toast(pesan);
  if (antreanPengingat.length) setTimeout(tanyaBerikutnya, 400);
}

/* Saldo titipan kurang: pilih menalangi sebagian, menalangi semua,
   mengambil titipan yang SAMA dari rekening lain, atau batal. Tidak
   pernah mengambil dari titipan pihak lain. */
function bukaPilihanTalangan(calon, dbUji, ada) {
  const titipan = Store.kantong(calon.kantong_id);
  const akun = Store.akun(calon.akun_id);
  const kurang = calon.nominal - ada;
  const bisaKurang = ada > 0 && !!Store._rencanaPribadi(calon.akun_id, kurang);
  const bisaSemua = !!Store._rencanaPribadi(calon.akun_id, calon.nominal);
  const lain = Calc.sumberLain(dbUji, calon.kantong_id, calon.akun_id);
  const totalLain = lain.reduce((s, x) => s + x.nilai, 0);

  const wrap = el('div');
  wrap.appendChild(el('p', { class:'muted', style:'margin:0 0 12px' },
    titipan.nama + ' di ' + akun.nama + ' tinggal ' + rp(ada) + ', kurang ' + rp(kurang) +
    ' untuk ' + rp(calon.nominal) + '.'));

  const opsi = (judul, ket, bisa, aksi) => wrap.appendChild(el('button', {
    class:'btn btn-outline btn-block talangan-opsi', disabled: bisa ? null : '',
    onclick: () => { Modal.tutup(); aksi(); }
  }, [ el('b', null, judul), el('small', null, bisa ? ket : 'Uang pribadi di ' + akun.nama + ' tidak cukup') ]));

  const talangi = jumlah => {
    if (!Store.catatTalangan(calon, jumlah)) { toast('Gagal mencatat talangan. Saldo berubah?'); return; }
    selesaiCatatan('Ditalangi uang pribadi · ' + rp(jumlah));
  };

  if (ada > 0) opsi('Kurangnya pakai uang pribadi',
    'Talangan ' + rp(kurang) + ', sisanya dari ' + titipan.nama, bisaKurang, () => talangi(kurang));
  opsi('Semua pakai uang pribadi dulu',
    'Talangan ' + rp(calon.nominal) + ', ' + titipan.nama + ' tidak terpakai', bisaSemua, () => talangi(calon.nominal));
  if (totalLain >= kurang) {
    wrap.appendChild(el('button', { class:'btn btn-outline btn-block talangan-opsi', onclick: () => {
      Modal.tutup();
      bukaPisahRekening(calon, { namaKantong: titipan.nama, namaAkunUtama: akun.nama,
                                 tersediaUtama: ada, kurang, lain });
    } }, [ el('b', null, 'Ambil ' + titipan.nama + ' dari rekening lain'),
           el('small', null, titipan.nama + ' masih ada ' + rp(totalLain) + ' di rekening lain') ]));
  }

  Modal.buka({ judul:'Saldo ' + titipan.nama + ' kurang', isi: wrap, aksi:[{ label:'Batal' }] });
}

function dialogGantiTalangan(o) {
  Modal.form({
    judul:'Talangan diganti',
    medan:[{ nama:'nominal', label:'Diganti oleh ' + o.kantong.nama, tipe:'angka', nilai: o.sisa }],
    labelSimpan:'Catat',
    onSimpan: v => {
      const h = Store.gantiTalangan(o.kantong.id, v.nominal);
      if (!h.ok) return h.alasan;
      segarkan();
      toast('Talangan diganti · ' + rp(h.nominal));
    }
  });
}

function finalTxTerpisah(legs) {
  if (legs.some(l => Calc.cekDampak(Store.db, l).length)) {
    toast('Saldo berubah sejak dibuka. Tidak ada yang tersimpan — cek lagi.');
    return;
  }
  legs.forEach(l => Store.catat(l));

  if (TX.pengingat) {
    const p = (Store.db.pengingat || []).find(x => x.id === TX.pengingat.id);
    if (p) Pengingat.tandaiTerpenuhi(p, TX.pengingat.jatuhStr);
    TX.pengingat = null;
  }

  tutupInput();
  segarkan();
  const total = legs.reduce((s, l) => s + l.nominal, 0);
  toast(`Tercatat dalam ${legs.length} bagian · ${rp(total)}`);

  if (antreanPengingat.length) setTimeout(tanyaBerikutnya, 400);
}

function finalTx(calon) {
  if (TX.edit) {
    const hasil = Store.koreksiTx(TX.edit, calon);
    if (!hasil) {
      const err = $('#txError');
      err.textContent = 'Transaksi ini sudah dikoreksi di perangkat lain. Tutup lalu buka lagi.';
      err.hidden = false;
      return;
    }
    tutupInput();
    segarkan();
    toast('Koreksi tersimpan · ' + rp(calon.nominal));
    return;
  }

  if (!Store.catat(calon)) {
    const err = $('#txError');
    err.textContent = 'Saldo tidak cukup untuk ini. Tidak ada yang tersimpan.';
    err.hidden = false;
    return;
  }

  /* Baru sekarang pengingatnya dianggap terjawab. */
  if (TX.pengingat) {
    const p = (Store.db.pengingat || []).find(x => x.id === TX.pengingat.id);
    if (p) Pengingat.tandaiTerpenuhi(p, TX.pengingat.jatuhStr);
    TX.pengingat = null;
  }

  tutupInput();
  segarkan();
  toast('Tercatat · ' + rp(calon.nominal));

  /* Kalau pop-up jatuh tempo sedang berjalan, lanjutkan antreannya —
     dulu rantainya putus di sini dan pengingat kedua tidak pernah
     ditanyakan sampai aplikasi dibuka lagi. */
  if (antreanPengingat.length) setTimeout(tanyaBerikutnya, 400);
}

/* Pemilih bank/e-wallet dipakai bersama oleh onboarding dan halaman Profil.

   Setelah bank dipilih, namanya TERKUNCI — pengguna tidak sedang
   mengedit "BCA", ia sedang menambahkan rekening BCA miliknya. Yang
   bisa diisi hanya judul opsional untuk membedakan kalau punya lebih
   dari satu rekening di bank yang sama. */
function dialogPilihBank(onSelesai, opsiTambahan) {
  Modal.pilih({
    judul: 'Pilih jenis',
    opsi: SEED_AKUN.map(s => ({
      id: s.kode, nama: s.nama, ikon: s.ini,
      ket: s.jenis === 'bank' ? 'Bank' : s.jenis === 'ewallet' ? 'E-wallet'
         : s.jenis === 'tunai' ? 'Uang fisik' : 'Tulis sendiri'
    })),
    onPilih: o => {
      const seed = SEED_AKUN.find(s => s.kode === o.id);
      const bebas = seed.kode === 'lainnya';
      const medan = [];

      if (bebas) {
        medan.push({ nama:'judul', label:'Nama tempat',
                     placeholder:'mis. Koperasi Sekolah' });
      } else {
        medan.push({ nama:'_bank', label:'Bank / dompet', tipe:'statis',
                     nilai: seed.nama, ikon: seed.ini });
        medan.push({ nama:'judul', label:'Judul (opsional)',
                     placeholder:'mis. Gaji, Tabungan, Usaha' });
      }
      if (opsiTambahan && opsiTambahan.saldo) {
        medan.push({ nama:'saldo', label:'Saldo saat ini', tipe:'angka', placeholder:'0' });
      }

      Modal.form({
        judul: bebas ? 'Tambah tempat' : 'Tambah ' + seed.nama,
        medan,
        onSimpan: v => {
          if (bebas && !v.judul) return 'Nama tidak boleh kosong.';
          /* judul hanya PELENGKAP nama bank, bukan pengganti */
          const nama = bebas ? v.judul
                     : (v.judul ? seed.nama + ' ' + v.judul : seed.nama);
          onSelesai({ seed, nama, saldo: v.saldo || 0 });
        }
      });
    }
  });
}

function dialogTambahAkun(cb) {
  dialogPilihBank(({ seed, nama, saldo }) => {
    const a = Store.tambahAkun({
      nama, bank_kode: seed.kode === 'lainnya' ? '' : seed.kode, jenis: seed.jenis
    });
    if (saldo > 0) {
      const kat = Store.tambahKategori({ nama:'Saldo Awal', tipe:'pemasukan' });
      Store.catat({ jenis:'saldo_awal', nominal:saldo, akun_id:a.id,
        kantong_id: Store.kantongDefault().id, kategori_id:kat.id, keterangan:'Saldo awal' });
    }
    if (cb) cb(a.id); else segarkan();
  }, { saldo: true });
}

/* ══════════════════════════════════════════════
   TRANSAKSI
   ══════════════════════════════════════════════ */
function pasangTransaksi() {
  $('#txCari').oninput = renderTransaksi;
  $('#txFilterKantong').onchange = renderTransaksi;
  $$('#txGrafikMode button').forEach(b => b.onclick = () => {
    txGrafikMode = b.dataset.mode;
    renderGrafikTx();
  });
}

function renderTransaksi() {
  const db = Store.db;
  renderGrafikTx();
  const cari = $('#txCari').value.toLowerCase().trim();
  const fk = $('#txFilterKantong');

  /* isi filter sumber dana */
  const sederhana = Store.modeSederhana();
  fk.hidden = sederhana;
  /* dibandingkan dari isi, bukan jumlah — kalau hanya jumlahnya yang dicek,
     sumber dana yang di-rename tetap tampil dengan nama lama */
  const sidik = db.kantong.map(k => k.id + ':' + k.nama).join('|');
  if (!sederhana && fk.dataset.sidik !== sidik) {
    const lama = fk.value;
    kosong(fk);
    fk.appendChild(el('option', { value:'' }, 'Semua sumber'));
    db.kantong.forEach(k => fk.appendChild(el('option', { value:k.id }, k.nama)));
    fk.value = lama || '';
    fk.dataset.sidik = sidik;
  }

  let daftar = db.transaksi.slice().sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp) ||
    new Date(b.dibuat_pada) - new Date(a.dibuat_pada));

  if (fk.value) daftar = daftar.filter(t =>
    t.kantong_id === fk.value || t.kantong_tujuan_id === fk.value);

  if (cari) {
    /* "100.000", "100000", dan "Rp 100.000" harus sama-sama ketemu —
       yang diketik orang adalah angka yang dilihatnya di layar. */
    const angka = cari.replace(/\D/g, '');
    daftar = daftar.filter(t => {
      const k = Store.kategori(t.kategori_id);
      return (t.keterangan || '').toLowerCase().includes(cari) ||
             (k && k.nama.toLowerCase().includes(cari)) ||
             (!!angka && String(t.nominal).includes(angka));
    });
  }

  const w = kosong($('#txList'));
  if (!daftar.length) {
    w.appendChild(cari || fk.value
      ? el('p', { class:'empty' }, 'Tidak ada yang cocok dengan pencarianmu.')
      : kartuKosong('Belum ada transaksi', 'Tekan tombol + di bawah untuk mencatat yang pertama.'));
    return;
  }

  let hariTerakhir = '';
  daftar.forEach(t => {
    const h = tglRelatif(t.timestamp);
    if (h !== hariTerakhir) {
      hariTerakhir = h;
      w.appendChild(el('div', { class:'tx-day' }, h));
    }
    w.appendChild(barisTx(t));
  });
}

/* ── grafik candle: untung/rugi bersih per hari / bulan ──
   Satu candle = satu periode (00.00 → 00.00). Ketuk candle untuk melihat
   saldo tiap rekening dan sumber dananya di akhir periode itu. */
let txGrafikMode = 'harian';

function svgEl(tag, attr, teks) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attr) e.setAttribute(k, attr[k]);
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function labelCandle(c, mode, panjang) {
  if (mode === 'bulanan') {
    return panjang ? BULAN[c.awal.getMonth()] + ' ' + c.awal.getFullYear()
                   : BULAN[c.awal.getMonth()].slice(0, 3);
  }
  return panjang ? HARI[c.awal.getDay()] + ', ' + tglPanjang(c.awal)
                 : HARI[c.awal.getDay()].slice(0, 3) + ' ' + c.awal.getDate();
}

function tandaRp(n) { return (n > 0 ? '+' : '') + rp(n); }

function renderGrafikTx() {
  const wrap = $('#txGrafikWrap');
  const db = Store.db;
  wrap.hidden = !db.transaksi.length;
  if (wrap.hidden) return;

  const mode = txGrafikMode;
  $$('#txGrafikMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#txGrafikNote').textContent = mode === 'bulanan'
    ? 'Total saldo 12 bulan terakhir. Tiap candle = awal bulan (00.00) sampai akhir bulan. Ketuk candle untuk rincian.'
    : 'Total saldo 7 hari terakhir. Tiap candle = 00.00 sampai 00.00 berikutnya. Ketuk candle untuk rincian.';

  const data = Calc.candle(db, mode);
  const W = 340, H = mode === 'harian' ? 214 : 200;
  const kiri = 54, kanan = 6, atas = 10;
  const bawah = mode === 'harian' ? 44 : 28;
  const tinggi = H - atas - bawah;

  let lo = Math.min(...data.map(c => c.lo)), hi = Math.max(...data.map(c => c.hi));
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  hi += pad; lo -= pad;
  const yPos = v => atas + (hi - v) / (hi - lo) * tinggi;

  const svg = svgEl('svg', { viewBox:`0 0 ${W} ${H}`, role:'img',
    'aria-label':'Grafik candle total saldo' });

  [hi - pad, (hi + lo) / 2, lo + pad].forEach(v => {
    const y = yPos(v);
    svg.appendChild(svgEl('line', { class:'cd-grid', x1:kiri, x2:W - kanan, y1:y, y2:y }));
    svg.appendChild(svgEl('text', { x:kiri - 5, y:y + 3, 'text-anchor':'end' }, rpRingkas(v)));
  });
  if (lo < 0 && hi > 0) {
    const y0 = yPos(0);
    svg.appendChild(svgEl('line', { class:'cd-nol', x1:kiri, x2:W - kanan, y1:y0, y2:y0 }));
  }

  const lebar = (W - kiri - kanan) / data.length;
  const badan = Math.min(26, lebar * 0.56);
  const kolom = [];

  data.forEach((c, i) => {
    const cx = kiri + lebar * (i + 0.5);
    const g = svgEl('g');
    const sel = svgEl('rect', { class:'cd-kol', x:cx - lebar / 2, y:atas - 4,
      width:lebar, height:tinggi + bawah + 4, tabindex:0, role:'button',
      'aria-label':`${labelCandle(c, mode, true)}: ${tandaRp(c.net)}` });
    const buka = () => { kolom.forEach(r => r.classList.remove('cd-sel')); sel.classList.add('cd-sel');
      dialogCandle(c, mode); };
    sel.addEventListener('click', buka);
    sel.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buka(); } });
    kolom.push(sel);
    g.appendChild(sel);

    g.appendChild(svgEl('line', { class:'cd-sumbu', x1:cx, x2:cx, y1:yPos(c.hi), y2:yPos(c.lo),
      'pointer-events':'none' }));
    const yo = yPos(c.open), yc = yPos(c.close);
    const kelas = c.close > c.open ? 'cd-naik' : c.close < c.open ? 'cd-turun' : 'cd-datar';
    g.appendChild(svgEl('rect', { class:'cd-badan ' + kelas, x:cx - badan / 2,
      y:Math.min(yo, yc), width:badan, height:Math.max(2.5, Math.abs(yo - yc)), rx:2,
      'pointer-events':'none' }));

    g.appendChild(svgEl('text', { class:'cd-x', x:cx, y:atas + tinggi + 14, 'text-anchor':'middle',
      'pointer-events':'none' }, labelCandle(c, mode, false)));
    /* nilai net hanya muat di tampilan harian */
    if (mode === 'harian') {
      g.appendChild(svgEl('text', { class:'cd-net ' + (c.net > 0 ? 'pos' : c.net < 0 ? 'neg' : ''),
        x:cx, y:atas + tinggi + 28, 'text-anchor':'middle', 'pointer-events':'none' },
        (c.net > 0 ? '+' : '') + rpRingkas(c.net).replace('Rp ', '')));
    }
    svg.appendChild(g);
  });

  kosong($('#txCandle')).appendChild(svg);
}

function dialogCandle(c, mode) {
  const db = Store.db;
  const sp = Calc.saldoPadaCandle(db, c);
  const kls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : '';

  const kotak = (judul, nilai) => el('div', null, [
    el('small', null, judul), el('b', null, rp(nilai))]);

  const body = el('div', { class:'cd-detail' });
  body.appendChild(el('div', { class:'cd-ring' }, [
    kotak('Saldo awal 00.00', c.open),
    kotak(c.terakhir ? 'Saldo sekarang' : 'Saldo akhir', c.close),
    el('div', { class:'cd-net-box' }, [
      el('small', null, 'Untung / rugi bersih (akhir − awal)'),
      el('b', { class:kls(c.net) }, tandaRp(c.net))
    ])
  ]));

  /* satu baris: nama, saldo akhir, dan selisihnya dari saldo awal */
  const baris = (nama, awal, akhir, anak, tag) => el('div', { class:'cd-baris' + (anak ? ' cd-anak' : '') }, [
    el('span', { class:'cd-nm' }, [nama, el('small', null, 'awal ' + rp(awal))]),
    tag || null,
    el('span', { class:'cd-nilai' }, [
      rp(akhir),
      el('small', { class:kls(akhir - awal) }, akhir === awal ? 'tetap' : tandaRp(akhir - awal))
    ])
  ]);

  const mA = sp.awal.matriks, mB = sp.akhir.matriks;
  const akun = db.akun.filter(a => a.aktif ||
    (sp.awal.saldoAkun[a.id] || 0) !== 0 || (sp.akhir.saldoAkun[a.id] || 0) !== 0);
  body.appendChild(el('h4', null, 'Saldo tiap rekening'));
  if (!akun.length) body.appendChild(el('p', { class:'muted' }, 'Belum ada rekening.'));
  akun.forEach(a => {
    body.appendChild(baris(a.nama, sp.awal.saldoAkun[a.id] || 0, sp.akhir.saldoAkun[a.id] || 0));
    db.kantong.forEach(k => {
      const x = (mA[a.id] || {})[k.id] || 0, y = (mB[a.id] || {})[k.id] || 0;
      if (!x && !y) return;
      body.appendChild(baris('↳ ' + k.nama + ' (' + labelJenis(k) + ')', x, y, true));
    });
  });

  const kantong = db.kantong.filter(k => !k.arsip ||
    (sp.awal.saldoKantong[k.id] || 0) !== 0 || (sp.akhir.saldoKantong[k.id] || 0) !== 0);
  body.appendChild(el('h4', null, 'Saldo tiap sumber dana'));
  kantong.forEach(k => {
    body.appendChild(baris(k.nama, sp.awal.saldoKantong[k.id] || 0, sp.akhir.saldoKantong[k.id] || 0, false,
      el('span', { class:'tag ' + (k.jenis === 'titipan' ? 'titipan' : 'milik') }, labelJenis(k))));
  });

  Modal.buka({
    judul: labelCandle(c, mode, true),
    isi: body,
    aksi: [{ label:'Tutup' }]
  });
}

/* ══════════════════════════════════════════════
   LAPORAN
   ══════════════════════════════════════════════ */
function pasangLaporan() {
  $('#lapPeriode').onchange = renderLaporan;
  $('#lapCsv').onclick = () => unduhCsvSemua();
  $('#lapBackup').onclick = () => {
    unduh('dompetq-cadangan-' + tglInput(new Date()) + '.json', Store.ekspor(), 'application/json');
    toast('Cadangan terunduh');
  };
}

function isiPeriode() {
  const sel = $('#lapPeriode');
  const kini = new Date();
  /* dibangun ulang kalau bulan berjalan belum ada di daftar — app yang
     dibiarkan terbuka melewati pergantian bulan tetap dapat bulan baru */
  const kunci = kini.getFullYear() + '-' + pad2(kini.getMonth() + 1);
  if (sel.options.length && sel.options[0].value === kunci) return;
  const dipilih = sel.value;
  kosong(sel);
  for (let i = 0; i < 12; i++) {
    const d = new Date(kini.getFullYear(), kini.getMonth() - i, 1);
    sel.appendChild(el('option', { value: d.getFullYear() + '-' + pad2(d.getMonth() + 1) },
      BULAN[d.getMonth()] + ' ' + d.getFullYear()));
  }
  sel.appendChild(el('option', { value:'semua' }, 'Sejak awal'));
  if (dipilih && Array.from(sel.options).some(o => o.value === dipilih))
    sel.value = dipilih;
}

function rentangPeriode() {
  const v = $('#lapPeriode').value;
  if (v === 'semua') return { dari: new Date(2000, 0, 1), sampai: new Date(2999, 0, 1), label:'sejak awal' };
  const [y, m] = v.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return { dari: awalBulan(d), sampai: akhirBulan(d), label: BULAN[m - 1] + ' ' + y };
}

function renderLaporan() {
  isiPeriode();
  const db = Store.db;
  const { dari, sampai } = rentangPeriode();
  const sederhana = Store.modeSederhana();

  /* Menghitung SEMUA dana, titipan sekalian. Sebelumnya statistik
     hanya menghitung dana milik sendiri sementara grafik di bawahnya
     menghitung semuanya — satu layar bisa menampilkan "Pengeluaran
     Rp 0" tepat di atas batang "Makan Rp 100.000". */
  const kas = Calc.arusKas(db, dari, sampai, false);
  const r = Calc.ringkas(db);

  const ws = kosong($('#lapStat'));
  const stat = (l, v, cls) => ws.appendChild(el('div', { class:'stat' }, [
    el('small', null, l), el('b', { class: cls || '' }, rp(v))
  ]));
  stat('Pemasukan', kas.masuk, 'pos');
  stat('Pengeluaran', kas.keluar, 'neg');
  stat('Selisih', kas.selisih, kas.selisih >= 0 ? 'pos' : 'neg');
  stat(sederhana ? 'Saldo sekarang' : 'Uang saya bersih', r.uangSaya);

  $('#lapNote').hidden = sederhana;

  renderBars($('#lapBars'), Calc.perKategori(db, dari, sampai, 'keluar'),
    'Belum ada pengeluaran di periode ini.');

  /* laporan per sumber dana — bahan pertanggungjawaban */
  const wk = kosong($('#lapPerKantong'));
  if (!sederhana) {
    db.kantong.filter(k => k.jenis === 'titipan').forEach(k => {
      wk.appendChild(el('button', {
        class:'btn btn-outline btn-block',
        onclick: () => unduhCsvKantong(k)
      }, 'Unduh mutasi — ' + k.nama));
    });
    if (db.kantong.some(k => k.jenis === 'titipan')) {
      wk.appendChild(el('p', { class:'fineprint' },
        'Berisi mutasi satu sumber dana saja, lengkap dengan saldo berjalan. Bisa diserahkan sebagai laporan pertanggungjawaban tanpa membuka keuangan pribadimu.'));
    }
  }
}

/* ── ekspor ── */
function csvEsc(s) {
  s = String(s == null ? '' : s);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function unduhCsvSemua() {
  const db = Store.db;
  const head = ['tanggal','jenis','nominal','tempat','tempat_tujuan',
                'sumber_dana','sumber_dana_tujuan','kategori','keterangan','dicatat_pada'];
  const baris = [head.join(';')];

  db.transaksi.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .forEach(t => baris.push([
      tglInput(t.timestamp), namaJenis(t.jenis), t.nominal,
      (Store.akun(t.akun_id) || {}).nama || '',
      (Store.akun(t.akun_tujuan_id) || {}).nama || '',
      (Store.kantong(t.kantong_id) || {}).nama || '',
      (Store.kantong(t.kantong_tujuan_id) || {}).nama || '',
      (Store.kategori(t.kategori_id) || {}).nama || '',
      t.keterangan || '', tglInput(t.dibuat_pada)
    ].map(csvEsc).join(';')));

  unduh('dompetq-transaksi-' + tglInput(new Date()) + '.csv', '﻿' + baris.join('\n'), 'text/csv');
  toast('CSV terunduh');
}

function unduhCsvKantong(k) {
  const m = Calc.mutasiKantong(Store.db, k.id);
  const baris = [
    'LAPORAN MUTASI — ' + k.nama,
    'Dicetak;' + tglPanjang(new Date()),
    'Saldo akhir;' + m.saldoAkhir,
    '',
    ['tanggal','uraian','tempat','masuk','keluar','saldo'].join(';')
  ];

  m.rows.forEach(r => baris.push([
    tglInput(r.tx.timestamp),
    r.tx.keterangan || (Store.kategori(r.tx.kategori_id) || {}).nama || namaJenis(r.tx.jenis),
    (Store.akun(r.tx.akun_id) || {}).nama || '',
    r.delta > 0 ? r.delta : '',
    r.delta < 0 ? -r.delta : '',
    r.saldo
  ].map(csvEsc).join(';')));

  const slug = k.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  unduh('mutasi-' + slug + '-' + tglInput(new Date()) + '.csv', '﻿' + baris.join('\n'), 'text/csv');
  toast('Laporan ' + k.nama + ' terunduh');
}

function unduh(nama, isi, mime) {
  if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
    unduhNative(nama, isi, mime);
    return;
  }
  const blob = new Blob([isi], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href:url, download:nama });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/* Di dalam APK, <a download> tidak melakukan apa pun — WebView
   Android mengabaikannya diam-diam. Berkas ditulis ke cache
   aplikasi lalu diserahkan ke lembar berbagi bawaan sistem,
   sehingga pengguna tetap bisa menyimpannya ke Files/Drive
   atau mengirimnya ke mana pun. */
async function unduhNative(nama, isi, mime) {
  const { Filesystem, Share } = Capacitor.Plugins;
  try {
    const { uri } = await Filesystem.writeFile({
      path: nama,
      data: isi,
      directory: 'CACHE',
      encoding: 'utf8'
    });
    await Share.share({ title: nama, url: uri, dialogTitle: 'Simpan ' + nama });
  } catch (e) {
    /* Pengguna menutup lembar berbagi — bukan kegagalan. */
    if (/cancel/i.test(String((e && e.message) || e))) return;
    toast('Gagal menyiapkan berkas');
  }
}

/* ══════════════════════════════════════════════
   PROFIL
   ══════════════════════════════════════════════ */
function pasangProfil() {
  $('#profEdit').onclick = () => Modal.form({
    judul:'Edit profil',
    medan: [
      { nama:'nama',  label:'Nama panggilan', nilai: Store.db.profil.nama },
      { nama:'email', label:'Email (opsional)', tipe:'email', nilai: Store.db.profil.email }
    ],
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      Store.db.profil.nama = v.nama;
      Store.db.profil.email = v.email;
      Store.simpan(); renderProfil();
    }
  });

  $('#mgAddAkun').onclick = () => dialogTambahAkun();
  $('#mgAturTitipan').onclick = () => dialogAturTitipan();
  $('#mgAddPengingat').onclick = () => dialogPengingat(null);

  $('#mgAddKantong').onclick = () => Modal.form({
    judul:'Sumber dana baru',
    medan: [
      { nama:'nama', label:'Nama sumber dana', placeholder:'mis. KUP BPD, Gaji, Kas RT' },
      { nama:'jenis', label:'Jenis', tipe:'select', opsi:[
        { v:'milik_sendiri', t:'Pribadi — milik saya' },
        { v:'titipan', t:'Titipan — bukan milik saya' }
      ]}
    ],
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      Store.tambahKantong({ nama:v.nama, jenis:v.jenis });
      renderProfil();
    }
  });

  $('#mgAddKategori').onclick = () => Modal.form({
    judul:'Kategori baru',
    medan: [
      { nama:'nama', label:'Nama' },
      { nama:'tipe', label:'Untuk', tipe:'select', opsi:[
        { v:'pengeluaran', t:'Pengeluaran' }, { v:'pemasukan', t:'Pemasukan' }
      ]}
    ],
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      Store.tambahKategori({ nama:v.nama, tipe:v.tipe });
      renderProfil();
    }
  });

  $('#profRestore').onclick = () => {
    const inp = el('input', { type:'file', accept:'.json,application/json' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          await Store.impor(fr.result);
          toast('Data dipulihkan'); segarkan();
        } catch (e) { toast('Gagal: ' + e.message); }
      };
      fr.readAsText(f);
    };
    inp.click();
  };

  $('#profReset').onclick = () => Modal.konfirmasi({
    judul:'Hapus semua data?',
    pesan:'Seluruh akun, sumber dana, dan transaksi akan hilang permanen dari perangkat ini. Unduh cadangan dulu kalau belum.',
    labelYa:'Hapus permanen', gayaYa:'btn-danger-ghost',
    onYa: async () => {
      await Store.reset();
      location.reload();
    }
  });
}

/* ── Google Sheets ── */
function renderSheets() {
  const w = kosong($('#mgSheets'));
  const s = Store.sinkron;

  if (!s.aktif) {
    w.appendChild(el('div', { class:'mg' }, [
      el('div', { class:'mg-body' }, [
        el('b', null, 'Belum tersambung'),
        el('small', null, 'Data hanya ada di perangkat ini')
      ])
    ]));
    w.appendChild(el('button', {
      class:'btn btn-primary btn-block', style:'margin-top:10px',
      onclick: sambungkanGoogle
    }, 'Sambungkan Google Sheets'));
    w.appendChild(el('button', {
      class:'btn btn-outline btn-block',
      onclick: periksaSambungan
    }, 'Periksa sambungan'));
    w.appendChild(el('button', {
      class:'btn btn-outline btn-block',
      onclick: mintaIzinUlang
    }, 'Minta izin ulang'));
    w.appendChild(el('p', { class:'fineprint' },
      'Spreadsheet dibuat di Google Drive milikmu sendiri. Pembuat aplikasi ini ' +
      'tidak bisa membukanya. Kamu bisa mencabut aksesnya kapan pun.'));
    return;
  }

  const status = s.sedang ? 'Menyimpan…'
               : s.galat  ? 'Gagal menyimpan'
               : s.terakhir ? 'Tersimpan ' + tglRelatif(s.terakhir).toLowerCase() +
                              ', ' + jamSingkat(s.terakhir)
               : 'Tersambung';

  w.appendChild(el('div', { class:'mg' }, [
    el('div', { class:'kt-dot', style:'background:' + (s.galat ? 'var(--red)' : 'var(--green)') }),
    el('div', { class:'mg-body' }, [
      el('b', null, (Google.profil && Google.profil.email) || 'Tersambung'),
      el('small', null, status)
    ])
  ]));

  /* Sebabnya ditulis penuh di bawah kartu, bukan diringkas ke dalam
     baris status. Pesan seperti "Google Sheets API belum diaktifkan"
     memang panjang — tapi persis kalimat itulah yang membuat orang
     tahu harus berbuat apa. */
  if (s.galat) {
    w.appendChild(el('p', {
      class:'fineprint',
      style:'white-space:pre-line;color:var(--red);margin-top:8px'
    }, s.galat));
  }

  const tautan = SheetsAdapter.tautan();
  if (tautan) {
    w.appendChild(el('a', {
      class:'btn btn-outline btn-block', style:'margin-top:10px;text-decoration:none',
      href: tautan, target:'_blank', rel:'noopener'
    }, 'Buka spreadsheet di Drive'));
  }

  w.appendChild(el('button', {
    class:'btn btn-outline btn-block',
    onclick: () => {
      toast('Menyimpan ke Sheets…');
      Store.simpanSekarang();
    }
  }, 'Simpan sekarang'));

  /* Arah sebaliknya. Dipakai kalau baru saja mencatat di perangkat
     lain dan ingin catatannya muncul di sini sekarang juga, tanpa
     menunggu aplikasi ditutup dan dibuka lagi. */
  w.appendChild(el('button', {
    class:'btn btn-outline btn-block',
    onclick: async () => {
      toast('Mengambil dari Sheets…');
      const h = await Store.tarikSekarang();
      renderProfil();
      if (h.cara === 'ok' && h.masuk) { segarkan(); toast(h.masuk + ' catatan baru masuk'); }
      else if (h.cara === 'ok' || h.cara === 'sama') toast('Sudah paling baru');
      else if (h.cara === 'kosong') toast('Belum ada data di Google Sheets');
      else if (h.cara === 'galat') toast('Gagal membaca — lihat keterangan di bawah');
    }
  }, 'Ambil data terbaru'));

  w.appendChild(el('button', {
    class:'btn btn-outline btn-block',
    onclick: periksaSambungan
  }, 'Periksa sambungan'));

  /* Hanya ditawarkan kalau ada yang gagal — kalau sedang sehat,
     mencabut izin justru mematahkan yang sudah jalan. */
  if (s.galat) {
    w.appendChild(el('button', {
      class:'btn btn-outline btn-block',
      onclick: mintaIzinUlang
    }, 'Minta izin ulang'));
  }

  w.appendChild(el('button', {
    class:'btn btn-danger-ghost btn-block',
    onclick: () => Modal.konfirmasi({
      judul:'Putuskan sambungan?',
      pesan:'Spreadsheet di Drive-mu tidak dihapus — hanya kaitannya dengan aplikasi ini yang dilepas. Data di perangkat tetap utuh.',
      labelYa:'Putuskan', gayaYa:'btn-danger-ghost',
      onYa: () => { Store.putuskanSheets(); renderProfil(); toast('Sambungan diputus'); }
    })
  }, 'Putuskan sambungan'));
}

function jamSingkat(iso) {
  const d = new Date(iso);
  return pad2(d.getHours()) + '.' + pad2(d.getMinutes());
}

/* Google mengingat persetujuan yang sudah pernah diberikan. Kalau dulu
   ada kotak izin yang terlewat, permintaan berikutnya dijawab diam-diam
   dengan izin lama yang kurang itu — layar centangnya tidak muncul lagi,
   dan macetnya terasa tidak bisa diperbaiki dari dalam aplikasi.

   Mencabut dulu memaksa Google bertanya dari awal. */
async function mintaIzinUlang() {
  try {
    toast('Membuka layar izin Google…');
    await Google.masukUlang();
  } catch (e) {
    Modal.buka({
      judul: 'Gagal meminta izin',
      isi: el('p', { class:'muted', style:'margin:0;white-space:pre-line' }, e.message),
      aksi: [{ label:'Tutup', gaya:'btn-primary' }]
    });
    return;
  }
  await sambungkanGoogle();
}

/* Menjalankan rantai sambungan langkah demi langkah dan menunjukkan
   persis di mana putusnya. Dipasang di dua tempat — sebelum dan
   sesudah tersambung — karena keduanya bisa gagal dengan sebab yang
   sama sekali berbeda. */
async function periksaSambungan() {
  const isi = el('div');
  isi.appendChild(el('p', { class:'muted', style:'margin-top:0' }, 'Memeriksa…'));
  Modal.buka({ judul:'Periksa sambungan', isi, aksi:[{ label:'Tutup' }] });

  let hasil;
  try {
    hasil = await SheetsAdapter.diagnosa();
  } catch (e) {
    hasil = [{ nama:'Pemeriksaan', ok:false, pesan:e.message }];
  }

  kosong(isi);

  const TANDA = { true:'✓', false:'✕', null:'–' };
  hasil.forEach(h => {
    const warna = h.ok === true  ? 'var(--green)'
                : h.ok === false ? 'var(--red)'
                : 'var(--ink-3)';
    isi.appendChild(el('div', { class:'mg' }, [
      el('div', {
        style:'flex:none;width:20px;font-weight:800;color:' + warna
      }, TANDA[String(h.ok)]),
      el('div', { class:'mg-body' }, [
        el('b', null, h.nama),
        el('small', { style:'white-space:pre-line;font-family:inherit' }, h.pesan),
        h.mentah ? el('small', {
          style:'display:block;color:var(--ink-3);margin-top:4px'
        }, h.mentah) : null
      ])
    ]));
  });

  const gagal = hasil.find(h => h.ok === false);
  isi.appendChild(el('p', { class:'fineprint' }, gagal
    ? 'Langkah bertanda ✕ itulah yang perlu dibereskan. Langkah sesudahnya ' +
      'dilewati karena pasti ikut gagal.'
    : 'Semua langkah berhasil. Sambungan ke Google Sheets sehat.'));

  /* Laporan yang bisa disalin — supaya sebab mentahnya bisa dikirim
     atau dicari, tanpa harus membuka console browser di HP. */
  const laporan = hasil.map(h =>
    TANDA[String(h.ok)] + ' ' + h.nama + ' — ' + h.pesan +
    (h.mentah ? ' [' + h.mentah + ']' : '')).join('\n');

  Modal.buka({
    judul: 'Periksa sambungan',
    isi,
    aksi: [
      { label:'Salin laporan', tutup:false, aksi: () => {
          navigator.clipboard.writeText(laporan)
            .then(() => toast('Laporan disalin'))
            .catch(() => toast('Gagal menyalin'));
        } },
      { label:'Tutup', gaya:'btn-primary' }
    ]
  });
}

async function sambungkanGoogle() {
  toast('Membuka login Google…');
  let putusan;
  try {
    putusan = await Store.sambungkanSheets();
  } catch (e) {
    Modal.buka({
      judul: 'Gagal menyambungkan',
      isi: el('p', { class:'muted', style:'margin:0;white-space:pre-line' }, e.message),
      aksi: [
        { label:'Periksa sambungan', tutup:false, aksi: periksaSambungan },
        { label:'Tutup', gaya:'btn-primary' }
      ]
    });
    return;
  }

  const pakai = async (arah, jauh) => {
    toast('Menyinkronkan…');
    const ok = await Store.terapkanSinkron(arah, jauh);
    renderProfil();
    toast(ok ? 'Tersambung ke Google Sheets' : 'Tersambung, tapi tulis pertama gagal');
    if (arah !== 'unggah') segarkan();
  };

  if (putusan.cara !== 'bentrok') {
    await pakai(putusan.cara === 'unduh' ? 'unduh' : 'unggah', putusan.db);
    return;
  }

  /* Dua-duanya berisi transaksi. Ini keputusan pengguna, bukan
     keputusan aplikasi — salah pilih berarti kehilangan catatan uang. */
  tanyaBentrok(putusan.lokal, putusan.jauh);
}

function renderProfil() {
  const db = Store.db;
  const r = Calc.ringkas(db);
  renderSheets();
  renderKunci();
  renderPengingat();

  $('#profNama').textContent = db.profil.nama || '—';
  $('#profEmail').textContent = db.profil.email || 'Belum diisi';
  $('#profAva').textContent = (db.profil.nama || '?').trim().charAt(0).toUpperCase();

  /* akun */
  const wa = kosong($('#mgAkun'));
  db.akun.forEach(a => {
    wa.appendChild(el('div', { class:'mg' }, [
      el('div', { class:'chip-ico' }, inisialAkun(a)),
      el('div', { class:'mg-body' }, [
        el('b', null, a.nama),
        el('small', null, rp(r.saldoAkun[a.id] || 0))
      ]),
      el('button', { class:'mg-act', onclick: () => ubahAkun(a) }, 'Ubah')
    ]));
  });

  /* sumber dana */
  const wk = kosong($('#mgKantong'));
  db.kantong.forEach(k => {
    wk.appendChild(el('div', { class:'mg', style: k.arsip ? 'opacity:.55' : null }, [
      el('div', { class:'kt-dot', style:'background:' + k.warna }),
      el('div', { class:'mg-body' }, [
        el('b', null, k.nama),
        el('small', null, rp(r.saldoKantong[k.id] || 0) + ' · ' + labelJenis(k) +
          (k.is_default && !k.arsip ? ' · default' : '') + (k.arsip ? ' · diarsipkan' : ''))
      ]),
      el('button', { class:'mg-act', onclick: () => ubahKantong(k) }, 'Ubah')
    ]));
  });

  /* kategori */
  const wc = kosong($('#mgKategori'));
  db.kategori.forEach(k => {
    wc.appendChild(el('div', { class:'mg' }, [
      el('div', { class:'mg-body' }, [
        el('b', null, k.nama),
        el('small', null, k.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')
      ]),
      el('button', { class:'mg-act', onclick: () => {
        const h = Store.hapusKategori(k.id);
        if (!h.ok) toast(pesanTakBisaHapus(h.alasan));
        else renderProfil();
      }}, 'Hapus')
    ]));
  });
}

/* ══════════════════════════════════════════════
   PENGINGAT
   ══════════════════════════════════════════════ */
function renderPengingat() {
  const db = Store.db;
  judulBagian($('#stPengingat'), 'jam', 'Pengingat');

  const w = kosong($('#mgPengingat'));
  if (!db.pengingat.length) {
    w.appendChild(el('p', { class:'fineprint', style:'margin:0 0 4px' },
      'Belum ada. Pengingat menanyakan gaji atau cicilan yang belum kamu catat, ' +
      'dan terus bertanya sampai dijawab.'));
  }

  db.pengingat.forEach(p => {
    const kat = Store.kategori(p.kategori_id);
    w.appendChild(el('div', { class:'mg' + (p.aktif ? '' : ' redup') }, [
      el('div', { class:'tx-ico ' + (p.arah === 'masuk' ? 'masuk' : 'keluar'),
                  style:'width:34px;height:34px;font-size:16px' },
         p.arah === 'masuk' ? '+' : '−'),
      el('div', { class:'mg-body' }, [
        el('b', null, p.judul),
        el('small', null, Pengingat.teksJadwal(p) +
          (p.nominal ? ' · ' + rp(p.nominal) : '') +
          (kat ? ' · ' + kat.nama : ''))
      ]),
      el('button', { class:'mg-act', onclick: () => dialogPengingat(p) }, 'Ubah')
    ]));
  });

  /* izin notifikasi */
  const n = kosong($('#mgNotif'));
  const izin = Pengingat.izinNotifikasi();
  if (izin === 'unsupported') {
    n.appendChild(el('p', { class:'fineprint' },
      'Browser ini tidak mendukung notifikasi. Pengingat tetap muncul sebagai pop-up saat aplikasi dibuka.'));
  } else if (izin === 'granted') {
    n.appendChild(el('p', { class:'fineprint' },
      'Notifikasi aktif. Di web hanya muncul selagi aplikasi terbuka — setelah dibungkus jadi APK, ' +
      'notifikasi bisa muncul walau aplikasi tertutup.'));
  } else if (izin === 'denied') {
    n.appendChild(el('p', { class:'fineprint' },
      'Notifikasi diblokir di pengaturan browser. Pengingat tetap muncul sebagai pop-up saat aplikasi dibuka.'));
  } else {
    n.appendChild(el('button', {
      class:'btn btn-outline btn-block', style:'margin-top:10px',
      onclick: async () => { await Pengingat.mintaIzinNotifikasi(); renderProfil(); }
    }, 'Izinkan notifikasi'));
  }
}

function dialogPengingat(ada) {
  const db = Store.db;
  const arahAwal = ada ? ada.arah : 'keluar';

  const opsiKategori = tipe => db.kategori
    .filter(k => k.tipe === tipe)
    .map(k => ({ v:k.id, t:k.nama }));

  const bangun = (arah) => {
    const tipe = arah === 'masuk' ? 'pemasukan' : 'pengeluaran';
    const kat = opsiKategori(tipe);

    Modal.form({
      judul: ada ? 'Ubah pengingat' : 'Pengingat baru',
      medan: [
        { nama:'judul', label:'Nama', nilai: ada ? ada.judul : '',
          placeholder: arah === 'masuk' ? 'mis. Gaji bulanan' : 'mis. Cicilan laptop' },
        { nama:'arah', label:'Jenis', tipe:'select', nilai: arah, opsi:[
          { v:'keluar', t:'Pengeluaran — cicilan, tagihan' },
          { v:'masuk',  t:'Pemasukan — gaji, setoran' }
        ]},
        { nama:'jadwal_tipe', label:'Setiap', tipe:'select',
          nilai: ada ? ada.jadwal_tipe : 'bulanan', opsi:[
          { v:'bulanan',  t:'Bulanan — tanggal tertentu' },
          { v:'mingguan', t:'Mingguan — hari tertentu' },
          { v:'harian',   t:'Harian' }
        ]},
        { nama:'jadwal_nilai', label:'Tanggal / hari', tipe:'angka',
          nilai: ada ? ada.jadwal_nilai : 1, placeholder:'1' },
        { nama:'nominal', label:'Perkiraan nominal (opsional)', tipe:'angka',
          nilai: ada ? ada.nominal : 0, placeholder:'0' },
        { nama:'kategori_id', label:'Kategori', tipe:'select',
          nilai: ada ? ada.kategori_id : (kat[0] || {}).v,
          opsi: kat.length ? kat : [{ v:'', t:'(belum ada kategori)' }] }
      ],
      onSimpan: v => {
        if (!v.judul) return 'Nama tidak boleh kosong.';

        /* jenis diganti di tengah → bangun ulang supaya daftar
           kategorinya ikut berganti, jangan simpan kategori
           dari jenis yang salah */
        /* Dibangun ulang SESUDAH modal ini ditutup. Modal.form menutup
           dialog begitu onSimpan menjawab kosong — memanggil bangun()
           di sini membuat form penggantinya ikut tertutup seketika,
           dan tidak ada yang tersimpan tanpa satu pun pesan. */
        if (v.arah !== arah) { setTimeout(() => bangun(v.arah), 0); return null; }

        if (v.jadwal_tipe === 'bulanan' && (v.jadwal_nilai < 1 || v.jadwal_nilai > 31))
          return 'Tanggal harus antara 1 sampai 31.';
        if (v.jadwal_tipe === 'mingguan' && (v.jadwal_nilai < 0 || v.jadwal_nilai > 6))
          return 'Hari: 0 = Minggu sampai 6 = Sabtu.';

        const isi = {
          judul: v.judul, arah: v.arah, nominal: v.nominal,
          jadwal_tipe: v.jadwal_tipe, jadwal_nilai: v.jadwal_nilai,
          kategori_id: v.kategori_id,
          akun_id: (Store.akunDefault() || {}).id,
          kantong_id: (Store.kantongDefault() || {}).id
        };

        if (ada) Object.assign(ada, isi); else Store.tambahPengingat(isi);
        Store.simpan(); renderProfil();
      }
    });

    if (ada) setTimeout(() => {
      $('#modalActions').insertBefore(el('button', {
        class:'btn btn-danger-ghost', style:'margin:0',
        onclick: () => { Store.hapusPengingat(ada.id); Modal.tutup(); renderProfil(); }
      }, 'Hapus'), $('#modalActions').firstChild);
    }, 10);
  };

  bangun(arahAwal);
}

/* ── pop-up jatuh tempo ──
   Ditanyakan satu per satu supaya tidak membanjiri. */
let antreanPengingat = [];

function periksaPengingat() {
  const daftar = Pengingat.perluDitanya(Store.db);
  if (!daftar.length) return;

  Pengingat.tampilkanNotifikasi(daftar);
  antreanPengingat = daftar;
  tanyaBerikutnya();
}

function tanyaBerikutnya() {
  const item = antreanPengingat.shift();
  /* Antrean habis — beranda ikut diperbarui supaya kartu yang barusan
     dijawab lewat pop-up tidak tertinggal di sana. */
  if (!item) { if (layarAktif === 'dashboard') renderDashboard(); return; }

  const p = item.p;
  const masuk = p.arah === 'masuk';
  const kat = Store.kategori(p.kategori_id);

  const isi = el('div', null, [
    el('p', { class:'muted', style:'margin-top:0' }, [
      Pengingat.teksJadwal(p).toLowerCase() + ' — jatuh ' +
      Pengingat.teksTelat(item.telat) + ' (' + tglPanjang(item.jatuh) + '). ',
      el('b', null, masuk
        ? 'Uangnya sudah kamu terima?'
        : 'Sudah kamu bayar?')
    ]),
    p.nominal ? el('div', { class:'igt-nominal' }, [
      el('small', null, 'Perkiraan'), el('b', null, rp(p.nominal))
    ]) : null
  ]);

  Modal.buka({
    judul: p.judul,
    isi,
    aksi: [
      { label:'Belum, besok lagi', aksi: () => {
          Pengingat.tundaSehari(p); setTimeout(tanyaBerikutnya, 250);
        }},
      { label:'Sudah, catat', gaya:'btn-primary', aksi: () => {
          bukaInputDariPengingat(p, item.jatuh, item.jatuhStr);
        }}
    ]
  });

  /* pilihan ketiga, sengaja kecil: tidak semua bulan ada gajinya */
  setTimeout(() => {
    const b = $('#modalBody');
    if (!b) return;
    b.appendChild(el('button', {
      class:'igt-lewati',
      onclick: () => {
        Pengingat.lewati(p);
        Modal.tutup();
        setTimeout(tanyaBerikutnya, 250);
      }
    }, 'Lewati periode ini'));
  }, 10);
}

/* Pengingat ditandai terpenuhi SESUDAH transaksinya benar-benar
   tersimpan, bukan saat formulirnya dibuka.

   Sebelumnya ditandai lebih dulu: menekan "Sudah, catat" lalu batal —
   karena nominalnya belum tahu, atau salah tekan — membuat pengingat
   itu diam sampai periode berikutnya, padahal tidak ada yang dicatat.
   Justru gaji dan cicilan seperti itulah yang paling merusak angka
   kalau terlewat. */
function bukaInputDariPengingat(p, tanggal, jatuhStr) {
  bukaInput();
  TX.pengingat = { id: p.id, jatuhStr: jatuhStr || tglInput(tanggal) };
  TX.jenis = p.arah;
  /* Rujukan pengingat bisa sudah tidak ada — dibuat lama, lalu
     rekening atau sumber dananya dihapus. Dijatuhkan ke bawaan supaya
     formulirnya tetap bisa dipakai, bukan tersimpan menunjuk hantu. */
  TX.akun_id = (Store.akun(p.akun_id) || Store.akunDefault() || {}).id;
  TX.kantong_id = (Store.kantong(p.kantong_id) || Store.kantongDefault() || {}).id;
  TX.kategori_id = Store.kategori(p.kategori_id) ? p.kategori_id : '';

  $$('#txJenis button').forEach(x => x.classList.toggle('active', x.dataset.j === p.arah));
  if (p.nominal) tulisAngka($('#txNominal'), p.nominal);
  $('#txKet').value = p.judul;
  $('#txTgl').value = tglInput(tanggal);

  /* Formulirnya diberi nama pengingatnya. Isinya sudah terisi sendiri,
     dan tanpa judul tidak ada yang memberi tahu SEDANG MENJAWAB APA —
     terutama kalau yang jatuh tempo lebih dari satu. */
  judulSheet(p.judul);
  $('#txSave').textContent = p.arah === 'masuk' ? 'Catat penerimaan' : 'Catat pembayaran';

  renderTxRows();
}

/* ══════════════════════════════════════════════
   ALOKASI DANA TITIPAN (global)
   Sama seperti langkah onboarding, tapi bisa dipanggil kapan saja.
   Pengguna menyebut TOTAL tiap dana titipan; selisih terhadap saldo
   sekarang dicatat sebagai transaksi pindah sumber dana, bukan
   diubah diam-diam. Jejaknya tetap ada.
   ══════════════════════════════════════════════ */
function dialogAturTitipan() {
  const db = Store.db;
  const titipan = db.kantong.filter(k => k.jenis === 'titipan');
  const pribadi = Store.kantongDefault();

  if (!titipan.length) {
    toast('Belum ada sumber dana titipan');
    return;
  }

  const r = Calc.ringkas(db);
  const wrap = el('div');
  const isian = {};

  wrap.appendChild(el('p', { class:'muted', style:'margin-top:0;font-size:13.5px' },
    'Sebutkan total tiap dana titipan sekarang. Diambil dari sumber dana mana pun secara otomatis.'));

  titipan.forEach(k => {
    const inp = el('input', { type:'text', inputmode:'numeric', placeholder:'0' });
    pasangFormatAngka(inp);
    tulisAngka(inp, r.saldoKantong[k.id] || 0);
    inp.addEventListener('input', hitung);
    isian[k.id] = inp;

    wrap.appendChild(el('div', { class:'saldo-row' }, [
      el('label', null, [
        el('span', { class:'kt-dot', style:'background:' + k.warna + ';display:inline-block;margin-right:7px;vertical-align:-1px' }),
        k.nama
      ]),
      el('div', { class:'saldo-in' }, [ el('span', null, 'Rp'), inp ])
    ]));
  });

  const kotak = el('div', { class:'hitung', style:'margin-top:14px' });
  wrap.appendChild(kotak);

  function totalBaru() {
    return titipan.reduce((s, k) => s + bacaAngka(isian[k.id]), 0);
  }

  function hitung() {
    const t = totalBaru();
    const sisa = r.totalFisik - t;
    const lebih = sisa < 0;
    kosong(kotak);
    kotak.className = 'hitung' + (lebih ? ' bahaya' : '');

    const baris = (l, n, c) => kotak.appendChild(el('div', { class:'hitung-baris ' + (c||'') }, [
      el('span', null, l), el('b', null, rp(n))
    ]));
    baris('Total semua tempat', r.totalFisik);
    baris('Dana titipan', -t);
    kotak.appendChild(el('div', { class:'hitung-garis' }));
    baris(lebih ? 'Kelebihan' : 'Uang kamu sendiri', sisa, 'hasil');

    kotak.appendChild(el('p', { class:'hitung-pesan', html:
      svgIkon(lebih ? 'peringatan' : 'cek', 15) + '<span>' + (lebih
        ? 'Dana titipan melebihi total uang yang ada. Cek lagi datanya — mungkin ada transaksi yang salah atau belum tercatat.'
        : 'Pas. Selisih terhadap catatan sekarang akan dicatat sebagai pindah sumber dana.') + '</span>' }));
  }
  hitung();

  Modal.buka({
    judul: 'Atur total dana titipan',
    isi: wrap,
    aksi: [
      { label:'Batal' },
      { label:'Terapkan', gaya:'btn-primary', tutup:false, aksi: () => {
        if (r.totalFisik - totalBaru() < 0) { toast('Masih melebihi total uang yang ada'); return; }
        if (!pribadi) { toast('Tidak ada sumber dana milik sendiri'); return; }

        /* Salinan matriks yang IKUT BERUBAH selama penyesuaian berjalan.

           Dulu tiap perpindahan memilih tempat dari matriks yang sama
           dan sudah basi, lalu memindahkan seluruh jumlahnya dari satu
           tempat saja. Dua dana titipan yang sama-sama diambil dari
           uang pribadi jadi menunjuk rekening yang sama, dan sel
           matriksnya jebol minus tanpa satu pun peringatan — rekening
           berisi 600rb bisa mengaku menyimpan dua titipan @500rb. */
        const mx = JSON.parse(JSON.stringify(r.matriks));
        const sel = (ak, kt) => (mx[ak] && mx[ak][kt]) || 0;
        const geser = (ak, kt, n) => {
          if (!mx[ak]) mx[ak] = {};
          mx[ak][kt] = sel(ak, kt) + n;
        };

        /* Rencana dikumpulkan dulu dan baru dicatat kalau SELURUHNYA cukup.
           Dulu setiap langkah langsung dicatat, jadi kalau langkah terakhir
           gagal, langkah sebelumnya sudah tersimpan setengah jalan — dan
           sisa yang tidak tertampung dipaksa jadi minus di satu rekening. */
        const rencana = [];
        let kurang = null;

        /* Satu perpindahan dipecah ke beberapa tempat kalau memang
           uangnya tersebar — mengikuti isi sebenarnya, dari yang
           paling banyak. */
        const pindahkan = (asal, tujuan, jumlah, nama) => {
          const urut = db.akun.filter(a => a.aktif)
            .sort((x, y) => sel(y.id, asal) - sel(x.id, asal));
          let sisa = jumlah, n = 0;

          urut.forEach(a => {
            if (sisa <= 0) return;
            const ada = sel(a.id, asal);
            if (ada <= 0) return;
            const ambil = Math.min(sisa, ada);
            geser(a.id, asal, -ambil);
            geser(a.id, tujuan, ambil);
            sisa -= ambil;
            n++;
            rencana.push({
              jenis:'transfer_kantong', nominal: ambil,
              akun_id: a.id, kantong_id: asal, kantong_tujuan_id: tujuan,
              keterangan: 'Penyesuaian dana titipan — ' + nama
            });
          });

          if (sisa > 0 && !kurang) kurang = nama;
          return n;
        };

        const beda = k => bacaAngka(isian[k.id]) - (r.saldoKantong[k.id] || 0);

        /* Yang BERKURANG dikerjakan lebih dulu: uangnya kembali ke
           dana pribadi dan langsung bisa dipakai oleh titipan yang
           bertambah. Urutan terbalik membuat penyesuaian yang
           sebenarnya pas jadi terlihat kurang. */
        let jumlahUbah = 0;
        titipan.filter(k => beda(k) < 0).forEach(k => {
          jumlahUbah += pindahkan(k.id, pribadi.id, -beda(k), k.nama) ? 1 : 0;
        });
        titipan.filter(k => beda(k) > 0).forEach(k => {
          jumlahUbah += pindahkan(pribadi.id, k.id, beda(k), k.nama) ? 1 : 0;
        });

        if (kurang) {
          toast('Uang di ' + kurang + ' tidak cukup di tempat mana pun. Tidak ada yang diubah.');
          return;
        }
        rencana.forEach(l => Store.catat(l));

        Modal.tutup();
        segarkan();
        toast(jumlahUbah ? jumlahUbah + ' sumber dana disesuaikan' : 'Tidak ada yang berubah');
      }}
    ]
  });
}

/* ── kunci saldo ── */
function renderKunci() {
  const w = kosong($('#mgKunci'));
  const punya = Store.punyaKunci(), kunci = Store.terkunci();

  if (!punya) {
    w.appendChild(el('button', {
      class:'btn btn-outline btn-block', style:'margin-bottom:10px',
      onclick: dialogBuatPin
    }, [ el('span', { html: svgIkon('gembok', 16) }), 'Kunci saldo dengan PIN' ]));
    return;
  }

  w.appendChild(el('div', { class:'kunci-bar' + (kunci ? ' aktif' : '') }, [
    el('span', { class:'kunci-ikon', html: svgIkon(kunci ? 'gembok' : 'cek', 16) }),
    el('div', { class:'mg-body' }, [
      el('b', null, kunci ? 'Saldo terkunci' : 'Saldo terbuka'),
      el('small', null, kunci
        ? 'Nominal rekening tidak bisa diubah'
        : 'Nominal bisa diubah — kunci lagi kalau sudah selesai')
    ]),
    el('button', {
      class:'mg-act',
      onclick: () => kunci
        ? mintaPin('Buka kunci', async pin => {
            const ok = await Store.bukaKunci(pin);
            if (ok) { renderProfil(); toast('Kunci dibuka'); }
            return ok ? null : 'PIN salah.';
          })
        : Store.kunciLagi().then(() => { renderProfil(); toast('Saldo dikunci'); })
    }, kunci ? 'Buka' : 'Kunci')
  ]));

  w.appendChild(el('p', { class:'fineprint', style:'margin-bottom:12px' },
    'PIN ini rem, bukan pengaman. Ia mencegah angka pokok berubah tanpa sengaja, ' +
    'tapi siapa pun yang paham browser tetap bisa menembusnya. Jangan pakai PIN yang sama dengan PIN bank.'));
}

function dialogBuatPin() {
  Modal.form({
    judul:'Buat PIN',
    medan: [
      { nama:'pin',  label:'PIN baru (4–8 angka)', tipe:'pin', placeholder:'••••' },
      { nama:'ulang',label:'Ulangi PIN', tipe:'pin', placeholder:'••••' }
    ],
    labelSimpan:'Kunci',
    onSimpan: v => {
      if (!/^\d{4,8}$/.test(v.pin)) return 'PIN harus 4 sampai 8 angka.';
      if (v.pin !== v.ulang) return 'Ulangan PIN tidak sama.';
      Store.pasangKunci(v.pin).then(() => { renderProfil(); toast('Saldo dikunci'); });
    }
  });
}

/* Meminta PIN lalu menjalankan aksi. Aksi mengembalikan pesan galat
   kalau PIN salah, atau null kalau berhasil. */
function mintaPin(judul, aksi) {
  Modal.form({
    judul,
    medan: [{ nama:'pin', label:'PIN', tipe:'pin', placeholder:'••••' }],
    labelSimpan:'Lanjut',
    onSimpan: v => {
      if (!v.pin) return 'PIN belum diisi.';
      /* Jawaban aksi diteruskan apa adanya, termasuk kalau berupa
         janji. Modal.form yang menunggu — dulu jawaban "PIN salah"
         datang ketika dialognya sudah telanjur tertutup, jadi
         pengguna harus membuka menunya lagi untuk mencoba ulang. */
      return aksi(v.pin);
    }
  });
}

/* Sebab penolakan disebutkan apa adanya. "Sudah dipakai transaksi"
   untuk sesuatu yang sebenarnya dipakai pengingat membuat pengguna
   mencari-cari transaksi yang tidak pernah ada. */
function pesanTakBisaHapus(alasan) {
  return alasan === 'pengingat'
    ? 'Masih dipakai pengingat. Hapus atau ubah pengingatnya dulu.'
    : 'Sudah dipakai transaksi, tidak bisa dihapus';
}

function ubahAkun(a) {
  const terkunci = Store.terkunci();
  const db = Store.db;
  const matriks = Calc.matriks(db);
  const sel = kt => (matriks[a.id] || {})[kt.id] || 0;

  /* Saldo diisi per sumber dana, karena saldo rekening itu sendiri
     terdiri dari beberapa sumber dana. Sumber dana yang belum pernah
     punya uang di rekening ini tetap muncul, supaya bisa diisi. */
  const sumber = db.kantong.filter(k => !k.arsip || sel(k) !== 0);
  const medan = [{ nama:'nama', label:'Nama tampilan', nilai:a.nama }];
  if (terkunci) {
    sumber.forEach(k => {
      if (sel(k) !== 0) medan.push({ nama:'_' + k.id, label: k.nama, tipe:'statis', nilai: rp(sel(k)) });
    });
  } else {
    sumber.forEach(k => medan.push({
      nama: 'saldo_' + k.id, label: 'Saldo di ' + k.nama, tipe:'angka',
      nilai: sel(k), placeholder:'0'
    }));
  }

  Modal.form({
    judul:'Ubah ' + a.nama,
    medan,
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      if (!terkunci) {
        const minus = sumber.find(k => (Number(v['saldo_' + k.id]) || 0) < 0);
        if (minus) return 'Saldo di ' + minus.nama + ' tidak boleh minus.';
        sumber.forEach(k => Store.sesuaikanSaldo(a.id, k.id, Number(v['saldo_' + k.id]) || 0));
      }
      a.nama = v.nama;
      Store.simpan(); renderProfil();
    }
  });

  if (terkunci) {
    setTimeout(() => {
      $('#modalBody').appendChild(el('p', { class:'fineprint', style:'margin:-6px 0 0' },
        'Saldo sedang dikunci. Buka kunci di bagian atas halaman Profil untuk mengubahnya.'));
    }, 10);
  }
  setTimeout(() => {
    $('#modalActions').insertBefore(el('button', {
      class:'btn btn-danger-ghost', style:'margin:0',
      onclick: () => {
        const h = Store.hapusAkun(a.id);
        if (!h.ok) toast(pesanTakBisaHapus(h.alasan));
        else { Modal.tutup(); renderProfil(); }
      }
    }, 'Hapus'), $('#modalActions').firstChild);
  }, 10);
}

function ubahKantong(k) {
  Modal.form({
    judul:'Ubah sumber dana',
    medan: [
      { nama:'nama', label:'Nama sumber dana', nilai:k.nama },
      { nama:'jenis', label:'Jenis', tipe:'select', nilai:k.jenis, opsi:[
        { v:'milik_sendiri', t:'Pribadi — milik saya' },
        { v:'titipan', t:'Titipan — bukan milik saya' }
      ]}
    ],
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      /* validasi dulu, baru ubah — kalau ditolak sesudah diubah,
         objeknya terlanjur rusak sampai halaman dimuat ulang */
      const masihAdaMilikSendiri = Store.db.kantong.some(
        x => x.id === k.id ? v.jenis === 'milik_sendiri' : x.jenis === 'milik_sendiri');
      if (!masihAdaMilikSendiri)
        return 'Harus ada minimal satu sumber dana milik sendiri.';

      k.nama = v.nama; k.jenis = v.jenis;
      if (k.jenis === 'titipan' && k.is_default) {
        k.is_default = false;
        const milik = Store.db.kantong.find(x => x.jenis === 'milik_sendiri');
        if (milik) milik.is_default = true;
      }
      Store.simpan(); renderProfil();
    }
  });
  setTimeout(() => {
    $('#modalActions').insertBefore(el('button', {
      class:'btn btn-danger-ghost', style:'margin:0',
      onclick: () => {
        const h = Store.hapusKantong(k.id);
        if (!h.ok) toast(pesanTakBisaHapus(h.alasan));
        else { Modal.tutup(); renderProfil(); }
      }
    }, 'Hapus'), $('#modalActions').firstChild);

    /* Sumber dana yang sudah dipakai riwayat tidak bisa dihapus, tapi bisa
       diarsipkan: tidak ditawarkan lagi, riwayatnya tetap utuh. */
    const ekstra = el('div', { style:'display:flex;flex-direction:column;gap:8px;margin-top:4px' });
    if (!k.arsip && k.jenis === 'milik_sendiri' && !k.is_default) {
      ekstra.appendChild(el('button', { class:'btn btn-outline btn-block', onclick: () => {
        Store.jadikanDefaultKantong(k.id); Modal.tutup(); renderProfil();
        toast(k.nama + ' jadi sumber dana default');
      } }, 'Jadikan default'));
    }
    ekstra.appendChild(el('button', { class:'btn btn-outline btn-block', onclick: () => {
      const h = Store.arsipkanKantong(k.id, !k.arsip);
      if (!h.ok) { toast(h.alasan); return; }
      Modal.tutup(); renderProfil();
      toast(k.arsip ? k.nama + ' diarsipkan' : k.nama + ' aktif lagi');
    } }, k.arsip ? 'Aktifkan lagi' : 'Arsipkan (sembunyikan dari pilihan)'));
    $('#modalBody').appendChild(ekstra);
  }, 10);
}
