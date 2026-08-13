/* ══════════════════════════════════════════════
   bangun-apk.mjs — menjalankan Gradle dan menaruh
   hasilnya di rilis/ dengan nama yang jelas.

   Pemakaian:  node tools/bangun-apk.mjs debug
               node tools/bangun-apk.mjs release

   Gradle butuh JDK. Kalau JAVA_HOME belum diatur di
   sistem, skrip memakai JDK bawaan Android Studio —
   itu yang paling cocok versinya dengan Android
   Gradle Plugin, jadi tidak perlu pasang JDK terpisah.
   ══════════════════════════════════════════════ */

import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const akar    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androot = join(akar, 'android');

const jenis = (process.argv[2] || 'debug').toLowerCase();
if (jenis !== 'debug' && jenis !== 'release') {
  console.error('✗ jenis build harus "debug" atau "release"');
  process.exit(1);
}

/* ── JDK ───────────────────────────────────── */
const KANDIDAT_JDK = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  'C:\\Program Files\\Android\\Android Studio1\\jbr',
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr')
].filter(Boolean);

const jdk = KANDIDAT_JDK.find(p => existsSync(join(p, 'bin', 'java.exe')) || existsSync(join(p, 'bin', 'java')));
if (!jdk) {
  console.error('✗ JDK tidak ditemukan. Pasang Android Studio, atau atur JAVA_HOME.');
  process.exit(1);
}
console.log(`• JDK   : ${jdk}`);

/* ── SDK ───────────────────────────────────── */
if (!existsSync(join(androot, 'local.properties'))) {
  console.error('✗ android/local.properties belum ada — isi sdk.dir dengan lokasi Android SDK.');
  process.exit(1);
}
console.log(`• SDK   : ${(await readFile(join(androot, 'local.properties'), 'utf8')).match(/sdk\.dir=(.*)/)?.[1]?.trim()}`);

/* ── Peringatan kalau release belum bisa ditandatangani ── */
if (jenis === 'release' && !existsSync(join(androot, 'keystore.properties'))) {
  console.warn('! android/keystore.properties tidak ada — APK release akan');
  console.warn('  keluar TANPA tanda tangan dan tidak bisa dipasang di ponsel.');
}

/* ── Gradle ────────────────────────────────── */
const tugas = jenis === 'debug' ? 'assembleDebug' : 'assembleRelease';

/* Jalur ditulis lengkap dan dikutip: nama folder proyek boleh
   mengandung spasi, dan cmd.exe tidak selalu mencari gradlew.bat
   di direktori kerja. */
const gradlew = join(androot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const perintah = `"${gradlew}" ${tugas} --console=plain`;

console.log(`• Gradle: ${tugas}\n`);

const hasil = spawnSync(perintah, [], {
  cwd: androot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, JAVA_HOME: jdk }
});

if (hasil.status !== 0) {
  console.error(`\n✗ Gradle gagal (kode ${hasil.status}).`);
  process.exit(hasil.status || 1);
}

/* ── Salin hasil ───────────────────────────── */
const asal = join(androot, 'app', 'build', 'outputs', 'apk', jenis,
  jenis === 'debug' ? 'app-debug.apk' : 'app-release.apk');

if (!existsSync(asal)) {
  console.error(`\n✗ APK tidak ditemukan di ${asal}`);
  process.exit(1);
}

const versi = (await readFile(join(akar, 'js', 'config.js'), 'utf8'))
  .match(/VERSI_APP\s*=\s*'([^']+)'/)?.[1] || '0.0.0';

const rilis = join(akar, 'rilis');
await mkdir(rilis, { recursive: true });
const nama = `dompetq-${versi}-${jenis}.apk`;
await copyFile(asal, join(rilis, nama));

const { size } = await import('node:fs/promises').then(m => m.stat(join(rilis, nama)));
console.log(`\n✓ ${nama} — ${(size / 1048576).toFixed(1)} MB`);
console.log(`  rilis/${nama}`);
