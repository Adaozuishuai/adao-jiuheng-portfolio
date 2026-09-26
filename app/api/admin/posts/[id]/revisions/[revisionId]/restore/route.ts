import { requireAdmin, readJson } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { restorePostRevision } from '@/lib/server/admin-posts';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; revisionId: string }> },
) {
  try {
    await requireAdmin(request);
    const input = await readJson(request);
    if (!input || typeof input !== 'object')
      throw new Response('请求格式无效', { status: 400 });
    const { id, revisionId } = await context.params;
    const restored = await restorePostRevision(id, revisionId, input);
    return Response.json({
      version: restored.post.version,
      slug: restored.post.draftSlug,
      status: restored.post.status,
      firstPublishedAt: restored.post.firstPublishedAt,
      updatedAt: restored.post.updatedAt,
      snapshot: restored.snapshot,
    });
  } catch (error) {
    return apiError(error);
  }
}
