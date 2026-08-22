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

function navTo(nama) {
  layarAktif = nama;
  ['dashboard','transaksi','laporan','profil'].forEach(n => {
    $('#scr-' + n).hidden = (n !== nama);
  });
  $$('#bottomnav button[data-nav]').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nama));

  if (nama === 'dashboard') renderDashboard();
  if (nama === 'transaksi') renderTransaksi();
  if (nama === 'laporan')   renderLaporan();
  if (nama === 'profil')    renderProfil();
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
  namaPribadi: 'Uang Pribadi',
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
      if (this.punyaTitipan && !this.namaPribadi.trim()) this.namaPribadi = 'Uang Pribadi';
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
    return [{ key:'_pribadi', nama: this.namaPribadi || 'Uang Pribadi', jenis:'milik_sendiri' }]
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
      nama: this.punyaTitipan ? (this.namaPribadi || 'Uang Pribadi') : 'Uang Saya',
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

  const jam = new Date().getHours();
  $('#dashSapaan').textContent =
    jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' :
    jam < 19 ? 'Selamat sore' : 'Selamat malam';
  $('#dashNama').textContent = db.profil.nama || 'DompetQ';

  /* kartu utama */
  const bahaya = r.negatif.length > 0;
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

  /* peringatan */
  const wb = kosong($('#warnBox'));
  r.negatif.forEach(n => {
    wb.appendChild(el('div', { class:'warn' }, [
      el('div', null, [
        el('b', null, n.kantong.nama + ' minus ' + rp(Math.abs(n.nilai))),
        n.kantong.jenis === 'titipan'
          ? 'Uang titipan terpakai untuk keperluan lain. Segera kembalikan atau catat penggantiannya lewat "Pindah".'
          : 'Pengeluaran melebihi saldo yang tercatat. Cek lagi catatannya.'
      ])
    ]));
  });

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
    db.kantong.forEach(k => {
      const v = r.saldoKantong[k.id] || 0;
      wk.appendChild(el('div', { class:'kt-row' }, [
        el('div', { class:'kt-dot', style:'background:' + k.warna }),
        el('div', { class:'kt-nm' }, k.nama),
        el('span', { class:'tag ' + (k.jenis === 'titipan' ? 'titipan' : 'milik') },
           k.jenis === 'titipan' ? 'titipan' : 'milik saya'),
        el('div', { class:'kt-val' + (v < 0 ? ' neg' : '') }, rp(v))
      ]));
    });
  }

  /* grafik 30 hari */
  const kini = new Date();
  const lalu = new Date(kini.getTime() - 30 * 864e5);
  const pk = Calc.perKategori(db, lalu, kini, 'keluar');
  judulBagian($('#stGrafik'), 'grafik', 'Pengeluaran 30 hari', pk.total ? rp(pk.total) : '');
  renderBars($('#dashBars'), pk, 'Belum ada pengeluaran dalam 30 hari terakhir.');

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
    w.appendChild(el('div', { class:'igt-nanti' }, [
      el('div', { class:'igt-titik ' + (item.p.arah === 'masuk' ? 'masuk' : 'keluar') }),
      el('div', { class:'igt-nanti-body' }, [
        el('b', null, item.p.judul),
        el('small', null, Pengingat.teksSisa(item.sisa) +
          (item.p.nominal ? ' · ' + rp(item.p.nominal) : ''))
      ])
    ]));
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
    judul = t.keterangan || (k ? k.nama : namaJenis(t.jenis));
    const bagian = [ (Store.akun(t.akun_id) || {}).nama ];
    if (!Store.modeSederhana()) bagian.push((Store.kantong(t.kantong_id) || {}).nama);
    if (k && t.keterangan) bagian.unshift(k.nama);
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
             jenisAsli: '' };

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

