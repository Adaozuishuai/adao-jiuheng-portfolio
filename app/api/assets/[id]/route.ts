import { eq } from 'drizzle-orm';
import { assets, posts } from '@/db/schema';
import { getDb } from '@/lib/server/db';
import { apiError } from '@/lib/server/http';
import { readAsset } from '@/lib/server/storage';
import { isAdmin } from '@/lib/server/auth';
import { UUID } from '@/lib/blog/document';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) return new Response('Not found', { status: 404 });
    const [asset] = await getDb()
      .select({
        objectKey: assets.objectKey,
        mimeType: assets.mimeType,
        isPublic: assets.isPublic,
        postId: assets.postId,
        postStatus: posts.status,
        deletedAt: posts.deletedAt,
      })
      .from(assets)
      .leftJoin(posts, eq(assets.postId, posts.id))
      .where(eq(assets.id, id))
      .limit(1);
    if (!asset) return new Response('Not found', { status: 404 });
    const publicAsset =
      asset.isPublic && asset.postStatus === 'published' && !asset.deletedAt;
    if (!publicAsset && !(await isAdmin()))
      return new Response('Not found', { status: 404 });
    let bytes: Buffer;
    try {
      bytes = await readAsset(asset.objectKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return new Response('Not found', { status: 404 });
      throw error;
    }
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
