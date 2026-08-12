/* ══════════════════════════════════════════════
   seed.js — daftar bawaan (bank, e-wallet, kategori)
   Ini SARAN, bukan data. Semua yang benar-benar
   dipakai diinput sendiri oleh pengguna.
   ══════════════════════════════════════════════ */

const SEED_AKUN = [
  { kode:'tunai',     nama:'Uang Tunai',       jenis:'tunai',   ini:'Rp' },

  { kode:'bca',       nama:'BCA',              jenis:'bank',    ini:'BCA' },
  { kode:'mandiri',   nama:'Mandiri',          jenis:'bank',    ini:'MDR' },
  { kode:'bri',       nama:'BRI',              jenis:'bank',    ini:'BRI' },
  { kode:'bni',       nama:'BNI',              jenis:'bank',    ini:'BNI' },
  { kode:'bsi',       nama:'BSI',              jenis:'bank',    ini:'BSI' },
  { kode:'cimb',      nama:'CIMB Niaga',       jenis:'bank',    ini:'CMB' },
  { kode:'permata',   nama:'Permata',          jenis:'bank',    ini:'PRM' },
  { kode:'danamon',   nama:'Danamon',          jenis:'bank',    ini:'DNM' },
  { kode:'btn',       nama:'BTN',              jenis:'bank',    ini:'BTN' },
  { kode:'ocbc',      nama:'OCBC',             jenis:'bank',    ini:'OCB' },
  { kode:'panin',     nama:'Panin',            jenis:'bank',    ini:'PNN' },
  { kode:'maybank',   nama:'Maybank',          jenis:'bank',    ini:'MYB' },
  { kode:'mega',      nama:'Bank Mega',        jenis:'bank',    ini:'MGA' },
  { kode:'btpn',      nama:'BTPN / Jenius',    jenis:'bank',    ini:'BTP' },
  { kode:'jago',      nama:'Bank Jago',        jenis:'bank',    ini:'JGO' },
  { kode:'seabank',   nama:'SeaBank',          jenis:'bank',    ini:'SEA' },
  { kode:'blu',       nama:'blu by BCA',       jenis:'bank',    ini:'BLU' },
  { kode:'allo',      nama:'Allo Bank',        jenis:'bank',    ini:'ALO' },
  { kode:'neo',       nama:'Bank Neo Commerce',jenis:'bank',    ini:'NEO' },
  { kode:'muamalat',  nama:'Muamalat',         jenis:'bank',    ini:'MUA' },

  { kode:'gopay',     nama:'GoPay',            jenis:'ewallet', ini:'GO' },
  { kode:'ovo',       nama:'OVO',              jenis:'ewallet', ini:'OVO' },
  { kode:'dana',      nama:'DANA',             jenis:'ewallet', ini:'DNA' },
  { kode:'shopeepay', nama:'ShopeePay',        jenis:'ewallet', ini:'SPY' },
  { kode:'linkaja',   nama:'LinkAja',          jenis:'ewallet', ini:'LNK' },
  { kode:'flip',      nama:'Flip',             jenis:'ewallet', ini:'FLP' },
  { kode:'astrapay',  nama:'AstraPay',         jenis:'ewallet', ini:'AST' },

  { kode:'lainnya',   nama:'Lainnya — tulis sendiri', jenis:'lainnya', ini:'···' }
];

const SEED_KATEGORI_KELUAR = [
  'Makan & Minum', 'Belanja Harian', 'Transport', 'Bensin', 'Pulsa & Internet',
  'Listrik & Air', 'Sewa / Kos', 'Kesehatan', 'Pendidikan', 'Hiburan',
  'Pakaian', 'Perawatan Diri', 'Donasi & Sedekah', 'Hadiah', 'Cicilan',
  'Servis & Perbaikan', 'Pajak & Admin', 'Lain-lain'
];

const SEED_KATEGORI_MASUK = [
  'Gaji', 'Bonus', 'Usaha', 'Freelance', 'Hadiah', 'Penjualan Barang',
  'Bunga & Investasi', 'Iuran Diterima', 'Pengembalian', 'Lain-lain'
];

const WARNA_KANTONG = ['#0e9f6e','#c2760a','#2563eb','#9333ea','#db2777','#0891b2','#65a30d','#dc2626'];
