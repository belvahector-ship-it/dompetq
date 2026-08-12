/* ══════════════════════════════════════════════
   calc.js — semua perhitungan saldo

   Sumber kebenaran tunggal adalah MATRIKS akun × kantong.
   Saldo akun    = jumlah baris matriks
   Saldo kantong = jumlah kolom matriks
   Keduanya tidak pernah dihitung terpisah, supaya
   tidak mungkin saling bertentangan.
   ══════════════════════════════════════════════ */

const Calc = {

  /* matriks[akun_id][kantong_id] = nominal */
  matriks(db, sampai) {
    const m = {};
    const batas = sampai ? new Date(sampai).getTime() : Infinity;

    const sel = (ak, kt, delta) => {
      if (!ak || !kt) return;
      if (!m[ak]) m[ak] = {};
      m[ak][kt] = (m[ak][kt] || 0) + delta;
    };

    for (const t of db.transaksi) {
      if (new Date(t.timestamp).getTime() > batas) continue;
      const n = Number(t.nominal) || 0;

      switch (t.jenis) {
        case 'masuk':
        case 'saldo_awal':
          sel(t.akun_id, t.kantong_id, n);
          break;

        case 'keluar':
          sel(t.akun_id, t.kantong_id, -n);
          break;

        /* pindah tempat: kepemilikan tidak berubah */
        case 'transfer_akun':
          sel(t.akun_id,        t.kantong_id, -n);
          sel(t.akun_tujuan_id, t.kantong_id,  n);
          break;

        /* pindah kepemilikan: lokasi fisik tidak berubah */
        case 'transfer_kantong':
          sel(t.akun_id, t.kantong_id,         -n);
          sel(t.akun_id, t.kantong_tujuan_id,   n);
          break;
      }
    }
    return m;
  },

  saldoAkun(db, m) {
    m = m || this.matriks(db);
    const out = {};
    for (const a of db.akun) {
      out[a.id] = Object.values(m[a.id] || {}).reduce((s, v) => s + v, 0);
    }
    return out;
  },

  saldoKantong(db, m) {
    m = m || this.matriks(db);
    const out = {};
    for (const k of db.kantong) out[k.id] = 0;
    for (const ak in m) {
      for (const kt in m[ak]) {
        if (out[kt] === undefined) out[kt] = 0;
        out[kt] += m[ak][kt];
      }
    }
    return out;
  },

  /* Angka-angka utama dashboard */
  ringkas(db) {
    const m  = this.matriks(db);
    const sk = this.saldoKantong(db, m);

    let fisik = 0, milik = 0, titipan = 0;
    const negatif = [];

    for (const k of db.kantong) {
      const v = sk[k.id] || 0;
      fisik += v;
      if (k.jenis === 'titipan') titipan += v; else milik += v;
      if (v < 0) negatif.push({ kantong: k, nilai: v });
    }

    return {
      totalFisik: fisik,
      uangSaya: milik,
      titipan: titipan,
      negatif,                       // sumber dana yang jebol
      saldoAkun: this.saldoAkun(db, m),
      saldoKantong: sk,
      matriks: m
    };
  },

  /* Cek sebelum menyimpan: apakah transaksi ini bikin
     saldo sel matriks jadi minus? (konsep.md §3.2 aturan 1)
     Dikembalikan sebagai peringatan, bukan larangan —
     kenyataan kadang memang begitu, dan menolak input
     hanya membuat orang berhenti mencatat. */
  cekDampak(db, calon) {
    const m = this.matriks(db);
    const cell = (ak, kt) => (m[ak] && m[ak][kt]) || 0;
    const n = Number(calon.nominal) || 0;
    const out = [];

    const periksa = (ak, kt, delta) => {
      if (!ak || !kt) return;
      const sesudah = cell(ak, kt) + delta;
      if (sesudah < 0) {
        out.push({
          akun: db.akun.find(a => a.id === ak),
          kantong: db.kantong.find(k => k.id === kt),
          sesudah
        });
      }
    };

    if (calon.jenis === 'keluar')                periksa(calon.akun_id, calon.kantong_id, -n);
    else if (calon.jenis === 'transfer_akun')    periksa(calon.akun_id, calon.kantong_id, -n);
    else if (calon.jenis === 'transfer_kantong') periksa(calon.akun_id, calon.kantong_id, -n);

    return out;
  },

  /* ID transaksi yang harus dikecualikan dari laporan: transaksi yang
     sudah dikoreksi, beserta entri pembaliknya. Keduanya saling meniadakan.

     Untuk SALDO keduanya justru harus tetap dihitung — hasilnya nol dan
     itu benar. Tapi untuk laporan kategori & arus kas, memasukkan keduanya
     membuat pengeluaran yang sudah dibatalkan tetap muncul di grafik dan
     pembaliknya terhitung sebagai pemasukan. Dua kali salah. */
  idDikoreksi(db) {
    const skip = new Set();
    for (const t of db.transaksi) {
      if (t.reversal_dari) { skip.add(t.id); skip.add(t.reversal_dari); }
    }
    return skip;
  },

  /* Pengeluaran per kategori dalam rentang tanggal.
     transfer sengaja tidak dihitung — itu bukan pengeluaran. */
  perKategori(db, dari, sampai, tipe) {
    tipe = tipe || 'keluar';
    const d = new Date(dari).getTime(), s = new Date(sampai).getTime();
    const skip = this.idDikoreksi(db);
    const agg = {};
    let total = 0;

    for (const t of db.transaksi) {
      if (t.jenis !== tipe) continue;
      if (skip.has(t.id)) continue;
      const w = new Date(t.timestamp).getTime();
      if (w < d || w > s) continue;
      const id = t.kategori_id || '_';
      agg[id] = (agg[id] || 0) + (Number(t.nominal) || 0);
      total += Number(t.nominal) || 0;
    }

    const rows = Object.keys(agg).map(id => {
      const k = db.kategori.find(x => x.id === id);
      return { id, nama: k ? k.nama : 'Tanpa kategori', nilai: agg[id] };
    }).sort((a, b) => b.nilai - a.nilai);

    return { rows, total };
  },

  /* Arus kas periode — hanya dana milik sendiri kalau diminta */
  arusKas(db, dari, sampai, hanyaMilikSendiri) {
    const d = new Date(dari).getTime(), s = new Date(sampai).getTime();
    const skip = this.idDikoreksi(db);
    let masuk = 0, keluar = 0;

    for (const t of db.transaksi) {
      const w = new Date(t.timestamp).getTime();
      if (w < d || w > s) continue;
      if (t.jenis !== 'masuk' && t.jenis !== 'keluar') continue;
      if (skip.has(t.id)) continue;

      if (hanyaMilikSendiri) {
        const k = db.kantong.find(x => x.id === t.kantong_id);
        if (!k || k.jenis !== 'milik_sendiri') continue;
      }
      const n = Number(t.nominal) || 0;
      if (t.jenis === 'masuk') masuk += n; else keluar += n;
    }
    return { masuk, keluar, selisih: masuk - keluar };
  },

  /* Mutasi satu sumber dana — bahan laporan pertanggungjawaban.
     (konsep.md §7) */
  mutasiKantong(db, kantongId, dari, sampai) {
    const d = dari ? new Date(dari).getTime() : -Infinity;
    const s = sampai ? new Date(sampai).getTime() : Infinity;
    const rows = [];
    let saldo = 0;

    const urut = db.transaksi
      .filter(t => t.kantong_id === kantongId || t.kantong_tujuan_id === kantongId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const t of urut) {
      const n = Number(t.nominal) || 0;
      let delta = 0;

      if (t.kantong_id === kantongId) {
        if (t.jenis === 'masuk' || t.jenis === 'saldo_awal') delta = n;
        else if (t.jenis === 'keluar') delta = -n;
        else if (t.jenis === 'transfer_kantong') delta = -n;
        // transfer_akun tidak mengubah saldo kantong
      }
      if (t.kantong_tujuan_id === kantongId && t.jenis === 'transfer_kantong') delta = n;

      saldo += delta;
      const w = new Date(t.timestamp).getTime();
      if (w >= d && w <= s && delta !== 0) {
        rows.push({ tx: t, delta, saldo });
      }
    }
    return { rows, saldoAkhir: saldo };
  }
};
