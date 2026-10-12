import { and, eq, isNull } from 'drizzle-orm';
import { posts } from '@/db/schema';
import { UUID } from '@/lib/blog/document';
import { documentHash, parseAiToc, readableBlocks } from '@/lib/blog/ai-toc';
import { requireAdmin, readJson } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { apiError } from '@/lib/server/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    if (!UUID.test(id)) throw new Response('文章不存在', { status: 404 });
    const input = (await readJson(request)) as { version?: unknown };
    const [post] = await getDb()
      .select({
        version: posts.version,
        content: posts.draftContent,
      })
      .from(posts)
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) throw new Response('文章不存在', { status: 404 });
    if (input?.version !== post.version)
      throw new Response('草稿已更新，请等待重新生成', { status: 409 });
    const blocks = readableBlocks(post.content);
    if (!blocks.length) throw new Response('请先写正文', { status: 400 });
    const source = JSON.stringify(blocks);
    if (source.length > 30_000)
      throw new Response('正文过长，暂时无法完整整理', { status: 413 });
    const key = process.env.ZHIPU_API_KEY;
    if (!key) throw new Response('尚未配置 GLM API Key', { status: 503 });
    const model = process.env.ZHIPU_MODEL || 'glm-5.3-flash';
    let upstream: Response;
    try {
      const endpoint =
        process.env.AUTH_TEST_ISOLATED === 'true' &&
        process.env.ZHIPU_TEST_API_URL
          ? process.env.ZHIPU_TEST_API_URL
          : 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '你是中文博客编辑。只基于提供的正文整理标题、摘要和目录，不补充正文没有的事实。返回严格 JSON 对象：{"title":"...","excerpt":"...","toc":[{"title":"...","blockIndex":0,"quote":"正文原文片段"}]}。目录按正文顺序，最多 8 项。每个 blockIndex 必须是输入给出的 index，quote 必须是该块连续的原文片段。不要输出其他内容。',
            },
            { role: 'user', content: source },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      });
    } catch {
      throw new Response('GLM 调用超时或网络不可用，请重试', { status: 502 });
    }
    if (!upstream.ok)
      throw new Response(
        upstream.status === 429
          ? 'GLM 请求过于频繁，请稍后重试'
          : 'GLM 调用失败，请检查密钥、模型和额度',
        { status: 502 },
      );
    let raw: unknown;
    try {
      const data = await upstream.json();
      raw = JSON.parse(data.choices?.[0]?.message?.content);
    } catch {
      throw new Response('GLM 返回内容无法解析，请重试', { status: 502 });
    }
    if (!raw || typeof raw !== 'object')
      throw new Response('GLM 返回内容无效', { status: 502 });
    const result = raw as { title?: unknown; excerpt?: unknown; toc?: unknown };
    const title = typeof result.title === 'string' ? result.title.trim() : '';
    const excerpt =
      typeof result.excerpt === 'string' ? result.excerpt.trim() : '';
    if (
      !title ||
      title.length > 120 ||
      !excerpt ||
      excerpt.length > 500 ||
      !Array.isArray(result.toc)
    )
      throw new Response('GLM 标题或摘要无效，请重试', { status: 502 });
    const byIndex = new Map(blocks.map((block) => [block.index, block.text]));
    const entries = result.toc as {
      title?: unknown;
      blockIndex?: unknown;
      quote?: unknown;
    }[];
    const matched = entries.filter(
      (entry) =>
        typeof entry.quote === 'string' &&
        entry.quote.trim().length >= 6 &&
        typeof entry.blockIndex === 'number' &&
        byIndex.get(entry.blockIndex)?.includes(entry.quote.trim()),
    );
    let toc;
    try {
      toc = parseAiToc(
        {
          sourceHash: documentHash(post.content),
          items: matched.map(({ title, blockIndex }) => ({
            title,
            blockIndex,
          })),
        },
        post.content,
      );
    } catch {
      throw new Response('GLM 目录无法对应正文，请重试', { status: 502 });
    }
    if (!toc)
      throw new Response('GLM 未找到可靠的目录位置，请重试', { status: 502 });
    return Response.json({ title, excerpt, toc, version: post.version });
  } catch (error) {
    return apiError(error);
  }
}
