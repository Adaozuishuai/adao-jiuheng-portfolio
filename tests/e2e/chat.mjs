import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import postgres from 'postgres';
assert.equal(process.env.AUTH_TEST_ISOLATED, 'true');
const sql = postgres(process.env.DATABASE_URL),
  base = process.env.SITE_URL;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1280, height: 900 },
  extraHTTPHeaders: { 'X-Real-IP': '127.0.0.9' },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const body = (question = '你好', extra = {}) => ({
  question,
  history: [],
  path: '/',
  session: randomUUID(),
  generation: randomUUID(),
  ...extra,
});
const post = (data, origin = base) =>
  context.request.post('/api/chat', {
    headers: { Origin: origin, 'X-Real-IP': '127.0.0.9' },
    data,
  });
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log('PASS', name);
}
try {
  const doc = (text) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  for (const [slug, status, deleted, publicText] of [
    ['chat-public', 'published', false, '公开星海研究解释缓存。'],
    ['chat-draft', 'draft', false, '绝密草稿标记'],
    ['chat-deleted', 'published', true, '已删除秘密标记'],
  ]) {
    await sql`INSERT INTO posts (draft_title,draft_content,published_title,published_slug,published_excerpt,published_content,status,first_published_at,last_published_at,deleted_at) VALUES ('私有标题',${sql.json(doc('私有草稿不可见'))},'星海研究',${slug},'星海摘要',${sql.json(doc(publicText))},${status},now(),now(),${deleted ? new Date() : null})`;
  }
  await check('Origin、路径、长度、历史校验', async () => {
    assert.equal((await post(body(), 'https://invalid.example')).status(), 403);
    assert.equal((await post(body('你好', { path: '/admin' }))).status(), 400);
    assert.equal((await post(body('字'.repeat(2001)))).status(), 400);
    assert.equal(
      (
        await post(
          body('你好', {
            history: Array(21).fill({ role: 'user', content: 'a' }),
          }),
        )
      ).status(),
      400,
    );
  });
  await check(
    '真实公开来源、草稿和删除隔离、跨文章历史、作品边界',
    async () => {
      const response = await post(
        body('检查上下文 星海', {
          path: '/blog/chat-public',
          history: [{ role: 'user', content: '上轮问题' }],
        }),
      );
      assert.equal(response.status(), 200);
      const events = (await response.text())
        .split('\n\n')
        .filter(Boolean)
        .map((x) => JSON.parse(x.slice(6)));
      assert(events[0].sources.some((s) => s.href === '/blog/chat-public'));
      assert(!events[0].sources.some((s) => /draft|deleted/.test(s.href)));
      const text = events
        .filter((x) => x.type === 'delta')
        .map((x) => x.text)
        .join('');
      assert(text.includes('公开星海'));
      assert(text.includes('上轮问题'));
      assert(!text.includes('私有草稿'));
      assert(!text.includes('绝密'));
      assert(!text.includes('已删除秘密'));
      const general = await post(body('你好，请用一句话介绍你能做什么。'));
      const generalEvents = (await general.text())
        .split('\n\n')
        .filter(Boolean)
        .map((x) => JSON.parse(x.slice(6)));
      assert.deepEqual(generalEvents[0].sources, []);
      const work = await post(body('检查上下文 人与智能体'));
      const workEvents = (await work.text())
        .split('\n\n')
        .filter(Boolean)
        .map((x) => JSON.parse(x.slice(6)));
      assert(
        workEvents
          .filter((x) => x.type === 'delta')
          .map((x) => x.text)
          .join('')
          .includes('项目介绍待补充'),
      );
    },
  );
  await check('姓名纠正覆盖跨流分片和旧聊天记录', async () => {
    const response = await post(body('姓名测试'));
    assert.equal(response.status(), 200);
    const answer = (await response.text())
      .split('\n\n')
      .filter(Boolean)
      .map((x) => JSON.parse(x.slice(6)))
      .filter((x) => x.type === 'delta')
      .map((x) => x.text)
      .join('');
    assert(answer.includes('九衡'));
    assert(!answer.includes('九恒'));
    const restored = await browser.newContext({ baseURL: base });
    try {
      await restored.addInitScript(() =>
        sessionStorage.setItem(
          'jiuheng-chat-v1',
          JSON.stringify({
            messages: [{ role: 'assistant', content: '我是九恒网站助手' }],
            input: '',
            session: crypto.randomUUID(),
          }),
        ),
      );
      const restoredPage = await restored.newPage();
      await restoredPage.goto('/');
      await restoredPage.getByRole('button', { name: '展开聊天' }).click();
      await expect(
        restoredPage.locator('.chat-message.assistant'),
      ).toContainText('九衡');
      await expect(
        restoredPage.locator('.chat-message.assistant'),
      ).not.toContainText('九恒');
    } finally {
      await restored.close();
    }
  });
  await check('会话并发拒绝', async () => {
    const session = randomUUID();
    const first = post(body('延迟响应', { session }));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal((await post(body('你好', { session }))).status(), 409);
    assert.equal((await first).status(), 200);
  });
  await check('访客与全站持久额度', async () => {
    await sql`UPDATE chat_limits SET count=20 WHERE key LIKE 'visitor:%'`;
    assert.equal((await post(body())).status(), 429);
    await sql`UPDATE chat_limits SET count=0 WHERE key LIKE 'visitor:%'`;
    await sql`UPDATE chat_limits SET count=20 WHERE key LIKE 'ip:%'`;
    assert.equal((await post(body())).status(), 429);
    await sql`UPDATE chat_limits SET count=0 WHERE key LIKE 'ip:%'`;
    await sql`UPDATE chat_limits SET count=200 WHERE key='global'`;
    assert.equal((await post(body())).status(), 429);
    await sql`DELETE FROM chat_limits`;
  });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: '聊天问题' });
  const launcher = page.getByRole('button', { name: '展开聊天' });
  await check('小胶囊、悬停延迟、空闲收起、焦点保护与页面不跳动', async () => {
    await expect(launcher).toBeVisible();
    const box = await launcher.boundingBox();
    assert(Math.abs(box.width - 198) < 3 && Math.abs(box.height - 42) < 2);
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.waitForTimeout(50);
    await page.mouse.move(10, 10);
    await page.waitForTimeout(200);
    await expect(input).toHaveCount(0);
    await launcher.hover();
    await expect(input).toBeVisible();
    await expect(input).not.toBeFocused();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
    await input.hover();
    await page.waitForTimeout(400);
    await expect(input).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(launcher).toBeVisible();
    await page.mouse.move(10, 10);
    await launcher.hover();
    await expect(input).toBeVisible();
    await expect(page.locator('.chat-panel')).toHaveCount(0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollHeight),
      height,
    );
    await page.mouse.move(10, 10);
    await page.waitForTimeout(700);
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(input).toBeFocused();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(700);
    await expect(input).toBeVisible();
    await input.press('Escape');
    await expect(launcher).toBeVisible();
  });
  await check('默认收起、展开、IME、Shift Enter、外部点击及 Esc', async () => {
    await expect(page.getByRole('region', { name: '聊天面板' })).toHaveCount(0);
    await launcher.click();
    await expect(input).toBeVisible();
    await input.fill('中文');
    await input.dispatchEvent('compositionstart');
    await input.press('Enter');
    await expect(page.locator('.chat-message')).toHaveCount(0);
    await input.dispatchEvent('compositionend');
    await input.press('Shift+Enter');
    assert((await input.inputValue()).includes('\n'));
    await input.press('Escape');
    await expect(page.locator('.chat-panel')).toHaveCount(0);
    await launcher.click();
    await page.mouse.click(10, 10);
    await expect(page.locator('.chat-panel')).toHaveCount(0);
  });
  await check('流式、收起继续生成、刷新和导航恢复', async () => {
    await launcher.click();
    await input.fill('延迟响应');
    await input.press('Enter');
    await page
      .getByRole('link', { name: 'Jiuheng 首页', exact: true })
      .first()
      .focus();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(700);
    await expect(input).toBeVisible();
    await expect(page.getByRole('button', { name: '停止生成' })).toBeVisible();
    await page.getByRole('button', { name: '收起聊天' }).click();
    await expect(page.getByRole('button', { name: '停止生成' })).toHaveCount(0);
    await launcher.click();
    await expect(page.locator('.chat-message.assistant')).toContainText(
      '逐步返回',
    );
    await expect(page.getByRole('button', { name: '停止生成' })).toHaveCount(0);
    await input.fill('保留的文字');
    await page.reload();
    await launcher.click();
    await expect(input).toHaveValue('保留的文字');
    await input.click();
    await expect(page.locator('.chat-message.assistant')).toContainText(
      '逐步返回',
    );
    await page.goto('/work/agents');
    await launcher.click();
    await expect(page.locator('.chat-header')).not.toContainText('当前作品');
    await expect(input).toHaveValue('保留的文字');
  });
  await check('停止、失败保留输入、重试、新建会话', async () => {
    await input.fill('延迟响应');
    await input.press('Enter');
    await page.getByRole('button', { name: '停止生成' }).click();
    await expect(page.locator('.chat-error')).toContainText('已停止');
    await input.fill('模拟失败');
    await input.press('Enter');
    await expect(page.locator('.chat-error')).toContainText('不可用');
    await expect(input).toHaveValue('模拟失败');
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.chat-error')).toContainText('不可用');
    await page.getByRole('button', { name: '新建对话' }).click();
    await expect(page.locator('.chat-message')).toHaveCount(0);
  });
  await check('模型 HTML 和脚本不执行', async () => {
    await input.fill('脚本测试');
    await input.press('Enter');
    await expect(page.locator('.chat-message.assistant')).toContainText(
      '安全文本',
    );
    assert.equal(await page.evaluate(() => window.__chatXss), undefined);
    assert.equal(await page.locator('.chat-message script').count(), 0);
    assert.equal(
      await page.locator('.chat-message a[href^="javascript:"]').count(),
      0,
    );
  });
  await mkdir('outputs/chat-qa', { recursive: true });
  await page.screenshot({ path: 'outputs/chat-qa/desktop.png' });
  await check('手机尺寸、页脚留白、聊天条不超屏、后台隐藏', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');
    await launcher.click();
    const rect = await page.locator('.site-chat').boundingBox();
    assert(
      rect.x >= 0 && rect.x + rect.width <= 390 && rect.height <= 844 * 0.7 + 1,
    );
    assert(
      await page.evaluate(
        () => parseFloat(getComputedStyle(document.body).paddingBottom) >= 104,
      ),
    );
    await page.screenshot({ path: 'outputs/chat-qa/mobile.png' });
    await page.goto('/admin/login');
    await expect(page.locator('.site-chat')).toHaveCount(0);
  });
  await check('触屏点击展开与外部点击收起', async () => {
    const touchContext = await browser.newContext({
      baseURL: base,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const touchPage = await touchContext.newPage();
      await touchPage.goto('/');
      await touchPage.getByRole('button', { name: '展开聊天' }).tap();
      await expect(
        touchPage.getByRole('textbox', { name: '聊天问题' }),
      ).toBeVisible();
      await touchPage.touchscreen.tap(10, 10);
      await expect(
        touchPage.getByRole('button', { name: '展开聊天' }),
      ).toBeVisible();
    } finally {
      await touchContext.close();
    }
  });
  assert.deepEqual(errors, []);
  console.log(`${checks.length} chat checks passed`);
} finally {
  await browser.close();
  await sql.end();
}
