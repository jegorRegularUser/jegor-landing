/* Э5 (спека §8.1): конвертация ассетов в webp+avif. Запуск: npm run assets.
   Портрет: RGBA-вырезка как есть (resize до joinChannel не применять).
   Сертификаты: превью 600px webp q78 + avif q50; полный PNG — для лайтбокса.
   Скрины: assets-src/screens/*.png → 1200px webp q80 + avif q50. */
import { mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'src', 'assets');

async function ensure(dir) {
  await mkdir(dir, { recursive: true });
}

// --- портрет ---
await ensure(OUT);
const portraitSrc = path.join(SRC, 'portrait', 'hero-crop.png');
if (existsSync(portraitSrc)) {
  const img = sharp(portraitSrc);
  await img.clone().webp({ quality: 82, alphaQuality: 90, effort: 2 }).toFile(path.join(OUT, 'portrait.webp'));
  await img.clone().avif({ quality: 50, effort: 2 }).toFile(path.join(OUT, 'portrait.avif'));
  await copyFile(portraitSrc, path.join(OUT, 'portrait.png'));
  const meta = await sharp(path.join(OUT, 'portrait.webp')).metadata();
  console.log(`portrait: ${meta.width}x${meta.height} (webp+avif+png)`);
} else {
  console.warn('portrait source missing:', portraitSrc);
}

// --- сертификаты ---
const certSrc = path.join(SRC, 'certificates');
const certOut = path.join(OUT, 'certs');
await ensure(certOut);
if (existsSync(certSrc)) {
  for (const name of await readdir(certSrc)) {
    if (!name.endsWith('.png')) continue;
    const base = path.basename(name, '.png');
    const src = sharp(path.join(certSrc, name));
    const preview = src.clone().resize({ width: 600, withoutEnlargement: true });
    await preview.clone().webp({ quality: 78, effort: 2 }).toFile(path.join(certOut, `${base}.webp`));
    await preview.clone().avif({ quality: 50, effort: 2 }).toFile(path.join(certOut, `${base}.avif`));
    await copyFile(path.join(certSrc, name), path.join(certOut, `${base}.png`));
    console.log(`cert ${base}: preview 600px + full png`);
  }
} else {
  console.warn('certificates source missing:', certSrc);
}

// --- скрины проектов (кладутся в assets-src/screens вручную/снятием демо) ---
const screensSrc = path.join(SRC, 'screens');
const screensOut = path.join(OUT, 'screens');
await ensure(screensOut);
if (existsSync(screensSrc)) {
  for (const name of await readdir(screensSrc)) {
    if (!name.endsWith('.png')) continue;
    const base = path.basename(name, '.png');
    const src = sharp(path.join(screensSrc, name));
    const resized = src.clone().resize({ width: 1200, withoutEnlargement: true });
    await resized.clone().webp({ quality: 80, effort: 2 }).toFile(path.join(screensOut, `${base}.webp`));
    await resized.clone().avif({ quality: 50, effort: 2 }).toFile(path.join(screensOut, `${base}.avif`));
    console.log(`screen ${base}: 1200px webp+avif`);
  }
} else {
  console.warn('screens source missing (ок — Borrowed Vessels всё равно без скрина):', screensSrc);
}

console.log('DONE');
