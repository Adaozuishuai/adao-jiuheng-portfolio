import sharp from 'sharp';

const source = new URL('../../public/jiuheng-hero.png', import.meta.url).pathname;
const target = new URL('../../public/jiuheng-hero-natural.png', import.meta.url).pathname;
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const size = width * height;
const distance = new Uint16Array(size);
distance.fill(60000);

for (let i = 0; i < size; i++) {
  const p = i * channels;
  const red = data[p] > 105 && data[p] - data[p + 1] > 38 && data[p] - data[p + 2] > 38 && data[p + 3] > 90;
  if (red) distance[i] = 0;
}
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = y * width + x;
  if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
  if (y) distance[i] = Math.min(distance[i], distance[i - width] + 1);
}
for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
  const i = y * width + x;
  if (x < width - 1) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
  if (y < height - 1) distance[i] = Math.min(distance[i], distance[i + width] + 1);
}

const output = Buffer.alloc(size * 4);
for (let i = 0; i < size; i++) {
  const p = i * 4;
  const color = distance[i] === 0 ? [220, 108, 101] : distance[i] <= 3 ? [247, 243, 239] : distance[i] <= 9 ? [29, 29, 29] : null;
  if (!color) continue;
  output[p] = color[0]; output[p + 1] = color[1]; output[p + 2] = color[2]; output[p + 3] = 255;
}
await sharp(output, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(target);
console.log(JSON.stringify({ width, height }));
