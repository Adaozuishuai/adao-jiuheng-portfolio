import { requireAdmin, readJson } from '@/lib/server/auth';
import { changePost } from '@/lib/server/admin-posts';
import { apiError } from '@/lib/server/http';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const input = await readJson(request);
    if (!input || typeof input !== 'object')
      throw new Response('请求格式无效', { status: 400 });
    const post = await changePost((await context.params).id, input);
    return Response.json({
      version: post.version,
      slug: post.draftSlug,
      status: post.status,
      firstPublishedAt: post.firstPublishedAt,
      updatedAt: post.updatedAt,
    });
  } catch (error) {
    if (
      (error as { code?: string; cause?: { code?: string } })?.code ===
        '23505' ||
      (error as { cause?: { code?: string } })?.cause?.code === '23505'
    )
      return Response.json(
        { error: '该链接已被其他文章使用，请换一个链接' },
        { status: 409 },
      );
    return apiError(error);
  }
}
