// Browser acceptance suite, with no production dependency or test-only component API.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base = process.env.TEST_BASE_URL || 'http://localhost:3005';
const out = new URL('../../docs/about-growth/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.env.HEADED !== '1',
});
const results = [];
const errors = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const record = (name, evidence) => {
  results.push({ name, status: 'passed', evidence });
  console.log(`PASS ${name}`);
};
const newPage = async (options = {}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
};
const frame = (p) => p.locator('.about-growth');
const snapshot = (p) =>
  frame(p).evaluate((n) => ({
    state: n.dataset.state,
    time: n.getAnimations({ subtree: true })[0]?.currentTime,
    animations: n
      .getAnimations({ subtree: true })
      .map((a) => ({ time: a.currentTime, state: a.playState })),
    original: getComputedStyle(n.querySelector('.about-growth-original'))
      .opacity,
    layersVisible: getComputedStyle(n.querySelector('.about-growth-layers'))
      .visibility,
    width: n.clientWidth,
    height: n.clientHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
    layers: [...n.querySelectorAll('[data-layer]')].map((img) => {
      const css = getComputedStyle(img);
      const matrix = new DOMMatrix(css.transform);
      const [x, y] = css.transformOrigin.split(' ').map(parseFloat);
      return {
        id: img.dataset.layer,
        opacity: +css.opacity,
        x: x + matrix.e,
        y: y + matrix.f,
      };
    }),
  }));
const waitState = async (p, state) =>
  p.waitForFunction(
    (state) => document.querySelector('.about-growth')?.dataset.state === state,
    state,
  );
const enter = async (p) => {
  await frame(p).scrollIntoViewIfNeeded();
  await waitState(p, 'playing');
};
const seek = async (p, time, play = false) =>
  frame(p).evaluate(
    (n, { time, play }) => {
      for (const a of n.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = time;
        if (play) {
          a.play();
          a.startTime = document.timeline.currentTime - time;
        }
      }
    },
    { time, play },
  );
const fallbackVisible = async (p) => {
  await frame(p).scrollIntoViewIfNeeded();
  await p.locator('.about-growth-original').evaluate((img) => img.decode());
  const s = await snapshot(p);
  assert.equal(s.original, '1');
  assert.equal(s.layersVisible, 'hidden');
  assert.equal(s.animations.length, 0);
  return s;
};

