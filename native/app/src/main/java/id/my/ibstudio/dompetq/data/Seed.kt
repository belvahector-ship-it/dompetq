package id.my.ibstudio.dompetq.data

/* ══════════════════════════════════════════════
   Daftar bawaan — SARAN, bukan data. Semua yang
   benar-benar dipakai diinput sendiri oleh pengguna.
   Disalin dari js/seed.js agar dua versi seragam.
   ══════════════════════════════════════════════ */

data class SeedAkun(val kode: String, val nama: String, val jenis: String, val ini: String)

val SEED_AKUN = listOf(
    SeedAkun("tunai", "Uang Tunai", "tunai", "Rp"),

    SeedAkun("bca", "BCA", "bank", "BCA"),
    SeedAkun("mandiri", "Mandiri", "bank", "MDR"),
    SeedAkun("bri", "BRI", "bank", "BRI"),
    SeedAkun("bni", "BNI", "bank", "BNI"),
    SeedAkun("bsi", "BSI", "bank", "BSI"),
    SeedAkun("cimb", "CIMB Niaga", "bank", "CMB"),
    SeedAkun("permata", "Permata", "bank", "PRM"),
    SeedAkun("danamon", "Danamon", "bank", "DNM"),
    SeedAkun("btn", "BTN", "bank", "BTN"),
    SeedAkun("ocbc", "OCBC", "bank", "OCB"),
    SeedAkun("panin", "Panin", "bank", "PNN"),
    SeedAkun("maybank", "Maybank", "bank", "MYB"),
    SeedAkun("mega", "Bank Mega", "bank", "MGA"),
    SeedAkun("btpn", "BTPN / Jenius", "bank", "BTP"),
    SeedAkun("jago", "Bank Jago", "bank", "JGO"),
    SeedAkun("seabank", "SeaBank", "bank", "SEA"),
    SeedAkun("blu", "blu by BCA", "bank", "BLU"),
    SeedAkun("allo", "Allo Bank", "bank", "ALO"),
    SeedAkun("neo", "Bank Neo Commerce", "bank", "NEO"),
    SeedAkun("muamalat", "Muamalat", "bank", "MUA"),

    SeedAkun("gopay", "GoPay", "ewallet", "GO"),
    SeedAkun("ovo", "OVO", "ewallet", "OVO"),
    SeedAkun("dana", "DANA", "ewallet", "DNA"),
    SeedAkun("shopeepay", "ShopeePay", "ewallet", "SPY"),
    SeedAkun("linkaja", "LinkAja", "ewallet", "LNK"),
    SeedAkun("flip", "Flip", "ewallet", "FLP"),
    SeedAkun("astrapay", "AstraPay", "ewallet", "AST")
)

val SEED_KATEGORI_KELUAR = listOf(
    "Makan & Minum", "Belanja Harian", "Transport", "Bensin", "Pulsa & Internet",
    "Listrik & Air", "Sewa / Kos", "Kesehatan", "Pendidikan", "Hiburan",
    "Pakaian", "Perawatan Diri", "Donasi & Sedekah", "Hadiah", "Cicilan",
    "Servis & Perbaikan", "Pajak & Admin", "Lain-lain"
)

val SEED_KATEGORI_MASUK = listOf(
    "Gaji", "Bonus", "Usaha", "Freelance", "Hadiah", "Penjualan Barang",
    "Bunga & Investasi", "Iuran Diterima", "Pengembalian", "Lain-lain"
)

val WARNA_KANTONG = listOf(
    "#0e9f6e", "#c2760a", "#2563eb", "#9333ea",
    "#db2777", "#0891b2", "#65a30d", "#dc2626"
)

val HARI = listOf("Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu")
