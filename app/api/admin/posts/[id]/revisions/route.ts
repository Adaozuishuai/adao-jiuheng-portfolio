import { requireAdmin } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { listPostRevisions } from '@/lib/server/admin-posts';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const cursor = new URL(request.url).searchParams.get('cursor');
    return Response.json(await listPostRevisions(id, cursor));
  } catch (error) {
    return apiError(error);
  }
}
