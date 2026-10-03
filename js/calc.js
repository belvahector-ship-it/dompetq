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

  /* Hukum kekekalan uang: total semua rekening harus sama dengan total
     semua sumber dana. Selisih hanya mungkin kalau ada catatan yang
     merujuk rekening atau sumber dana yang sudah tidak ada. */
  rekonsiliasi(db) {
    const r = this.ringkas(db);
    const totalRekening = Object.values(r.saldoAkun).reduce((s, v) => s + v, 0);
    const totalSumber = db.kantong.reduce((s, k) => s + (r.saldoKantong[k.id] || 0), 0);
    return { totalRekening, totalSumber, selisih: totalRekening - totalSumber, yatim: r.yatim };
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
    for (const k of db.kantong) {
      const v = sk[k.id] || 0;
      fisik += v;
      if (k.jenis === 'titipan') titipan += v; else milik += v;
    }

    /* Minus dicek per sel (rekening × sumber dana), bukan per total sumber
       dana: total yang positif bisa menutupi sel yang jebol di rekening
       lain, dan itu justru yang membuat minus tak terlihat. */
    const negatifSel = [];
    const yatim = { baris: 0, nilai: 0 };
    const akunIds = new Set(db.akun.map(a => a.id));
    const kantongIds = new Set(db.kantong.map(k => k.id));
    for (const ak in m) {
      for (const kt in m[ak]) {
        const v = m[ak][kt];
        if (!akunIds.has(ak) || !kantongIds.has(kt)) {
          if (v !== 0) { yatim.baris++; yatim.nilai += v; }
          continue;
        }
        if (v < 0) negatifSel.push({
          akun: db.akun.find(a => a.id === ak),
          kantong: db.kantong.find(k => k.id === kt),
          nilai: v
        });
      }
    }

    return {
      totalFisik: fisik,
      uangSaya: milik,
      titipan: titipan,
      negatifSel,                    // sel rekening × sumber dana yang minus
      yatim,                         // saldo yang merujuk rekening/sumber dana yang sudah tidak ada
      saldoAkun: this.saldoAkun(db, m),
      saldoKantong: sk,
      matriks: m
    };
  },

  /* Cek sebelum menyimpan: apakah transaksi ini bikin
     saldo sel matriks jadi minus? (konsep.md §3.2 aturan 1)
     Pemanggil memakai ini untuk MENOLAK transaksinya —
     saldo tidak boleh minus. */
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

  /* Rekening lain yang masih punya saldo di sumber dana yang sama —
     dipakai saat pengeluaran tidak cukup di satu rekening, supaya bisa
     ditawarkan "pisah dari rekening lain" dari pada ditolak total.
     Diurutkan dari saldo terbesar supaya pembagian otomatisnya hemat
     jumlah rekening yang dipakai. */
  sumberLain(db, kantongId, kecualiAkunId) {
    const m = this.matriks(db);
    const out = [];
    for (const ak in m) {
      if (ak === kecualiAkunId) continue;
      const v = m[ak][kantongId] || 0;
      if (v > 0) {
        const akun = db.akun.find(a => a.id === ak);
        if (akun) out.push({ akun, nilai: v });
      }
    }
    return out.sort((a, b) => b.nilai - a.nilai);
  },

  /* ── piutang: uang yang dipinjam orang ──

     Tidak disimpan sebagai angka sendiri. Pinjaman = transaksi 'keluar'
     yang menunjuk satu peminjam (pihak bertipe 'peminjam'), pembayaran
     balik = transaksi 'masuk' ke peminjam yang sama. Sisa per orang
     dihitung dari keduanya, jadi tidak mungkin bertentangan dengan saldo. */
  idPihakPiutang(db) {
    return new Set((db.pihak || []).filter(p => p.tipe === 'peminjam').map(p => p.id));
  },

  piutang(db) {
    const ids = this.idPihakPiutang(db);
    const skip = this.idDikoreksi(db);
    const orang = {};
    const perKantong = {};

    const urut = db.transaksi
      .filter(t => t.pihak_id && ids.has(t.pihak_id) && !skip.has(t.id) &&
                   (t.jenis === 'keluar' || t.jenis === 'masuk'))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const t of urut) {
      const n = Number(t.nominal) || 0;
      const o = orang[t.pihak_id] || (orang[t.pihak_id] = {
        pihak: db.pihak.find(p => p.id === t.pihak_id),
        dipinjam: 0, dibayar: 0, sisa: 0,
        pinjaman: [], riwayat: [], kantong: {}, terakhir: null,
        tertua: null, akunTerakhir: ''
      });
      o.riwayat.push(t);
      o.terakhir = t.timestamp;

      if (t.jenis === 'keluar') {
        o.dipinjam += n;
        o.pinjaman.push({ ts: t.timestamp, n });
        o.akunTerakhir = t.akun_id;
      } else {
        o.dibayar += n;
      }
      const delta = t.jenis === 'keluar' ? n : -n;
      o.kantong[t.kantong_id] = (o.kantong[t.kantong_id] || 0) + delta;
      perKantong[t.kantong_id] = (perKantong[t.kantong_id] || 0) + delta;
    }

    let total = 0;
    for (const id in orang) {
      const o = orang[id];
      o.sisa = o.dipinjam - o.dibayar;
      if (o.sisa > 0) total += o.sisa;

      /* pembayaran dianggap melunasi pinjaman paling lama lebih dulu —
         yang tersisa menunjukkan sudah berapa lama uang itu di luar */
      let bayar = o.dibayar;
      for (const p of o.pinjaman) {
        if (bayar >= p.n) bayar -= p.n;
        else { o.tertua = p.ts; break; }
      }
    }

    let milikSendiri = 0, titipan = 0;
    for (const kid in perKantong) {
      const k = (db.kantong || []).find(x => x.id === kid);
      if (k && k.jenis === 'titipan') titipan += perKantong[kid];
      else milikSendiri += perKantong[kid];
    }

    return {
      orang,
      daftar: Object.values(orang).sort((a, b) => b.sisa - a.sisa),
      total, milikSendiri, titipan, perKantong
    };
  },

  /* Catatan lama yang kemungkinan besar pinjaman atau pembayaran balik
     tapi belum dikaitkan ke siapa pun. Hanya tebakan dari nama kategori
     dan kata di keterangan — pengguna yang memutuskan di layar rapikan. */
  kandidatPiutang(db) {
    const skip = this.idDikoreksi(db);
    const reKat = /hutang|utang|piutang|pinjam|nyaur|kembali/i;
    const reKet = /hutang|utang|piutang|pinjam|nyaur/i;

    return db.transaksi.filter(t => {
      if (t.jenis !== 'keluar' && t.jenis !== 'masuk') return false;
      if (t.pihak_id || t.reversal_dari || skip.has(t.id)) return false;
      const k = db.kategori.find(x => x.id === t.kategori_id);
      const nk = k ? k.nama : '';
      /* cicilan milik sendiri, bukan uang yang dipinjamkan ke orang */
      if (t.jenis === 'keluar' && /cicilan/i.test(nk)) return false;
      /* catatan buatan aplikasi saat mengikhlaskan piutang */
      if (/diikhlaskan/i.test(nk)) return false;
      return reKat.test(nk) || reKet.test(t.keterangan || '');
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
    const pp = this.idPihakPiutang(db);
    const agg = {};
    let total = 0;

    for (const t of db.transaksi) {
      if (t.jenis !== tipe) continue;
      if (skip.has(t.id)) continue;
      /* meminjamkan bukan belanja, dibayar balik bukan penghasilan */
      if (t.pihak_id && pp.has(t.pihak_id)) continue;
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

  /* ── talangan (reimburse) ──
     Uang pribadi yang dipakai dulu untuk keperluan dana titipan. Dicatat
     sebagai pindah sumber dana bertanda kategori 'talangan':
       pribadi → titipan  = menalangi
       titipan → pribadi  = talangan diganti
     Sisa per titipan = ditalangi − diganti. */
  idKategoriTalangan(db) {
    return new Set(db.kategori.filter(k => k.tipe === 'talangan').map(k => k.id));
  },

  talangan(db) {
    const kat = this.idKategoriTalangan(db);
    const skip = this.idDikoreksi(db);
    const per = {};
    const ambil = k => per[k.id] || (per[k.id] = { kantong: k, ditalangi: 0, diganti: 0, perPribadi: {}, item: [] });

    const urut = db.transaksi.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const t of urut) {
      if (t.jenis !== 'transfer_kantong' || !kat.has(t.kategori_id) || skip.has(t.id)) continue;
      const asal = db.kantong.find(k => k.id === t.kantong_id);
      const tujuan = db.kantong.find(k => k.id === t.kantong_tujuan_id);
      if (!asal || !tujuan) continue;
      const n = Number(t.nominal) || 0;
      if (tujuan.jenis === 'titipan' && asal.jenis !== 'titipan') {
        const o = ambil(tujuan);
        o.ditalangi += n;
        o.perPribadi[asal.id] = (o.perPribadi[asal.id] || 0) + n;
        o.item.push(t);
      } else if (asal.jenis === 'titipan' && tujuan.jenis !== 'titipan') {
        const o = ambil(asal);
        o.diganti += n;
        o.perPribadi[tujuan.id] = (o.perPribadi[tujuan.id] || 0) - n;
      }
    }
    return Object.values(per)
      .map(o => Object.assign(o, { sisa: o.ditalangi - o.diganti }))
      .filter(o => o.sisa > 0);
  },

  /* Pengeluaran per sumber dana dalam rentang — untuk melihat seberapa
     banyak belanja dibiayai pendapatan dan seberapa banyak dari sumber
     lain (mis. pinjaman). Koreksi dan piutang tidak dihitung. */
  pengeluaranPerSumber(db, dari, sampai) {
    const d = new Date(dari).getTime(), s = new Date(sampai).getTime();
    const skip = this.idDikoreksi(db);
    const pp = this.idPihakPiutang(db);
    const out = {};
    for (const t of db.transaksi) {
      if (t.jenis !== 'keluar' || skip.has(t.id)) continue;
      if (t.pihak_id && pp.has(t.pihak_id)) continue;
      const w = new Date(t.timestamp).getTime();
      if (w < d || w > s) continue;
      out[t.kantong_id] = (out[t.kantong_id] || 0) + (Number(t.nominal) || 0);
    }
    return out;
  },

  /* Arus kas periode — hanya dana milik sendiri kalau diminta */
  arusKas(db, dari, sampai, hanyaMilikSendiri) {
    const d = new Date(dari).getTime(), s = new Date(sampai).getTime();
    const skip = this.idDikoreksi(db);
    const pp = this.idPihakPiutang(db);
    let masuk = 0, keluar = 0;

    for (const t of db.transaksi) {
      const w = new Date(t.timestamp).getTime();
      if (w < d || w > s) continue;
      if (t.jenis !== 'masuk' && t.jenis !== 'keluar') continue;
      if (skip.has(t.id)) continue;
      if (t.pihak_id && pp.has(t.pihak_id)) continue;

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
