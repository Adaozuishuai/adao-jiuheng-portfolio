// Derive animation paths from the wordmark's alpha, keeping strokes on its edges.
import sharp from 'sharp';

const { data, info } = await sharp(new URL('../../public/jiuheng-hero-natural.png', import.meta.url).pathname)
  .resize({ width: 1040 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const opaque = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * channels + 3] >= 128;
const edges = new Map();
const key = (x, y) => y * (width + 1) + x;
function edge(x, y, nx, ny) {
  const k = key(x, y);
  if (!edges.has(k)) edges.set(k, []);
  edges.get(k).push(key(nx, ny));
}
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (!opaque(x, y)) continue;
  if (!opaque(x, y - 1)) edge(x, y, x + 1, y);
  if (!opaque(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
  if (!opaque(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
  if (!opaque(x - 1, y)) edge(x, y + 1, x, y);
}
const point = k => [k % (width + 1), Math.floor(k / (width + 1))];
function simplify(points, tolerance = 0.65) {
  if (points.length < 3) return points;
  const a = points[0], b = points.at(-1), dx = b[0] - a[0], dy = b[1] - a[1];
  let farthest = tolerance * tolerance, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    const distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
    if (distance > farthest) { farthest = distance; split = i; }
  }
  return split ? [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)] : [a, b];
}
const paths = [];
while (edges.size) {
  const start = edges.keys().next().value;
  let current = start;
  const loop = [point(start)];
  do {
    const options = edges.get(current);
    if (!options?.length) break;
    const next = options.pop();
    if (!options.length) edges.delete(current);
    current = next;
    loop.push(point(current));
  } while (current !== start);
  const area = Math.abs(loop.reduce((sum, p, i) => {
    const q = loop[(i + 1) % loop.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
  if (area < 20 || loop.length < 24) continue;
  paths.push('M' + simplify(loop).map(p => p.join(',')).join('L') + 'Z');
}
console.log(JSON.stringify({ width, height, paths }));
