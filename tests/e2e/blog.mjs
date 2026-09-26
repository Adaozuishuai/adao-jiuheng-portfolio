import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  chromium,
  expect,
  request as playwrightRequest,
} from '@playwright/test';
import nextEnv from '@next/env';
import postgres from 'postgres';
import sharp from 'sharp';
import { setAdministrator } from '../../scripts/admin/account.mjs';
import { testEditorFeatures } from './editor-features.mjs';

nextEnv.loadEnvConfig(process.cwd());
const baseURL = process.env.SITE_URL;
assert.equal(
  new URL(baseURL).hostname,
  'localhost',
  'Integration test runs only against the local preview.',
);
assert.equal(process.env.AUTH_TEST_ISOLATED, 'true');
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/jiuheng_test_[a-f0-9]+$/,
);
const sql = postgres(process.env.DATABASE_URL);
const [existing] = await sql`SELECT id FROM administrators LIMIT 1`;
assert.equal(
  existing,
  undefined,
  'Use a fresh local test database; this test never replaces your administrator.',
);
const username = `test-${randomBytes(5).toString('hex')}`,
  password = randomBytes(24).toString('hex');
const ids = [],
  screenshots = [],
  checks = [];
const output = 'outputs/blog-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1000 },
});
const api = context.request;
const anonymous = await playwrightRequest.newContext({ baseURL });
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
const headers = { Origin: baseURL };
let primary, last;
async function expectStatus(response, status, label) {
  assert.equal(response.status(), status, `${label}: ${await response.text()}`);
  checks.push(label);
}
async function create() {
  const response = await api.post('/api/admin/posts', { headers });
  assert.equal(response.status(), 201);
  const { id } = await response.json();
  ids.push(id);
  return id;
}
async function change(id, action, version, extra = {}) {
  return api.patch(`/api/admin/posts/${id}`, {
    headers,
    data: { action, version, ...extra },
  });
}
const paragraph = (text) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const heading = (text) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
try {
  await expectStatus(
    await anonymous.post('/api/admin/posts', { headers }),
    401,
    'Anonymous writes rejected',
  );
  await expectStatus(
    await api.post('/api/admin/setup', {
      headers,
      data: { username, password },
    }),
    404,
    'Web setup disabled without administrator',
  );
  await setAdministrator(sql, username, password);
  await expectStatus(
    await api.get('/admin/setup'),
    404,
    'Web setup page removed',
  );
  await expectStatus(
    await api.post('/api/admin/posts', {
      headers: { Origin: 'https://example.invalid' },
    }),
    403,
    'Cross-origin writes rejected',
  );
  await api.post('/api/admin/logout', { headers });
  await expectStatus(
    await api.post('/api/admin/login', {
      headers,
      data: { username, password: 'incorrect' },
    }),
    401,
    'Incorrect password rejected',
  );
  await page.goto('/admin/login');
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录写作台' }).click();
  await page.waitForURL('**/admin');
  checks.push('Browser login');
  const cookie = (await context.cookies()).find(
    (value) => value.name === 'jiuheng_admin',
  );
  assert(cookie?.httpOnly);
  assert.equal(cookie.sameSite, 'Lax');
  assert.equal(cookie.secure, false);
  checks.push('HTTP session cookie flags');
  await testEditorFeatures({
    page,
    context,
    sql,
    api,
    headers,
    create,
    change,
    checks,
    screenshots,
    output,
  });
  const unrestrictedId = await create();
  await page.goto(`/admin/posts/${unrestrictedId}`);
  await page.getByLabel('文章标题', { exact: true }).fill('');
  await expect(page.locator('.publish-action')).toBeEnabled();
  await page.locator('.publish-action').click();
  await expect(page.locator('.publish-feedback')).toContainText('已发布');
  const [emptyPublished] =
    await sql`SELECT version, published_title, published_slug FROM posts WHERE id = ${unrestrictedId}`;
  assert.equal(emptyPublished.published_title, '未命名文章');
  await expectStatus(
    await anonymous.get(`/blog/${emptyPublished.published_slug}`),
    200,
    'Blank article publishes with a fallback title and generated URL',
  );
  const longTitle = '长标题'.repeat(80);
  const longExcerpt = '摘要'.repeat(200);
  const manyTags = Array.from(
    { length: 12 },
    (_, i) => `标签${i}${'长'.repeat(30)}`,
  );
  await expectStatus(
    await change(unrestrictedId, 'publish', emptyPublished.version, {
      title: longTitle,
      excerpt: longExcerpt,
      tags: manyTags,
      slug: emptyPublished.published_slug,
      coverAssetId: null,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    }),
    200,
    'Long title, long excerpt and more than eight long tags publish without editorial limits',
  );
  const [unrestricted] =
    await sql`SELECT published_title, published_excerpt, published_tags FROM posts WHERE id = ${unrestrictedId}`;
  assert.equal(unrestricted.published_title, longTitle);
  assert.equal(unrestricted.published_excerpt, longExcerpt);
  assert.deepEqual(unrestricted.published_tags, manyTags);
  checks.push('Unrestricted metadata persists without truncation');
  assert.equal(
    (
      await change(unrestrictedId, 'delete', emptyPublished.version + 1)
    ).status(),
    200,
  );
  await page.goto('/admin');
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.waitForURL(/\/admin\/posts\//);
  primary = page.url().split('/').at(-1);
  ids.push(primary);
  await page
    .getByLabel('文章标题', { exact: true })
    .fill('【临时验收】技术探索中的观察与思考');
  await page
    .getByRole('textbox', { name: '文章正文' })
    .fill('这是一篇用于验证排版和发布流程的临时文章，测试结束后自动删除。');
  await page.getByLabel('标签', { exact: false }).fill('技术探索，思考随笔');
  await page
    .getByLabel('固定链接', { exact: false })
    .fill('temporary-blog-acceptance');
  await expect(page.locator('.save-state')).toContainText('已于', {
    timeout: 8_000,
  });
  checks.push(
    'Browser editor autosaves title, tags and body after 1.5 seconds',
  );
  const [saved] =
    await sql`SELECT version, draft_content FROM posts WHERE id = ${primary}`;
  assert.match(JSON.stringify(saved.draft_content), /临时文章/);
  last = saved.version;

  let imagePrompted = false;
  const rejectUnexpectedPrompt = async (dialog) => {
    imagePrompted = true;
    await dialog.dismiss();
  };
  page.on('dialog', rejectUnexpectedPrompt);
  const inlineImage = await sharp({
    create: { width: 900, height: 520, channels: 3, background: '#c8c3b8' },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'inline-caption.png',
    mimeType: 'image/png',
    buffer: inlineImage,
  });
  const caption = page.getByLabel('图片说明', { exact: true });
  await caption.waitFor();
  await expect(caption).toBeFocused();
  await caption.fill('直接写在图片下面的说明');
  await expect(page.locator('.save-state')).toContainText('已于', {
    timeout: 8_000,
  });
  page.off('dialog', rejectUnexpectedPrompt);
  assert.equal(imagePrompted, false);
  const [captioned] =
    await sql`SELECT version, draft_content FROM posts WHERE id = ${primary}`;
  assert.match(
    JSON.stringify(captioned.draft_content),
    /直接写在图片下面的说明/,
  );
  last = captioned.version;
  checks.push(
    'Inline image caption edits without a prompt and survives autosave',
  );
  await expectStatus(
    await anonymous.get('/blog/temporary-blog-acceptance'),
    404,
    'Draft article not public',
  );
  const preview = await anonymous.get(`/admin/posts/${primary}/preview`, {
    maxRedirects: 0,
  });
  assert.equal(preview.status(), 307);
  checks.push('Anonymous preview requires login');
  const image = await sharp({
    create: { width: 1200, height: 650, channels: 3, background: '#d8d6c9' },
  })
    .png()
    .toBuffer();
  const upload = await api.post('/api/admin/assets', {
    headers,
    multipart: {
      postId: primary,
      alt: '临时验收图片',
      file: { name: 'test.png', mimeType: 'image/png', buffer: image },
    },
  });
  assert.equal(upload.status(), 201);
  const asset = await upload.json();
  await expectStatus(
    await anonymous.get(asset.src),
    404,
    'Draft image not public',
  );
  await expectStatus(
    await api.get(asset.src),
    200,
    'Administrator can view draft image',
  );
  await expectStatus(
    await api.post('/api/admin/assets', {
      headers,
      multipart: {
        postId: primary,
        file: {
          name: 'fake.png',
          mimeType: 'image/png',
          buffer: Buffer.from('<script>alert(1)</script>'),
        },
      },
    }),
    400,
    'Fake image rejected',
  );
  await expectStatus(
    await api.post('/api/admin/assets', {
      headers,
      multipart: {
        postId: primary,
        file: {
          name: 'large.png',
          mimeType: 'image/png',
          buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        },
      },
    }),
    413,
    'Oversized image rejected',
  );
  const content = {
    type: 'doc',
    content: [
      paragraph(
        '这是一篇临时验收文章，用于检查中文阅读体验、目录、图片与发布流程。测试完成后自动清理。',
      ),
      heading('从一个问题开始'),
      paragraph(
        '技术探索往往始于一个具体的问题。记录观察、限制与尚未解决的疑问，比急着给出结论更有价值。',
      ),
      {
        type: 'blockquote',
        content: [paragraph('保留问题，也保留重新理解它的空间。')],
      },
      heading('把过程留下来'),
      paragraph(
        '清晰的记录让经验可以被重新审视。每一次尝试，都应当留下可以核对的依据。',
      ),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('记录观察与假设')] },
          { type: 'listItem', content: [paragraph('区分结果与解释')] },
        ],
      },
      {
        type: 'codeBlock',
        content: [
          {
            type: 'text',
            text: 'const thought = "keep exploring";\nconsole.log(thought);',
          },
        ],
      },
      { type: 'image', attrs: { src: asset.src, alt: '临时验收图片' } },
      heading('下一步，继续思考'),
      paragraph('有些想法不必立刻完整，把此刻看见的东西写下来就足够了。'),
    ],
  };
  const payload = {
    title: '【临时验收】技术探索中的观察与思考',
    slug: 'temporary-blog-acceptance',
    excerpt: '',
    tags: ['技术探索', '思考随笔'],
    coverAssetId: null,
    content,
  };
  const save = await change(primary, 'save', last, {
    ...payload,
    title: '【临时存档】早期写作版本',
    saveKind: 'manual',
  });
  assert.equal(save.status(), 200);
  last = (await save.json()).version;
  const [archiveRevision] =
    await sql`SELECT id FROM post_revisions WHERE post_id = ${primary} AND kind = 'manual' ORDER BY created_at DESC, id DESC LIMIT 1`;
  assert(archiveRevision?.id);
  const revisions = await api.get(`/api/admin/posts/${primary}/revisions`);
  assert.equal(revisions.status(), 200);
  assert((await revisions.json()).items.length >= 1);
  await expectStatus(
    await anonymous.get(`/api/admin/posts/${primary}/revisions`),
    401,
    'Anonymous revision history rejected',
  );
  await expectStatus(
    await api.post(
      `/api/admin/posts/${primary}/revisions/${archiveRevision.id}/restore`,
      {
        headers: { Origin: 'https://example.invalid' },
        data: { version: last },
      },
    ),
    403,
    'Cross-origin revision restore rejected',
  );
  checks.push('Manual archive is listed and protected');
  const currentSave = await change(primary, 'save', last, payload);
  assert.equal(currentSave.status(), 200);
  last = (await currentSave.json()).version;
  await expectStatus(
    await change(primary, 'save', last - 1, payload),
    409,
    'Stale version conflict',
  );
  await expectStatus(
    await change(primary, 'save', last, {
      ...payload,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bad link',
                marks: [
                  { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                ],
              },
            ],
          },
        ],
      },
    }),
    400,
    'Unsafe link rejected',
  );
  await page.reload();
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await page.waitForURL('**/preview');
  assert(
    await page.getByText('草稿预览 · 仅管理员可见', { exact: false }).count(),
  );
  checks.push('Browser draft preview');
  await page.getByRole('link', { name: '继续编辑 →' }).click();
  const publicationActions = [];
  const recordPublication = (request) => {
    if (
      request.method() === 'PATCH' &&
      request.url().endsWith(`/api/admin/posts/${primary}`)
    ) {
      publicationActions.push(request.postDataJSON().action);
    }
  };
  page.on('request', recordPublication);
  await page.getByRole('button', { name: '发布文章', exact: true }).click();
  await page
    .locator('.publish-feedback')
    .getByText('已发布，网站已更新', { exact: true })
    .waitFor();
  page.off('request', recordPublication);
  assert.deepEqual(publicationActions, ['publish']);
  checks.push(
    'Publishing submits one atomic request without a mandatory preliminary save',
  );
  checks.push('Browser publishing');
  [last] = await sql`SELECT version FROM posts WHERE id = ${primary}`;
  last = last.version;
  await expectStatus(
    await anonymous.get('/blog/temporary-blog-acceptance'),
    200,
    'Published detail available',
  );
  await expectStatus(
    await anonymous.get(asset.src),
    200,
    'Referenced image becomes public',
  );
  // A new image on a published article remains private until included in a published snapshot.
  const privateUpload = await api.post('/api/admin/assets', {
    headers,
    multipart: {
      postId: primary,
      file: { name: 'private.png', mimeType: 'image/png', buffer: image },
    },
  });
  const privateAsset = await privateUpload.json();
  await expectStatus(
    await anonymous.get(privateAsset.src),
    404,
    'New draft image stays private on a published post',
  );
  const edited = await change(primary, 'save', last, {
    ...payload,
    title: '【临时验收】尚未发布的新标题',
  });
  assert.equal(edited.status(), 200);
  last = (await edited.json()).version;
  const publicHtml = await (
    await anonymous.get('/blog/temporary-blog-acceptance')
  ).text();
  assert(!publicHtml.includes('尚未发布的新标题'));
  checks.push('Draft changes do not alter published snapshot');
  await expectStatus(
    await change(primary, 'save', last, { ...payload, slug: 'changed-slug' }),
    400,
    'Published slug locked',
  );
  const update = await change(primary, 'publish', last, {
    ...payload,
    title: '【临时验收】尚未发布的新标题',
  });
  assert.equal(update.status(), 200);
  last = (await update.json()).version;
  assert(
    (
      await (await anonymous.get('/blog/temporary-blog-acceptance')).text()
    ).includes('尚未发布的新标题'),
  );
  checks.push('Explicit update changes public snapshot');
  const restored = await change(primary, 'save', last, payload);
  last = (await restored.json()).version;
  const republished = await change(primary, 'publish', last, payload);
  last = (await republished.json()).version;
  const restoreArchived = await api.post(
    `/api/admin/posts/${primary}/revisions/${archiveRevision.id}/restore`,
    { headers, data: { version: last } },
  );
  assert.equal(restoreArchived.status(), 200);
  last = (await restoreArchived.json()).version;
  assert(
    (
      await (await anonymous.get('/blog/temporary-blog-acceptance')).text()
    ).includes('【临时存档】早期写作版本'),
  );
  const backups =
    await sql`SELECT id, kind FROM post_revisions WHERE post_id = ${primary} AND kind IN ('restore-draft-backup', 'restore-public-backup') ORDER BY created_at DESC, id DESC`;
  assert(backups.some((revision) => revision.kind === 'restore-draft-backup'));
  const publicBackup = backups.find(
    (revision) => revision.kind === 'restore-public-backup',
  );
  assert(publicBackup);
  const undoRestore = await api.post(
    `/api/admin/posts/${primary}/revisions/${publicBackup.id}/restore`,
    { headers, data: { version: last } },
  );
  assert.equal(undoRestore.status(), 200);
  last = (await undoRestore.json()).version;
  assert(
    (
      await (await anonymous.get('/blog/temporary-blog-acceptance')).text()
    ).includes('【临时验收】技术探索中的观察与思考'),
  );
  checks.push('Published restore is atomic and keeps draft and public backups');
  const duplicate = await create();
  const duplicateSave = await change(duplicate, 'save', 1, payload);
  assert.equal(duplicateSave.status(), 400); // Image belongs to primary.
  const duplicateClean = await change(duplicate, 'save', 1, {
    ...payload,
    content: { type: 'doc', content: [paragraph('重复链接测试')] },
  });
  assert.equal(duplicateClean.status(), 200);
  await expectStatus(
    await change(duplicate, 'publish', 2, {
      ...payload,
      content: { type: 'doc', content: [paragraph('重复链接测试')] },
    }),
    409,
    'Duplicate slug rejected',
  );
  const archivePost = await create();
  let archiveVersion = 1;
  for (let i = 0; i < 51; i++) {
    const archived = await change(archivePost, 'save', archiveVersion, {
      title: `永久存档版本 ${i + 1}`,
      slug: '',
      excerpt: '',
      tags: [],
      coverAssetId: null,
      content: { type: 'doc', content: [paragraph(`第 ${i + 1} 次记录`)] },
      saveKind: 'manual',
    });
    assert.equal(archived.status(), 200);
    archiveVersion = (await archived.json()).version;
  }
  const [archiveCount] =
    await sql`SELECT count(*)::int AS count FROM post_revisions WHERE post_id = ${archivePost}`;
  assert.equal(archiveCount.count, 51);
  const firstArchivePage = await (
    await api.get(`/api/admin/posts/${archivePost}/revisions`)
  ).json();
  assert.equal(firstArchivePage.items.length, 20);
  assert(firstArchivePage.nextCursor);
  const secondArchivePage = await (
    await api.get(
      `/api/admin/posts/${archivePost}/revisions?cursor=${encodeURIComponent(firstArchivePage.nextCursor)}`,
    )
  ).json();
  assert.equal(secondArchivePage.items.length, 20);
  assert(secondArchivePage.nextCursor);
  checks.push('All 51 manual archives are retained with cursor pagination');
  for (let i = 0; i < 10; i++) {
    const id = await create();
    const saved = await change(id, 'save', 1, {
      ...payload,
      title: `【临时验收 ${i + 1}】关于技术与记录的随笔`,
      slug: `temporary-note-${i}`,
      tags: ['临时测试'],
      content: { type: 'doc', content: [paragraph('临时分页验收记录')] },
    });
    assert.equal(saved.status(), 200);
    assert.equal(
      (
        await change(id, 'publish', 2, {
          ...payload,
          title: `【临时验收 ${i + 1}】关于技术与记录的随笔`,
          slug: `temporary-note-${i}`,
          tags: ['临时测试'],
          content: { type: 'doc', content: [paragraph('临时分页验收记录')] },
        })
      ).status(),
      200,
    );
  }
  await page.goto('/blog');
  assert.equal(await page.locator('.writing-row').count(), 10);
  await page.getByRole('link', { name: '下一页 →' }).click();
  await expect(page.locator('.writing-row')).toHaveCount(1);
  checks.push('10 articles per page');
  await page.goto('/blog?tag=思考随笔');
  assert.equal(await page.locator('.writing-row').count(), 1);
  checks.push('Tag filter');
  await page.goto('/');
  assert.equal(await page.locator('.writing-row').count(), 5);
  assert.deepEqual(
    await page
      .locator('main > section')
      .evaluateAll((items) =>
        items.map(
          (item) => item.id || item.getAttribute('class').split(' ')[0],
        ),
      ),
    ['editorial-hero', 'writing', 'home-about', 'featured'],
  );
  checks.push('Homepage order and latest five');
  await page
    .locator('#writing')
    .screenshot({ path: `${output}/home-writing-desktop.png` });
  screenshots.push('home-writing-desktop.png');
  await page.goto('/blog');
  await page.screenshot({ path: `${output}/blog-desktop.png`, fullPage: true });
  screenshots.push('blog-desktop.png');
  await page.goto('/blog/temporary-blog-acceptance');
  await page.locator('.article-toc > button').click();
  assert.equal(await page.locator('.article-toc a').count(), 3);
  await expect(page.getByText('临时验收图片', { exact: true })).toHaveCount(1);
  checks.push('Published image caption renders once below the image');
  await page.getByRole('button', { name: '复制代码' }).click();
  await page.getByText('已复制', { exact: true }).waitFor();
  checks.push('Article table of contents and copy code');
  await page.screenshot({
    path: `${output}/article-desktop.png`,
    fullPage: true,
  });
  screenshots.push('article-desktop.png');
  assert.equal(await page.locator('.basketball-world').count(), 0);
  await page.goto(`/admin/posts/${primary}`);
  await page.screenshot({
    path: `${output}/editor-desktop.png`,
    fullPage: true,
  });
  screenshots.push('editor-desktop.png');
  await page.getByRole('button', { name: '历史版本', exact: true }).click();
  await page.getByRole('dialog', { name: '历史版本' }).waitFor();
  await page.screenshot({
    path: `${output}/history-desktop.png`,
    fullPage: true,
  });
  screenshots.push('history-desktop.png');
  await page.getByRole('button', { name: '关闭历史版本', exact: true }).click();
  await page.locator('.editor-publish').scrollIntoViewIfNeeded();
  await expect(page.getByRole('dialog', { name: '发布设置' })).toHaveCount(0);
  await expect(page.locator('.editor-top .primary')).toHaveCount(0);
  assert(
    await page.locator('.editor-publish').evaluate((section) => {
      const paper = document.querySelector('.editor-paper');
      return Boolean(
        paper &&
        paper.getBoundingClientRect().bottom <=
          section.getBoundingClientRect().top,
      );
    }),
  );
  await page.screenshot({
    path: `${output}/publish-settings-desktop.png`,
    fullPage: true,
  });
  screenshots.push('publish-settings-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of [
    ['/blog', 'blog-mobile'],
    ['/blog/temporary-blog-acceptance', 'article-mobile'],
    [`/admin/posts/${primary}`, 'editor-mobile'],
  ]) {
    await page.goto(path);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    screenshots.push(`${name}.png`);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${path} overflows mobile viewport`,
    );
  }
  checks.push('Mobile list, article and editor without horizontal overflow');
  await page.goto(`/admin/posts/${primary}`);
  await page.getByLabel('更多写作操作').click();
  await page
    .locator('.mobile-editor-menu')
    .getByRole('button', { name: '历史版本', exact: true })
    .click();
  await page.getByRole('dialog', { name: '历史版本' }).waitFor();
  await page.getByRole('button', { name: '关闭历史版本', exact: true }).click();
  checks.push('Mobile overflow menu exposes archive history');
  await page.locator('.publish-action').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${output}/publish-settings-mobile.png`,
    fullPage: true,
  });
  screenshots.push('publish-settings-mobile.png');
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile publish settings overflow viewport',
  );
  checks.push(
    'Inline bottom publishing works on desktop and mobile without a drawer',
  );
  await page.goto(`/admin/posts/${primary}`);
  await page.getByLabel('文章标题', { exact: true }).fill('未保存修改');
  let warned = false;
  page.once('dialog', async (dialog) => {
    warned = true;
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: '← 我的文章' }).click();
  assert(warned);
  checks.push('Unsaved changes warning');
  await expect(page.locator('.save-state')).toContainText('已于', {
    timeout: 8_000,
  });
  [last] = await sql`SELECT version FROM posts WHERE id = ${primary}`;
  last = last.version;
  const unpublish = await change(primary, 'unpublish', last);
  assert.equal(unpublish.status(), 200);
  last = (await unpublish.json()).version;
  await expectStatus(
    await anonymous.get('/blog/temporary-blog-acceptance'),
    404,
    'Unpublished article disappears',
  );
  await expectStatus(
    await anonymous.get(asset.src),
    404,
    'Unpublished image becomes private',
  );
  await expectStatus(
    await change(primary, 'delete', last),
    200,
    'Soft deletion',
  );
  const [deleted] =
    await sql`SELECT deleted_at FROM posts WHERE id = ${primary}`;
  assert(deleted.deleted_at);
  await sql`UPDATE admin_sessions SET expires_at = now() - interval '1 second'`;
  await expectStatus(
    await api.post('/api/admin/posts', { headers }),
    401,
    'Expired session rejected',
  );
  await sql`DELETE FROM login_limits`;
  for (let i = 0; i < 5; i++)
    await api.post('/api/admin/login', {
      headers,
      data: { username, password: 'incorrect' },
    });
  await expectStatus(
    await api.post('/api/admin/login', {
      headers,
      data: { username, password: 'incorrect' },
    }),
    429,
    'Persistent login rate limit',
  );
  assert.deepEqual(browserErrors, [], 'No browser runtime errors');
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks, screenshots, browserErrors }, null, 2),
  );
  console.log(
    `PASS: ${checks.length} checks; ${screenshots.length} screenshots in ${output}`,
  );
} finally {
  await browser.close();
  await anonymous.dispose();
  if (ids.length) {
    const files =
      await sql`SELECT object_key FROM assets WHERE post_id IN ${sql(ids)}`;
    await sql`DELETE FROM assets WHERE post_id IN ${sql(ids)}`;
    await sql`DELETE FROM posts WHERE id IN ${sql(ids)}`;
    for (const file of files)
      await unlink(join(process.env.UPLOAD_DIR, file.object_key)).catch(
        () => {},
      );
  }
  await sql`DELETE FROM admin_sessions`;
  await sql`DELETE FROM administrators WHERE username = ${username}`;
  await sql`DELETE FROM login_limits`;
  await sql.end();
}
