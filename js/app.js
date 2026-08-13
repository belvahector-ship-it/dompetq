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

  const aksi = [{ label:'Tutup' }];
  if (!dikoreksi && !t.reversal_dari) {
    aksi.push({
      label:'Koreksi', gaya:'btn-danger-ghost',
      aksi: () => {
        Modal.konfirmasi({
          judul:'Koreksi transaksi',
          pesan:'Transaksi asli tetap tersimpan sebagai riwayat, lalu ditambahkan entri pembalik. Saldo kembali seperti sebelum transaksi ini.',
          labelYa:'Ya, koreksi', gayaYa:'btn-primary',
          onYa: () => { Store.batalkan(t.id); segarkan(); toast('Sudah dikoreksi'); }
        });
      }
    });
  }

  Modal.buka({
    judul: dikoreksi ? 'Transaksi (sudah dikoreksi)' : 'Detail transaksi',
    isi: '<div style="margin:-6px 0 0">' + baris.join('') + '</div>',
    aksi
  });
}

/* ══════════════════════════════════════════════
   INPUT TRANSAKSI
   ══════════════════════════════════════════════ */
const TX = { jenis:'keluar', sub:'akun', akun_id:'', akun_tujuan_id:'',
             kantong_id:'', kantong_tujuan_id:'', kategori_id:'' };

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

  $$('#txJenis button').forEach(x => x.classList.toggle('active', x.dataset.j === 'keluar'));
  $('#txNominal').value = '';
  $('#txKet').value = '';
  $('#txTgl').value = tglInput(new Date());
  $('#txError').hidden = true;

  renderTxRows();
  $('#sheetBackdrop').hidden = false;
  $('#sheetInput').hidden = false;
  setTimeout(() => $('#txNominal').focus(), 120);
}

function tutupInput() {
  $('#sheetBackdrop').hidden = true;
  $('#sheetInput').hidden = true;
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

  /* peringatan saldo jebol — memberi tahu, bukan melarang */
  const dampak = Calc.cekDampak(Store.db, calon);
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
  Store.catat(calon);
  tutupInput();
  segarkan();
  toast('Tercatat · ' + rp(calon.nominal));
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
  const blob = new Blob([isi], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href:url, download:nama });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
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
    w.appendChild(el('p', { class:'fineprint' },
      'Spreadsheet dibuat di Google Drive milikmu sendiri. Pembuat aplikasi ini ' +
      'tidak bisa membukanya. Kamu bisa mencabut aksesnya kapan pun.'));
    return;
  }

  const status = s.sedang ? 'Menyimpan…'
               : s.galat  ? s.galat
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

async function sambungkanGoogle() {
  toast('Membuka login Google…');
  let putusan;
  try {
    putusan = await Store.sambungkanSheets();
  } catch (e) {
    Modal.buka({
      judul: 'Gagal menyambungkan',
      isi: el('p', { class:'muted', style:'margin:0' }, e.message),
      aksi: [{ label:'Tutup', gaya:'btn-primary' }]
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
  const jauh = putusan.jauh, lokal = putusan.lokal;
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
      { label:'Pakai Sheets', aksi: () => pakai('unduh', jauh) },
      { label:'Satukan', gaya:'btn-primary', aksi: () => pakai('satukan', jauh) }
    ]
  });
}

function renderProfil() {
  const db = Store.db;
  const r = Calc.ringkas(db);
  renderSheets();

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

function ubahAkun(a) {
  Modal.form({
    judul:'Ubah akun',
    medan: [{ nama:'nama', label:'Nama tampilan', nilai:a.nama }],
    onSimpan: v => {
      if (!v.nama) return 'Nama tidak boleh kosong.';
      a.nama = v.nama; Store.simpan(); renderProfil();
    }
  });
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
