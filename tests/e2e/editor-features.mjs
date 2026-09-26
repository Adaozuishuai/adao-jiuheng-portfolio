import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import sharp from 'sharp';

export async function testEditorFeatures({
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
}) {
  const id = await create();
  const row = async () => (await sql`SELECT * FROM posts WHERE id = ${id}`)[0];
  const saved = async () =>
    expect(page.locator('.save-state')).toContainText('已于', {
      timeout: 10000,
    });
  const editor = page.getByRole('textbox', { name: '文章正文' });
  const externalRequests = [];
  const trackExternal = (request) => {
    if (request.url().includes('external.invalid'))
      externalRequests.push(request.url());
  };
  page.on('request', trackExternal);
  const image = await sharp({
    create: { width: 200, height: 120, channels: 3, background: '#a8bca2' },
  })
    .png()
    .toBuffer();
  const clipboard = async ({ names = [], html = '', text = '' } = {}) => {
    await editor.evaluate(
      (element, { names, html, text, bytes }) => {
        const data = new DataTransfer();
        for (const name of names)
          data.items.add(
            new File([new Uint8Array(bytes)], name, { type: 'image/png' }),
          );
        if (html) data.setData('text/html', html);
        if (text) data.setData('text/plain', text);
        element.dispatchEvent(
          new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      },
      { names, html, text, bytes: [...image] },
    );
  };
  const endOfParagraph = async () => {
    await editor
      .locator('p')
      .first()
      .evaluate((element) => {
        element.parentElement.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
  };
  await page.goto(`/admin/posts/${id}`);
  await page.getByLabel('文章标题', { exact: true }).fill('编辑能力验收');
  await editor.fill('上传时仍可写作');
  await expect(editor).toHaveCSS('outline-style', 'none');
  await page.getByLabel('文章标题', { exact: true }).focus();
  await expect(page.getByLabel('文章标题', { exact: true })).toHaveCSS(
    'outline-style',
    'none',
  );
  checks.push('Editor and title have no red focus outline');

  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/admin/assets', async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  await endOfParagraph();
  await clipboard({
    names: ['first.png', 'second.png'],
    html: '<img src="https://external.invalid/example.png">',
  });
  await expect(page.locator('.image-upload-placeholder')).toHaveCount(2);
  await endOfParagraph();
  await page.keyboard.insertText('，上传期间继续输入');
  await page.locator('.publish-action').click();
  await expect(page.locator('.publish-feedback')).toContainText(
    '还有图片未上传完成',
  );
  await saved();
  const pending = await row();
  assert.match(JSON.stringify(pending.draft_content), /上传期间继续输入/);
  assert.doesNotMatch(
    JSON.stringify(pending.draft_content),
    /imageUpload|first.png|second.png/,
  );
  const revisions =
    await sql`SELECT snapshot FROM post_revisions WHERE post_id = ${id}`;
  assert.doesNotMatch(JSON.stringify(revisions), /imageUpload/);
  assert.equal(pending.status, 'draft');
  checks.push(
    'Pending images block incomplete publication while text autosaves without transient nodes',
  );
  release();
  await expect(page.locator('.editor-image')).toHaveCount(2);
  await expect(page.locator('.image-upload-placeholder')).toHaveCount(0);
  await page.unroute('**/api/admin/assets');
  const sources = await page
    .locator('.editor-image img')
    .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  const names =
    await sql`SELECT id, original_name FROM assets WHERE post_id = ${id}`;
  assert.deepEqual(
    sources.map(
      (src) => names.find((asset) => src.endsWith(asset.id)).original_name,
    ),
    ['first.png', 'second.png'],
  );
  assert.notEqual(
    await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    ),
    '图片说明',
  );
  checks.push(
    'Clipboard images preserve order, do not duplicate HTML images or steal caption focus',
  );
  await page
    .getByLabel('图片说明', { exact: true })
    .first()
    .fill('粘贴图片说明');
  await saved();
  await page.reload();
  await expect(
    page.getByLabel('图片说明', { exact: true }).first(),
  ).toHaveValue('粘贴图片说明');
  checks.push('Pasted image and inline caption survive autosave and reload');

  let releaseDeleted;
  const heldDeleted = new Promise((resolve) => {
    releaseDeleted = resolve;
  });
  await page.route('**/api/admin/assets', async (route) => {
    await heldDeleted;
    await route.continue().catch(() => {});
  });
  await endOfParagraph();
  await clipboard({ names: ['delete-before-complete.png'] });
  await page.getByLabel('移除待上传图片').click();
  releaseDeleted();
  await page.unroute('**/api/admin/assets');
  await expect(page.locator('.editor-image')).toHaveCount(2);
  checks.push('Removing an upload placeholder prevents a late image insertion');

  await page.route('**/api/admin/assets', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: '模拟上传失败' }),
    }),
  );
  await endOfParagraph();
  await clipboard({ names: ['retry.png'] });
  await expect(page.locator('.image-upload-placeholder')).toContainText(
    '模拟上传失败',
  );
  await page.unroute('**/api/admin/assets');
  await page.getByRole('button', { name: '重试上传' }).click();
  await expect(page.locator('.editor-image')).toHaveCount(3);
  checks.push('Failed uploads can be retried individually');

  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      { name: 'chosen-1.png', mimeType: 'image/png', buffer: image },
      { name: 'chosen-2.png', mimeType: 'image/png', buffer: image },
    ]);
  await expect(page.locator('.editor-image')).toHaveCount(5);
  await editor.locator('p').first().scrollIntoViewIfNeeded();
  await editor
    .locator('p')
    .first()
    .evaluate(
      (element, bytes) => {
        const data = new DataTransfer();
        data.items.add(
          new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' }),
        );
        const box = element.getBoundingClientRect();
        element.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: data,
            clientX: box.left + 8,
            clientY: box.top + 8,
          }),
        );
      },
      [...image],
    );
  await expect(page.locator('.editor-image')).toHaveCount(6);
  checks.push('Multi-file selection and drop into the editor upload images');
  await endOfParagraph();
  await clipboard({
    html: '<h1>富文本标题</h1><p style="color:red"><strong>保留粗体</strong>和文本</p><img src="https://external.invalid/no-download.png"><p>图片后的文字</p>',
  });
  await expect(editor.locator('h2')).toContainText('富文本标题');
  await expect(editor.locator('strong')).toContainText('保留粗体');
  await expect(editor).toContainText('图片后的文字');
  await expect(page.locator('.editor-image')).toHaveCount(6);
  await expect(page.locator('.editor-feedback')).toContainText(
    '外部图片未导入',
  );
  await saved();
  assert.doesNotMatch(
    JSON.stringify((await row()).draft_content),
    /external.invalid|color:red/,
  );
  assert.deepEqual(externalRequests, []);
  page.off('request', trackExternal);
  checks.push(
    'Rich text paste preserves supported content and rejects remote images without dropping text',
  );

  // Seed a representative document through the actual API, then edit it in the browser.
  const paragraph = (text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  });
  const heading = (text, level) => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  });
  const code =
    'const answer = 42;\n  console.log("<script>literal</script>", answer);';
  let current = await row();
  const snapshot = {
    title: '写作与阅读能力验收',
    slug: 'editor-feature-acceptance',
    excerpt: '',
    tags: [],
    coverAssetId: null,
    content: {
      type: 'doc',
      content: [
        heading('独立三级标题', 3),
        heading('代码与图片', 2),
        heading('粘贴与缩进', 3),
        paragraph('正文前段'),
        {
          type: 'codeBlock',
          attrs: { language: 'unknown' },
          content: [{ type: 'text', text: code }],
        },
        heading('没有子标题', 2),
        paragraph('正文末段'),
      ],
    },
  };
  assert.equal(
    (await change(id, 'save', current.version, snapshot)).status(),
    200,
  );
  await page.reload();
  await expect(page.getByLabel('代码语言')).toHaveValue('plaintext');
  await page.getByLabel('代码语言').selectOption('javascript');
  await expect(
    page.locator('.editor-code-block .hljs-keyword').first(),
  ).toHaveText('const');
  await page.locator('.editor-code-block code').evaluate((element) => {
    element.closest('.writing-editor').focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await clipboard({ text: '\n  // 粘贴缩进\n  const pasted = 1;' });
  await expect(page.locator('.editor-code-block code')).toContainText(
    '  // 粘贴缩进',
  );
  await page.keyboard.press('Tab');
  await saved();
  current = await row();
  const savedCode = current.draft_content.content.find(
    (node) => node.type === 'codeBlock',
  );
  assert.equal(savedCode.attrs.language, 'javascript');
  const codeText = savedCode.content.map((node) => node.text ?? '').join('');
  assert.match(codeText, /\n  \/\/ 粘贴缩进/);
  assert.match(codeText, /const pasted = 1; {2}/);
  await page.reload();
  await expect(page.getByLabel('代码语言')).toHaveValue('javascript');
  checks.push(
    'Code language, highlighting, literal HTML, pasted whitespace and Tab indentation persist',
  );
  await editor.locator('p').last().click();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: '行内代码', exact: true }).click();
  await page.keyboard.insertText('inline_value');
  await expect(editor.locator('p code')).toHaveText('inline_value');
  await saved();
  await page.screenshot({
    path: `${output}/editor-code-desktop.png`,
    fullPage: true,
  });
  screenshots.push('editor-code-desktop.png');
  await page
    .getByRole('button', { name: '存档版本', exact: true })
    .first()
    .click();
  await expect(page.locator('.editor-feedback')).toContainText(
    '当前内容已存档',
  );
  const [revision] =
    await sql`SELECT id, snapshot FROM post_revisions WHERE post_id = ${id} AND kind = 'manual' ORDER BY created_at DESC LIMIT 1`;
  assert.equal(
    revision.snapshot.content.content.find((node) => node.type === 'codeBlock')
      .attrs.language,
    'javascript',
  );
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await page.waitForURL('**/preview');
  await expect(page.locator('.code-language')).toHaveText('JavaScript');
  await expect(page.locator('.code-block .hljs-keyword').first()).toHaveText(
    'const',
  );
  await page.getByRole('link', { name: '继续编辑 →' }).click();
  await page.locator('.publish-action').click();
  await expect(page.locator('.publish-feedback')).toContainText('已发布');
  await page.goto('/blog/editor-feature-acceptance');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '复制代码', exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    codeText,
  );
  await expect(page.locator('.article-content p code')).toHaveText(
    'inline_value',
  );
  checks.push(
    'Inline code and syntax highlighting render in preview/publication; copy returns exact source',
  );
  await expect(page.locator('.article-author-info')).toHaveText('jiuheng');
  await expect(page.locator('.article-author-avatar')).toHaveCSS(
    'width',
    '36px',
  );
  await expect(page.getByText('记录与思考', { exact: false })).toHaveCount(0);
  const toc = page.locator('.article-toc');
  await expect(toc.locator('nav')).toHaveCount(0);
  await toc.getByRole('button', { name: '本文目录', exact: true }).click();
  await expect(
    toc.getByRole('link', { name: '独立三级标题', exact: true }),
  ).toBeVisible();
  await expect(
    toc.getByRole('link', { name: '粘贴与缩进', exact: true }),
  ).toHaveCount(0);
  await expect(
    toc.getByRole('button', { name: '没有子标题的子目录' }),
  ).toHaveCount(0);
  await toc.getByRole('button', { name: '代码与图片的子目录' }).click();
  await toc.getByRole('link', { name: '粘贴与缩进' }).click();
  await expect(page).toHaveURL(/#section-2$/);
  await page.screenshot({
    path: `${output}/article-toc-desktop.png`,
    fullPage: true,
  });
  screenshots.push('article-toc-desktop.png');
  await toc.getByRole('button', { name: '本文目录', exact: true }).click();
  await expect(toc.locator('nav')).toHaveCount(0);
  await page.reload();
  await expect(
    toc.getByRole('button', { name: '本文目录', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
  checks.push(
    'Compact author and two-level collapsed directory handle orphan and child headings and anchors',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileToc = page.locator('.mobile-toc');
  await mobileToc
    .getByRole('button', { name: '本文目录', exact: true })
    .click();
  await mobileToc.getByRole('button', { name: '代码与图片的子目录' }).click();
  await expect(
    mobileToc.getByRole('link', { name: '粘贴与缩进' }),
  ).toBeVisible();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `${output}/article-toc-mobile.png`,
    fullPage: true,
  });
  screenshots.push('article-toc-mobile.png');
  await page.goto(`/admin/posts/${id}`);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `${output}/editor-code-mobile.png`,
    fullPage: true,
  });
  screenshots.push('editor-code-mobile.png');
  checks.push('Mobile directory and code editing fit the viewport');
  await page.setViewportSize({ width: 1440, height: 1000 });
  current = await row();
  assert.equal(
    (
      await change(id, 'publish', current.version, {
        ...snapshot,
        content: {
          type: 'doc',
          content: Array.from({ length: 40 }, (_, index) =>
            heading(`章节${index + 1}：${'长目录标题'.repeat(6)}`, 2),
          ),
        },
      })
    ).status(),
    200,
  );
  await page.goto('/blog/editor-feature-acceptance');
  await toc.getByRole('button', { name: '本文目录', exact: true }).click();
  assert(
    await toc
      .locator('nav')
      .evaluate((nav) => nav.scrollHeight > nav.clientHeight),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks.push(
    'Long directory scrolls within the sidebar without horizontal overflow',
  );
  current = await row();
  assert.equal(
    (
      await change(id, 'publish', current.version, {
        ...snapshot,
        content: { type: 'doc', content: [paragraph('没有章节标题的短文章')] },
      })
    ).status(),
    200,
  );
  await page.reload();
  await expect(page.locator('.article-toc,.mobile-toc')).toHaveCount(0);
  checks.push('Articles without headings omit both directory variants');
  current = await row();
  const restore = await api.post(
    `/api/admin/posts/${id}/revisions/${revision.id}/restore`,
    { headers, data: { version: current.version } },
  );
  assert.equal(restore.status(), 200);
  const restored = await row();
  assert.equal(
    restored.published_content.content.find((node) => node.type === 'codeBlock')
      .attrs.language,
    'javascript',
  );
  checks.push(
    'Historical restore preserves code language and published content',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin/posts/${id}`);
  const deleteButton = page
    .locator('.editor-top')
    .getByRole('button', { name: '删除文章', exact: true });
  await expect(deleteButton).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await deleteButton.click();
  assert.equal((await row()).deleted_at, null);
  checks.push(
    'Visible top delete button leaves the article intact when cancelled',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(deleteButton).toBeVisible();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await deleteButton.click();
  await page.waitForURL('**/admin');
  assert((await row()).deleted_at);
  await expect(page.locator(`a[href="/admin/posts/${id}"]`)).toHaveCount(0);
  checks.push(
    'Mobile top delete button confirms deletion and returns to the article list',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
}
