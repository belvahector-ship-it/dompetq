/* ══════════════════════════════════════════════
   pengingat.js — alarm pemasukan & pengeluaran rutin

   MASALAHNYA
   Risiko terbesar aplikasi keuangan bukan bug, tapi berhenti dipakai.
   Yang paling sering terlewat justru yang paling besar: gaji masuk
   tanggal 5, cicilan jatuh tanggal 20. Kalau dua itu lupa dicatat,
   seluruh angka di aplikasi jadi bohong.

   KONSEPNYA
   Pengingat bukan notifikasi yang lewat begitu saja, melainkan
   PERTANYAAN YANG MENUNGGU DIJAWAB. Selama belum dijawab untuk
   periode berjalan, ia akan muncul lagi setiap kali aplikasi dibuka.

   Tiga keadaan tiap pengingat:
     terpenuhi  — sudah dicatat untuk periode ini, diam sampai periode berikutnya
     ditunda    — pengguna bilang "belum, ingatkan besok"
     menunggu   — jatuh tempo sudah lewat dan belum dijawab → tanyakan

   Yang TIDAK dilakukan: mencatat transaksi sendiri. Pengingat hanya
   bertanya; yang memutuskan angka dan menekan simpan tetap pengguna.
   Uang tidak boleh dicatat oleh tebakan aplikasi.
   ══════════════════════════════════════════════ */

