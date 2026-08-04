import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImg = path.join(process.cwd(), 'src/assets/images/basma_tech_app_icon_1785815839369.jpg');

async function generateIcons() {
  if (!fs.existsSync(sourceImg)) {
    console.log('Source image not found, skipping icon generation.');
    return;
  }

  const dirs = ['public', 'public/icons', 'public/static', 'static', 'dist', 'dist/icons', 'dist/static'];
  dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // Clean 192x192 RGBA PNG
  const buf192 = await sharp(sourceImg)
    .resize(192, 192, { fit: 'cover' })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();

  // Clean 512x512 RGBA PNG
  const buf512 = await sharp(sourceImg)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();

  // Maskable 192x192 RGBA PNG
  const bufMaskable192 = await sharp(sourceImg)
    .resize(154, 154, { fit: 'cover' })
    .extend({ top: 19, bottom: 19, left: 19, right: 19, background: '#020617' })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();

  // Maskable 512x512 RGBA PNG
  const bufMaskable512 = await sharp(sourceImg)
    .resize(410, 410, { fit: 'cover' })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#020617' })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();

  // Favicon PNG 64x64
  const bufFavicon = await sharp(sourceImg)
    .resize(64, 64, { fit: 'cover' })
    .png({ force: true })
    .toBuffer();

  const targets = [
    { name: 'icon-192.png', buf: buf192 },
    { name: 'icon-512.png', buf: buf512 },
    { name: 'icon-maskable-192.png', buf: bufMaskable192 },
    { name: 'icon-maskable-512.png', buf: bufMaskable512 },
    { name: 'favicon.png', buf: bufFavicon },
  ];

  for (const dir of dirs) {
    for (const t of targets) {
      fs.writeFileSync(path.join(dir, t.name), t.buf);
    }
  }

  console.log('PWA icons successfully generated and verified with Sharp!');
}

generateIcons().catch(err => {
  console.error('Failed to generate icons:', err);
});
