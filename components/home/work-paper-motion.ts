/** Exponential damping is invariant to refresh rate for a fixed target. */
export function dampPaper(
  current: number,
  target: number,
  rate: number,
  seconds: number,
) {
  return current + (target - current) * (1 - Math.exp(-rate * seconds));
}

/** A gesture remains captured at the boundary until both quiet and settled. */
export function createPaperWheelGate(count: number) {
  let captured = false;
  let sum = 0;
  let last = -Infinity;
  return (
    delta: number,
    now: number,
    target: number,
    settled: boolean,
  ): { prevent: boolean; step: number } => {
    if (!delta) return { prevent: false, step: 0 };
    if (now - last >= 180 && settled) {
      captured = false;
      sum = 0;
    }
    last = now;
    if (captured) return { prevent: true, step: 0 };
    const direction = Math.sign(delta);
    if (
      (target <= 0 && direction < 0) ||
      (target >= count - 1 && direction > 0)
    )
      return { prevent: false, step: 0 };
    if (!settled) return { prevent: true, step: 0 };
    if (Math.sign(sum) !== direction) sum = 0;
    sum += delta;
    if (Math.abs(sum) < 40) return { prevent: true, step: 0 };
    captured = true;
    return { prevent: true, step: direction };
  };
}