const Pengingat = {

  /* ── kapan seharusnya terjadi ──
     Tanggal jatuh tempo TERAKHIR yang sudah lewat atau tepat hari ini. */
  jatuhTerakhir(p, kini) {
    const h = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());

    if (p.jadwal_tipe === 'harian') return h;

    if (p.jadwal_tipe === 'mingguan') {
      const target = Number(p.jadwal_nilai) || 0;          // 0 = Minggu
      const mundur = (h.getDay() - target + 7) % 7;
      return new Date(h.getFullYear(), h.getMonth(), h.getDate() - mundur);
    }

    /* bulanan — tanggal 31 pada bulan pendek jatuh di hari terakhir,
       bukan tumpah ke bulan berikutnya */
    const hariTarget = Math.min(Math.max(Number(p.jadwal_nilai) || 1, 1), 31);
    const diBulan = (thn, bln) => {
      const akhir = new Date(thn, bln + 1, 0).getDate();
      return new Date(thn, bln, Math.min(hariTarget, akhir));
    };
    const bulanIni = diBulan(h.getFullYear(), h.getMonth());
    return bulanIni <= h ? bulanIni : diBulan(h.getFullYear(), h.getMonth() - 1);
  },

  /* Tanggal jatuh tempo BERIKUTNYA — yang belum lewat.
     Dipakai beranda untuk menampilkan apa yang sedang menunggu
     giliran, supaya bagian pengingat tetap berguna di hari-hari
     ketika tidak ada satu pun yang jatuh tempo. */
  jatuhBerikut(p, kini) {
    kini = kini || new Date();
    const h = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());

    if (p.jadwal_tipe === 'harian')
      return new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1);

    if (p.jadwal_tipe === 'mingguan') {
      const target = Number(p.jadwal_nilai) || 0;
      let maju = (target - h.getDay() + 7) % 7;
      if (maju === 0) maju = 7;                 // hari ini sudah lewat gilirannya
      return new Date(h.getFullYear(), h.getMonth(), h.getDate() + maju);
    }

    const hariTarget = Math.min(Math.max(Number(p.jadwal_nilai) || 1, 1), 31);
    const diBulan = (thn, bln) => {
      const akhir = new Date(thn, bln + 1, 0).getDate();
      return new Date(thn, bln, Math.min(hariTarget, akhir));
    };
    const bulanIni = diBulan(h.getFullYear(), h.getMonth());
    return bulanIni > h ? bulanIni : diBulan(h.getFullYear(), h.getMonth() + 1);
  },

  /* ── mana yang perlu ditanyakan sekarang ── */
  perluDitanya(db, kini) {
    kini = kini || new Date();
    const hariIni = tglInput(kini);
    const out = [];

    (db.pengingat || []).forEach(p => {
      if (!p.aktif) return;
      if (p.ditunda_sampai && p.ditunda_sampai > hariIni) return;

      const jatuh = this.jatuhTerakhir(p, kini);
      const jatuhStr = tglInput(jatuh);

      /* sudah dijawab untuk periode ini */
      if (p.terakhir_dipenuhi && p.terakhir_dipenuhi >= jatuhStr) return;

      out.push({ p, jatuh, jatuhStr, telat: Math.round((kini - jatuh) / 864e5) });
    });

    /* yang paling telat ditanya lebih dulu */
    return out.sort((a, b) => b.telat - a.telat);
  },

  /* ── jawaban pengguna ── */
  tandaiTerpenuhi(p, tanggal) {
    p.terakhir_dipenuhi = tanggal || tglInput(new Date());
    p.ditunda_sampai = '';
    Store.simpan();
  },

  tundaSehari(p) {
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    p.ditunda_sampai = tglInput(besok);
    Store.simpan();
  },

  /* "sudah lewat, lompati periode ini" — dianggap terpenuhi tanpa
     mencatat transaksi apa pun */
  lewati(p, kini) {
    p.terakhir_dipenuhi = tglInput(this.jatuhTerakhir(p, kini || new Date()));
    p.ditunda_sampai = '';
    Store.simpan();
  },

  /* ── teks ── */
  teksJadwal(p) {
    if (p.jadwal_tipe === 'harian') return 'Setiap hari';
    if (p.jadwal_tipe === 'mingguan') return 'Setiap ' + HARI[Number(p.jadwal_nilai) || 0];
    return 'Setiap tanggal ' + (Number(p.jadwal_nilai) || 1);
  },

  teksTelat(n) {
    if (n <= 0) return 'hari ini';
    if (n === 1) return 'kemarin';
    return n + ' hari lalu';
  },

  teksSisa(n) {
    if (n <= 0) return 'hari ini';
    if (n === 1) return 'besok';
    if (n < 7) return n + ' hari lagi';
    if (n < 14) return 'minggu depan';
    return n + ' hari lagi';
  },

  /* Pengingat aktif yang belum jatuh tempo, paling dekat lebih dulu. */
  berikutnya(db, kini) {
    kini = kini || new Date();
    const hariIni = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());
    const menunggu = new Set(this.perluDitanya(db, kini).map(x => x.p.id));

    return (db.pengingat || [])
      .filter(p => p.aktif && !menunggu.has(p.id))
      .map(p => {
        const jatuh = this.jatuhBerikut(p, kini);
        return { p, jatuh, sisa: Math.round((jatuh - hariIni) / 864e5) };
      })
      .sort((a, b) => a.sisa - b.sisa);
  },

  /* ── notifikasi browser ──
     Di web hanya muncul selagi aplikasi terbuka. Setelah dibungkus
     jadi APK, izin yang sama dipakai oleh notifikasi sistem sehingga
     bisa muncul walau aplikasi tertutup. */
  bisaNotifikasi() {
    return typeof Notification !== 'undefined';
  },

  izinNotifikasi() {
    return this.bisaNotifikasi() ? Notification.permission : 'unsupported';
  },

  async mintaIzinNotifikasi() {
    if (!this.bisaNotifikasi()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try { return await Notification.requestPermission(); }
    catch (e) { return 'denied'; }
  },

  tampilkanNotifikasi(daftar) {
    if (!this.bisaNotifikasi() || Notification.permission !== 'granted') return;
    if (!daftar.length) return;

    const satu = daftar[0];
    const judul = daftar.length === 1
      ? satu.p.judul
      : satu.p.judul + ' +' + (daftar.length - 1) + ' lainnya';

    try {
      new Notification('DompetQ — belum dicatat', {
        body: judul + ' · ' + this.teksTelat(satu.telat),
        icon: 'img/ikon-192.png',
        badge: 'img/ikon-192.png',
        tag: 'dompetq-pengingat'      // menimpa notifikasi lama, tidak menumpuk
      });
    } catch (e) { /* sebagian browser melarang di luar service worker */ }
  }
};
