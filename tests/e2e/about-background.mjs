// Real tab visibility check via raw CDP. Playwright forces focus emulation and
// keeps document.visibilityState visible, so it cannot prove this behavior.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile = await mkdtemp(join(tmpdir(), 'about-growth-chrome-'));
const port = 9338;
const chrome = spawn(
  process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let endpoint;
  for (let i = 0; i < 40; i++) {
    try {
      endpoint = await (
        await fetch(`http://127.0.0.1:${port}/json/version`)
      ).json();
      break;
    } catch {
      await delay(200);
    }
  }
  assert.ok(endpoint, 'test browser launched');
  ws = new WebSocket(endpoint.webSocketDebuggerUrl);
  await new Promise((resolve) =>
    ws.addEventListener('open', resolve, { once: true }),
  );
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      ws.send(
        JSON.stringify({
          id: next,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  const { targetId } = await send('Target.createTarget', {
    url: process.env.TEST_BASE_URL || 'http://localhost:3006',
  });
  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const evaluate = async (expression) => {
    const result = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Target.activateTarget', { targetId });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("!!document.querySelector('.about-growth')")) break;
    await delay(100);
  }
  await evaluate(
    "document.querySelector('.about-growth').scrollIntoView({block:'center',behavior:'instant'})",
  );
  const state =
    "(()=>{const n=document.querySelector('.about-growth');return {visibility:document.visibilityState,state:n.dataset.state,time:n.getAnimations({subtree:true})[0]?.currentTime,animations:n.getAnimations({subtree:true}).map(a=>a.playState)}})()";
  for (let i = 0; i < 100; i++) {
    if ((await evaluate(state)).state === 'playing') break;
    await delay(50);
  }
  await delay(1100);
  const initial = await evaluate(state);
  assert.equal(initial.state, 'playing');
  const other = await send('Target.createTarget', { url: 'about:blank' });
  await send('Target.activateTarget', { targetId: other.targetId });
  await delay(300);
  const hidden = await evaluate(state);
  assert.equal(hidden.visibility, 'hidden');
  assert.equal(hidden.state, 'paused');
  await delay(500);
  const stillHidden = await evaluate(state);
  assert.equal(stillHidden.time, hidden.time);
  await send('Target.activateTarget', { targetId });
  await delay(250);
  const resumed = await evaluate(state);
  assert.equal(resumed.visibility, 'visible');
  assert.equal(resumed.state, 'playing');
  assert.ok(resumed.time > hidden.time);
  const evidence = {
    status: 'passed',
    method: 'Real Chrome tab switch via raw CDP, without focus emulation',
    initial,
    hidden,
    stillHidden,
    resumed,
  };
  await writeFile(
    new URL(
      '../../docs/about-growth/background-test-results.json',
      import.meta.url,
    ),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));
  await send('Browser.close');
} finally {
  ws?.close();
  chrome.kill();
  await delay(200);
  await rm(profile, { recursive: true, force: true });
}
