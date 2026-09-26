// Shared seam geometry for WebGL and the SVG fallback. Both use Euler XYZ.
export type BallPoint = readonly [number, number, number];
export const BALL_RADIUS = 100 / 2.2;
const STEPS = 160;
export const BALL_SEAMS: BallPoint[][] = [0, 1, 2, 3].map((kind) =>
  Array.from({ length: STEPS + 1 }, (_, i): BallPoint => {
    const t = (i / STEPS) * Math.PI * 2;
    if (kind === 0) return [-Math.cos(t), 0, Math.sin(t)];
    if (kind === 1) return [Math.sin(t), Math.cos(t), 0];
    const theta =
      Math.PI / 2 + (kind === 2 ? 1 : -1) * Math.atan(1.65 * Math.sin(t));
    return [
      -Math.cos(t) * Math.sin(theta),
      Math.cos(theta),
      Math.sin(t) * Math.sin(theta),
    ];
  }),
);
export function ballAngles(rotation: number): BallPoint {
  return [0.3 + rotation * 0.38, -0.5 + rotation, 0.35 + rotation * 0.2];
}
export function rotateBallPoint(
  [x, y, z]: BallPoint,
  rotation: number,
): BallPoint {
  const [rx, ry, rz] = ballAngles(rotation);
  // Euler XYZ applies Z, then Y, then X to a column vector.
  const x1 = x * Math.cos(rz) - y * Math.sin(rz);
  const y1 = x * Math.sin(rz) + y * Math.cos(rz);
  const x2 = x1 * Math.cos(ry) + z * Math.sin(ry);
  const z2 = -x1 * Math.sin(ry) + z * Math.cos(ry);
  return [
    x2,
    y1 * Math.cos(rx) - z2 * Math.sin(rx),
    y1 * Math.sin(rx) + z2 * Math.cos(rx),
  ];
}
export function projectedSeams(rotation: number): string[] {
  return BALL_SEAMS.map((seam) => {
    let visible = false;
    return seam
      .map((point) => {
        const [x, y, z] = rotateBallPoint(point, rotation);
        if (z < 0) {
          visible = false;
          return '';
        }
        const command = visible ? 'L' : 'M';
        visible = true;
        return `${command}${(50 + x * BALL_RADIUS).toFixed(2)} ${(50 - y * BALL_RADIUS).toFixed(2)}`;
      })
      .join('');
  });
}
