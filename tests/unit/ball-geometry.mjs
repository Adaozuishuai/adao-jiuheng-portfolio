import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import {
  BALL_SEAMS,
  ballAngles,
  rotateBallPoint,
  projectedSeams,
} from '../../components/home/ball-geometry.ts';

// The SVG projection must follow precisely the same orientation as Three.js.
let comparisons = 0;
for (const rotation of [0, 0.1, 0.8, 1.7, Math.PI, 7.4, 15, 31]) {
  const orientation = new Euler(...ballAngles(rotation), 'XYZ');
  for (const seam of BALL_SEAMS) {
    assert.equal(seam.length, 161);
    assert.ok(
      new Vector3(...seam[0]).distanceTo(new Vector3(...seam.at(-1))) < 1e-12,
    );
    for (const point of seam) {
      const expected = new Vector3(...point).applyEuler(orientation);
      const actual = new Vector3(...rotateBallPoint(point, rotation));
      assert.ok(actual.distanceTo(expected) < 1e-12);
      assert.ok(Math.abs(actual.length() - 1) < 1e-12);
      comparisons++;
    }
  }
  for (const path of projectedSeams(rotation)) {
    assert.ok(!/NaN|Infinity/.test(path));
    const coordinates = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    assert.ok(coordinates.every((value) => value >= 0 && value <= 100));
  }
}
console.log(
  `Passed ${comparisons} WebGL/SVG orientation comparisons, closed seams and projection bounds.`,
);