try {
  const p = await newPage();
  await p.goto(base);
  await p
    .locator('[data-growth-asset]')
    .first()
    .evaluate((img) => img.decode());
  await delay(150);
  assert.equal((await snapshot(p)).state, 'fallback');
  await frame(p).evaluate((n) =>
    window.scrollTo({
      top:
        scrollY +
        n.getBoundingClientRect().top -
        innerHeight +
        n.clientHeight * 0.29,
      behavior: 'instant',
    }),
  );
  await delay(200);
  assert.equal((await snapshot(p)).state, 'fallback');
  await enter(p);
  record(
    'only starts at 30 percent visibility after decoding',
    await snapshot(p),
  );

  for (const [name, time, visible] of [
    ['start', 600, 1],
    ['teen', 3000, 2],
    ['final', 5800, 3],
  ]) {
    await seek(p, time);
    const s = await snapshot(p);
    assert.equal(s.layers.filter((l) => l.opacity > 0.999).length, visible);
    await frame(p).screenshot({
      path: `${out}stage-${name}.png`,
      animations: 'allow',
    });
    record(`key stage ${name}`, s);
  }
  for (const [time, a, b] of [
    [1700, 'child-travel', 'teen-still'],
    [4400, 'teen-travel', 'adult-still'],
  ]) {
    await seek(p, time);
    const s = await snapshot(p);
    const from = s.layers.find((l) => l.id === a),
      to = s.layers.find((l) => l.id === b);
    assert.ok(
      Math.abs(from.x - to.x) < 0.02 && Math.abs(from.y - to.y) < 0.02,
      'crossfading ages share a planted foot',
    );
    assert.ok(s.layers.find((l) => l.id === 'child-still').opacity === 1);
    if (time > 3300)
      assert.equal(s.layers.find((l) => l.id === 'teen-still').opacity, 1);
    assert.ok(Math.abs(from.opacity + to.opacity - 1) < 0.001);
    await frame(p).screenshot({
      path: `${out}transition-${time}.png`,
      animations: 'allow',
    });
    record(`transition foot and opacity alignment at ${time}ms`, s);
  }
  await seek(p, 1000, true);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await waitState(p, 'paused');
  const paused = await snapshot(p);
  await delay(400);
  assert.equal((await snapshot(p)).time, paused.time);
  await enter(p);
  await delay(150);
  assert.ok((await snapshot(p)).time > paused.time);
  record('leave viewport pauses and reentry resumes', paused);

  await seek(p, 5900, true);
  await waitState(p, 'complete');
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await frame(p).scrollIntoViewIfNeeded();
  assert.equal((await snapshot(p)).state, 'complete');
  assert.equal((await snapshot(p)).animations.length, 0);
  record(
    'completion freezes three figures and releases animations',
    await snapshot(p),
  );
  assert.equal(
    await p.getByRole('img', { name: /留下每个阶段的自己/ }).count(),
    1,
  );
  assert.equal(await frame(p).locator('[aria-hidden="true"]').count(), 1);
  record('one accessible image description with hidden animation layers', {
    imageDescriptions: 1,
  });
  await p.locator('.editorial-project').first().click();
  await p.waitForURL(/\/work\//);
  await p.locator('.detail-back').click();
  await p.waitForURL(/\/#featured$/);
  await waitState(p, 'complete');
  record('native detail return preserves completion', await snapshot(p));
  await p.reload();
  await enter(p);
  assert.ok((await snapshot(p)).time < 2000);
  record('home reload permits a new presentation', await snapshot(p));

  await p.emulateMedia({ reducedMotion: 'reduce' });
  record(
    'runtime reduced motion immediately restores original',
    await fallbackVisible(p),
  );
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await waitState(p, 'complete');
  record(
    'disabling reduced motion after interruption does not replay',
    await snapshot(p),
  );

  for (const width of [1440, 768, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await frame(p).evaluate((n) =>
      window.scrollTo({
        top: scrollY + n.getBoundingClientRect().top - 240,
        behavior: 'instant',
      }),
    );
    const s = await snapshot(p);
    assert.ok(Math.abs(s.width / s.height - 3) < 0.025);
    assert.equal(s.overflow, false);
    const bounds = await frame(p).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 0.5);
    await p.screenshot({ path: `${out}responsive-${width}.png` });
    record(`responsive ${width}px`, s);
  }

  await p.setViewportSize({ width: 1440, height: 1000 });
  await p
    .getByRole('navigation', { name: '主要导航' })
    .getByRole('link', { name: '作品', exact: true })
    .click();
  await p.waitForURL(/#featured$/);
  assert.ok(await p.locator('#featured').isVisible());
  await p
    .getByRole('navigation', { name: '主要导航' })
    .getByRole('link', { name: '博客', exact: true })
    .click();
  await p.waitForURL(/#writing$/);
  assert.ok(await p.locator('#writing').isVisible());
  record('work and blog navigation', { url: p.url() });
  await p
    .locator('.court-ball')
    .evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
  await p.waitForFunction(() =>
    ['idle', 'rest'].includes(
      document.querySelector('.home-court')?.dataset.state,
    ),
  );
  // The idle ball intentionally floats, so Playwright's locator stability gate
  // never settles. Click the live hit-area center with a real mouse event.
  const ballBounds = await p.locator('.court-ball').boundingBox();
  assert.ok(ballBounds);
  await p.mouse.click(
    ballBounds.x + ballBounds.width / 2,
    ballBounds.y + ballBounds.height / 2,
  );
  await p.waitForFunction(
    () => document.querySelector('.home-court')?.dataset.state === 'rest',
    {},
    { timeout: 15000 },
  );
  assert.match(await p.locator('.home-court').innerText(), /投中了/);
  record('basketball click scores and returns to rest', {
    state: await p.locator('.home-court').getAttribute('data-state'),
  });
  await p.context().close();

  const reduced = await newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base);
  record('initial reduced motion', await fallbackVisible(reduced));
  await reduced.context().close();
  const nojs = await newPage({ javaScriptEnabled: false });
  await nojs.goto(base);
  record('no JavaScript', await fallbackVisible(nojs));
  await nojs.screenshot({ path: `${out}fallback-no-js.png` });
  await nojs.context().close();
  const broken = await newPage();
  await broken.route('**/journey/teen.png', (route) => route.abort());
  await broken.goto(base);
  record('missing sprite', await fallbackVisible(broken));
  await broken.screenshot({ path: `${out}fallback-missing-asset.png` });
  await broken.context().close();
  const runtimeFailure = await newPage();
  await runtimeFailure.goto(base);
  await enter(runtimeFailure);
  await runtimeFailure.locator('[data-layer="adult-still"]').evaluate((img) => {
    img.src = '/missing-journey-sprite.png';
  });
  await waitState(runtimeFailure, 'fallback');
  record(
    'runtime image failure cancels animation and restores original',
    await fallbackVisible(runtimeFailure),
  );
  await runtimeFailure.context().close();

  const slow = await newPage();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await slow.route('**/journey/adult.png', async (route) => {
    await gate;
    await route.continue();
  });
  await slow.goto(base, { waitUntil: 'domcontentloaded' });
  record(
    'original stays visible while a layer is pending',
    await fallbackVisible(slow),
  );
  const before = await frame(slow).boundingBox();
  release();
  await waitState(slow, 'playing');
  const after = await frame(slow).boundingBox();
  assert.deepEqual(after, before);
  record('late asset starts the timeline without layout shift', {
    before,
    after,
  });
  // Route interruption before finishing also consumes the one presentation.
  await slow.locator('.editorial-project').first().click();
  await slow.waitForURL(/\/work\//);
  await slow.goBack();
  await waitState(slow, 'complete');
  record(
    'history return after partial playback shows final',
    await snapshot(slow),
  );
  await slow.context().close();
  assert.deepEqual(errors, []);
  record('no uncaught browser errors', errors);
} finally {
  await writeFile(
    `${out}browser-test-results.json`,
    JSON.stringify({ base, results, errors }, null, 2) + '\n',
  );
  await browser.close();
}
