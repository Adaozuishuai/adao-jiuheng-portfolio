// Development-only asset baking; no canvas drawing runs on a visitor's first load.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
const dots = [];
for (let y = 0; y < 128; y++)
  for (let x = 0; x < 256; x++) {
    const fill = Math.sin(y * 127.1 + x * 311.7) > 0 ? '#c47946' : '#864020';
    dots.push(
      `<ellipse cx="${x * 4 + (y % 2) * 2}" cy="${y * 4}" rx="1.4" ry="1.3" fill="${fill}"/>`,
    );
  }
// Seams are shared geometry, never baked into the skin (avoids doubled lines).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><path fill="#a7552c" d="M0 0H1024V512H0Z"/>${dots.join('')}</svg>`;
await mkdir(new URL('../../public/images/home/', import.meta.url), {
  recursive: true,
});
console.log(
  await sharp(Buffer.from(svg))
    .resize(512, 256)
    .webp({ quality: 85 })
    .toFile(
      new URL(
        '../../public/images/home/basketball-leather-plain.webp',
        import.meta.url,
      ).pathname,
    ),
);
