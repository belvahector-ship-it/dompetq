/* ══════════════════════════════════════════════
   buat-ikon.mjs — menyiapkan berkas sumber di assets/
   untuk @capacitor/assets.

   Sumbernya img/sumber/ikon-asli.png (1254×1254, latar
   transparan). Dari satu berkas itu dirakit:

     icon.png             ikon persegi klasik
     icon-foreground.png  lapisan depan ikon adaptif
     icon-background.png  lapisan belakang ikon adaptif
     splash.png           layar pembuka

   Ikon adaptif Android memotong bagian luar canvas —
   yang dijamin terlihat hanya lingkaran di tengah
   selebar ~66%. Karena itu logo di lapisan depan
   sengaja dibuat lebih kecil daripada di ikon klasik.
   ══════════════════════════════════════════════ */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const akar   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sumber = join(akar, 'img/sumber/ikon-asli.png');
const tujuan = join(akar, 'assets');

const KRIM = { r: 0xFF, g: 0xFD, b: 0xF5, alpha: 1 };

await mkdir(tujuan, { recursive: true });

/* Logo dipangkas rapat dulu supaya padding bawaan berkas
   tidak ikut diperhitungkan saat menentukan skala. */
const logo = await sharp(sumber).trim().png().toBuffer();

const kanvas = (ukuran, latar) => sharp({
  create: { width: ukuran, height: ukuran, channels: 4, background: latar }
});

async function susun(ukuran, latar, porsi, keluar) {
  /* porsi 0 = latar polos tanpa logo (lapisan belakang adaptif) */
  if (porsi === 0) {
    await kanvas(ukuran, latar).png().toFile(join(tujuan, keluar));
    console.log(`✓ ${keluar} — ${ukuran}×${ukuran} (polos)`);
    return;
  }
  const sisi = Math.round(ukuran * porsi);
  const isi  = await sharp(logo)
    .resize(sisi, sisi, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
    .toBuffer();
  await kanvas(ukuran, latar)
    .composite([{ input: isi, gravity: 'center' }])
    .png()
    .toFile(join(tujuan, keluar));
  console.log(`✓ ${keluar} — ${ukuran}×${ukuran}`);
}

const BENING = { r: 0, g: 0, b: 0, alpha: 0 };

await susun(1024, KRIM,   0.78, 'icon.png');
await susun(1024, BENING, 0.62, 'icon-foreground.png');
await susun(1024, KRIM,   0.00, 'icon-background.png');
await susun(2732, KRIM,   0.20, 'splash.png');
await susun(2732, KRIM,   0.20, 'splash-dark.png');
