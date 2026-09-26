import { posts } from '@/db/schema';
import { getDb } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const [post] = await getDb()
      .insert(posts)
      .values({
        draftContent: { type: 'doc', content: [{ type: 'paragraph' }] },
      })
      .returning({ id: posts.id });
    return Response.json(post, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
