import { requireAdmin } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getPostRevision } from '@/lib/server/admin-posts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; revisionId: string }> },
) {
  try {
    await requireAdmin();
    const { id, revisionId } = await context.params;
    return Response.json(await getPostRevision(id, revisionId));
  } catch (error) {
    return apiError(error);
  }
}
