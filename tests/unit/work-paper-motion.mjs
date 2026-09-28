import assert from 'node:assert/strict';
import {
  dampPaper,
  createPaperWheelGate,
} from '../../components/home/work-paper-motion.ts';

const atRate = (hz) => {
  let x = 0;
  for (let i = 0; i < hz; i++) x = dampPaper(x, 1, 9, 1 / hz);
  return x;
};
assert.ok(
  Math.abs(atRate(60) - atRate(120)) < 1e-12,
  '60 / 120 Hz have equal displacement',
);
assert.ok(
  Math.abs(atRate(60) - atRate(30)) < 1e-12,
  '30 / 60 Hz have equal displacement',
);
assert.equal(dampPaper(2, 2, 9, 0.016), 2, 'resting state stays at rest');
assert.equal(dampPaper(0, 1, 9, 0), 0, 'paused time does not advance');

const gate = createPaperWheelGate(4);
assert.deepEqual(
  gate(-100, 0, 0, true),
  { prevent: false, step: 0 },
  'first boundary releases',
);
assert.deepEqual(
  gate(20, 200, 0, true),
  { prevent: true, step: 0 },
  'small deltas accumulate',
);
assert.deepEqual(
  gate(25, 220, 0, true),
  { prevent: true, step: 1 },
  'threshold switches once',
);
assert.deepEqual(
  gate(300, 250, 1, false),
  { prevent: true, step: 0 },
  'inertia cannot skip cards',
);
assert.deepEqual(
  gate(300, 500, 1, false),
  { prevent: true, step: 0 },
  'quiet alone cannot unlock animation',
);
assert.deepEqual(
  gate(100, 800, 1, true),
  { prevent: true, step: 1 },
  'quiet and settled unlock',
);
const end = createPaperWheelGate(4);
assert.deepEqual(end(100, 0, 2, true), { prevent: true, step: 1 });
assert.deepEqual(
  end(100, 40, 3, false),
  { prevent: true, step: 0 },
  'arrival at last card captures remaining inertia',
);
assert.deepEqual(
  end(100, 300, 3, true),
  { prevent: false, step: 0 },
  'next gesture releases at last card',
);
assert.deepEqual(
  end(-100, 600, 3, true),
  { prevent: true, step: -1 },
  'reversal remains available at last card',
);
const single = createPaperWheelGate(1);
assert.equal(
  single(100, 0, 0, true).prevent,
  false,
  'one-item gallery never traps scroll',
);
assert.equal(single(-100, 300, 0, true).prevent, false);
console.log(
  'PASS: 15 paper-motion assertions (refresh rate, input accumulation, gesture lock, both boundaries)',
);
