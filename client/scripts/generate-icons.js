import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const svgPath = path.resolve(publicDir, 'logo.svg');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. 512x512 Standard PWA Icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve(publicDir, 'pwa-512x512.png'));
  console.log('✅ Generated pwa-512x512.png');

  // 2. 192x192 Standard PWA Icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve(publicDir, 'pwa-192x192.png'));
  console.log('✅ Generated pwa-192x192.png');

  // 3. 180x180 Apple Touch Icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve(publicDir, 'apple-touch-icon.png'));
  console.log('✅ Generated apple-touch-icon.png');

  // 4. 512x512 Maskable Icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve(publicDir, 'maskable-icon-512x512.png'));
  console.log('✅ Generated maskable-icon-512x512.png');

  // 5. 64x64 Favicon PNG
  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.resolve(publicDir, 'favicon.png'));
  console.log('✅ Generated favicon.png');
}

generateIcons().catch(console.error);