function bukaInput() {
  const ak = Store.akunDefault(), kt = Store.kantongDefault();
  if (!ak || !kt) { toast('Tambahkan akun dulu di Profil'); return; }

  TX.jenis = 'keluar'; TX.sub = 'akun';
  TX.akun_id = ak.id; TX.akun_tujuan_id = '';
  TX.kantong_id = kt.id; TX.kantong_tujuan_id = '';
  TX.kategori_id = '';
  TX.pengingat = null;
  TX.edit = null;
  TX.jenisAsli = '';
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
    onPilih: o => { TX[field] = o.id; renderTxRows(); },
    tambah: { label:'+ Tambah tempat baru', aksi: () => dialogTambahAkun(id => { TX[field] = id; renderTxRows(); }) }
  });

  const pilihKantong = (field, judul) => () => Modal.pilih({
    judul,
    opsi: db.kantong.map(k => ({
      id:k.id, nama:k.nama, ikon: k.jenis === 'titipan' ? 'T' : 'S', warna:k.warna,
      ket: k.jenis === 'titipan' ? 'Titipan — bukan milikmu' : 'Milikmu sendiri'
    })),
    terpilih: TX[field],
    onPilih: o => { TX[field] = o.id; renderTxRows(); }
  });

  const namaAkun = id => (Store.akun(id) || {}).nama;
  const objKantong = id => Store.kantong(id) || {};

  if (TX.jenis === 'keluar' || TX.jenis === 'masuk') {
    w.appendChild(pickRow('Dari / ke tempat', namaAkun(TX.akun_id), 'Pilih', pilihAkun('akun_id', 'Pilih tempat')));

    if (!sederhana) {
      const k = objKantong(TX.kantong_id);
      w.appendChild(pickRow('Sumber dana', k.nama, 'Pilih',
        pilihKantong('kantong_id', 'Uang ini milik siapa?'), k.warna));
    }

    const tipe = TX.jenis === 'keluar' ? 'pengeluaran' : 'pemasukan';
    const kat = Store.kategori(TX.kategori_id);
    w.appendChild(pickRow('Kategori', kat ? kat.nama : '', 'Pilih', () => Modal.pilih({
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
    if (!sederhana) {
      const k = objKantong(TX.kantong_id);
      w.appendChild(pickRow('Sumber dana', k.nama, 'Pilih',
        pilihKantong('kantong_id', 'Uang siapa yang dipindah?'), k.warna));
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
}

function simpanTx() {
  const err = $('#txError');
  const gagal = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;

  const nominal = bacaAngka($('#txNominal'));
  if (nominal <= 0) return gagal('Nominal belum diisi.');
  if (!TX.akun_id) return gagal('Pilih tempat uangnya dulu.');

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
    if (!TX.kategori_id) return gagal('Pilih kategori dulu.');
    calon.jenis = TX.jenis;
    calon.kategori_id = TX.kategori_id;
    /* saldo awal yang dikoreksi tetap saldo awal selama arahnya
       tidak diubah pengguna — kalau tidak, angkanya pindah ke
       laporan pemasukan dan arus kas bulan itu ikut melar. */
    if (TX.edit && TX.jenisAsli === 'saldo_awal' && TX.jenis === 'masuk')
      calon.jenis = 'saldo_awal';

  } else if (TX.sub === 'akun') {
    if (!TX.akun_tujuan_id) return gagal('Pilih tempat tujuan.');
    if (TX.akun_tujuan_id === TX.akun_id) return gagal('Tempat asal dan tujuan tidak boleh sama.');
    calon.jenis = 'transfer_akun';
    calon.akun_tujuan_id = TX.akun_tujuan_id;

  } else {
    if (!TX.kantong_tujuan_id) return gagal('Pilih sumber dana tujuan.');
    if (TX.kantong_tujuan_id === TX.kantong_id) return gagal('Sumber dana asal dan tujuan tidak boleh sama.');
    calon.jenis = 'transfer_kantong';
    calon.kantong_tujuan_id = TX.kantong_tujuan_id;
  }

  /* peringatan saldo jebol — memberi tahu, bukan melarang.
     Saat mengoreksi, baris lama akan dibalik, jadi dampaknya dihitung
     terhadap data TANPA baris itu. Kalau tidak, memperbaiki salah ketik
     nominal besar selalu memunculkan peringatan palsu. */
  const dbUji = TX.edit
    ? Object.assign({}, Store.db, { transaksi: Store.db.transaksi.filter(t => t.id !== TX.edit) })
    : Store.db;
  const dampak = Calc.cekDampak(dbUji, calon);
  if (dampak.length) {
    const d = dampak[0];
    const titipan = d.kantong && d.kantong.jenis === 'titipan';
    Modal.konfirmasi({
      judul: titipan ? 'Ini uang titipan' : 'Saldo jadi minus',
      pesan: titipan
        ? `${d.kantong.nama} di ${d.akun.nama} akan jadi ${rp(d.sesudah)}. Artinya uang orang lain terpakai. Tetap catat?`
        : `${d.kantong ? d.kantong.nama : 'Saldo'} di ${d.akun.nama} akan jadi ${rp(d.sesudah)}. Mungkin ada transaksi yang belum dicatat. Tetap simpan?`,
      labelYa:'Tetap catat', gayaYa:'btn-primary',
      onYa: () => finalTx(calon)
    });
    return;
  }
  finalTx(calon);
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

  Store.catat(calon);

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
}

function renderTransaksi() {
  const db = Store.db;
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

  if (cari) daftar = daftar.filter(t => {
    const k = Store.kategori(t.kategori_id);
    return (t.keterangan || '').toLowerCase().includes(cari) ||
           (k && k.nama.toLowerCase().includes(cari)) ||
           String(t.nominal).includes(cari);
  });

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

  const kas = Calc.arusKas(db, dari, sampai, !sederhana);
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
      { nama:'nama', label:'Nama', placeholder:'mis. Kas RT' },
      { nama:'jenis', label:'Jenis', tipe:'select', opsi:[
        { v:'titipan', t:'Titipan — bukan milik saya' },
        { v:'milik_sendiri', t:'Milik saya sendiri' }
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
    wk.appendChild(el('div', { class:'mg' }, [
      el('div', { class:'kt-dot', style:'background:' + k.warna }),
      el('div', { class:'mg-body' }, [
        el('b', null, k.nama),
        el('small', null, rp(r.saldoKantong[k.id] || 0) + ' · ' +
          (k.jenis === 'titipan' ? 'Titipan' : 'Milik saya'))
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
        if (!h.ok) toast('Sudah dipakai transaksi, tidak bisa dihapus');
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
        if (v.arah !== arah) { bangun(v.arah); return null; }

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
  TX.akun_id = p.akun_id || (Store.akunDefault() || {}).id;
  TX.kantong_id = p.kantong_id || (Store.kantongDefault() || {}).id;
  TX.kategori_id = p.kategori_id;

  $$('#txJenis button').forEach(x => x.classList.toggle('active', x.dataset.j === p.arah));
  if (p.nominal) tulisAngka($('#txNominal'), p.nominal);
  $('#txKet').value = p.judul;
  $('#txTgl').value = tglInput(tanggal);
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
  const pribadi = db.kantong.find(k => k.jenis === 'milik_sendiri');

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

        let jumlahUbah = 0;
        titipan.forEach(k => {
          const target = bacaAngka(isian[k.id]);
          const kini = r.saldoKantong[k.id] || 0;
          const beda = target - kini;
          if (beda === 0) return;

          /* pilih tempat yang saldo sumber asalnya paling besar,
             supaya perpindahan tidak membuat sel jadi minus */
          const asal = beda > 0 ? pribadi.id : k.id;
          const tujuan = beda > 0 ? k.id : pribadi.id;
          const akunId = akunTerbanyak(r.matriks, asal, db);

          Store.catat({
            jenis:'transfer_kantong', nominal: Math.abs(beda),
            akun_id: akunId, kantong_id: asal, kantong_tujuan_id: tujuan,
            keterangan: 'Penyesuaian dana titipan — ' + k.nama
          });
          jumlahUbah++;
        });

        Modal.tutup();
        segarkan();
        toast(jumlahUbah ? jumlahUbah + ' sumber dana disesuaikan' : 'Tidak ada yang berubah');
      }}
    ]
  });
}

/* akun yang menyimpan paling banyak dari sebuah sumber dana */
function akunTerbanyak(matriks, kantongId, db) {
  let terbaik = null, tertinggi = -Infinity;
  db.akun.forEach(a => {
    const n = (matriks[a.id] && matriks[a.id][kantongId]) || 0;
    if (n > tertinggi) { tertinggi = n; terbaik = a.id; }
  });
  return terbaik || (Store.akunDefault() || {}).id;
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
      const hasil = aksi(v.pin);
      /* aksi boleh async — modal ditutup sendiri lewat renderProfil */
      if (hasil && typeof hasil.then === 'function') {
        hasil.then(pesan => { if (pesan) toast(pesan); });
        return null;
      }
      return hasil;
    }
  });
}

function ubahAkun(a) {
  const terkunci = Store.terkunci();
  const saldoKini = Calc.ringkas(Store.db).saldoAkun[a.id] || 0;

  const medan = [{ nama:'nama', label:'Nama tampilan', nilai:a.nama }];
  if (terkunci) {
    medan.push({ nama:'_saldo', label:'Saldo', tipe:'statis', nilai: rp(saldoKini) });
  } else {
    medan.push({ nama:'saldo', label:'Saldo sebenarnya', tipe:'angka',
                 nilai: saldoKini, placeholder:'0' });
  }

  Modal.form({
    judul:'Ubah ' + a.nama,
    medan,
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      a.nama = v.nama;

      if (!terkunci && v.saldo !== saldoKini) {
        const selisih = v.saldo - saldoKini;
        Store.sesuaikanSaldo(a.id, v.saldo);
        toast('Selisih ' + (selisih > 0 ? '+' : '') + rp(selisih) + ' dicatat sebagai penyesuaian');
      }
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
        if (!h.ok) toast('Sudah dipakai transaksi, tidak bisa dihapus');
        else { Modal.tutup(); renderProfil(); }
      }
    }, 'Hapus'), $('#modalActions').firstChild);
  }, 10);
}

function ubahKantong(k) {
  Modal.form({
    judul:'Ubah sumber dana',
    medan: [
      { nama:'nama', label:'Nama', nilai:k.nama },
      { nama:'jenis', label:'Jenis', tipe:'select', nilai:k.jenis, opsi:[
        { v:'titipan', t:'Titipan — bukan milik saya' },
        { v:'milik_sendiri', t:'Milik saya sendiri' }
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
        if (!h.ok) toast('Sudah dipakai transaksi, tidak bisa dihapus');
        else { Modal.tutup(); renderProfil(); }
      }
    }, 'Hapus'), $('#modalActions').firstChild);
  }, 10);
}
