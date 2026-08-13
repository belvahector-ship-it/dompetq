/* ══════════════════════════════════════════════
   siapkan-www.mjs — merakit folder www/

   Capacitor menyalin isi webDir apa adanya ke dalam
   APK. Akar repo berisi .git, catatan konsep, dan
   perkakas build yang tidak boleh ikut terbungkus,
   jadi aset web dirakit dulu ke www/ yang bersih.
   ══════════════════════════════════════════════ */

import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const akar = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tujuan = join(akar, 'www');

/* Hanya berkas yang benar-benar dipakai halaman. */
const ISI = [
  'index.html',
  'manifest.webmanifest',
  'favicon.ico',
  'css',
  'js',
  'img'
];

await rm(tujuan, { recursive: true, force: true });
await mkdir(tujuan, { recursive: true });

for (const nama of ISI) {
  const dari = join(akar, nama);
  if (!existsSync(dari)) {
    console.error(`✗ tidak ditemukan: ${nama}`);
    process.exit(1);
  }
  await cp(dari, join(tujuan, nama), { recursive: true });
}

const daftar = await readdir(tujuan);
console.log(`✓ www/ siap — ${daftar.length} entri: ${daftar.join(', ')}`);
