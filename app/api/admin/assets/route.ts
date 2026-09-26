import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { and, eq, isNull } from 'drizzle-orm';
import { assets, posts } from '@/db/schema';
import { UUID } from '@/lib/blog/document';
import { requireAdmin } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { getUploadDir } from '@/lib/server/runtime';
import { apiError } from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (Number(request.headers.get('content-length') || 0) > 11 * 1024 * 1024)
      throw new Response('图片不能超过 10MB', { status: 413 });
    const form = await request.formData(),
      file = form.get('file'),
      postId = form.get('postId'),
      alt = form.get('alt');
    if (
      typeof postId !== 'string' ||
      !UUID.test(postId) ||
      !(file instanceof File)
    )
      throw new Response('请选择图片和文章', { status: 400 });
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Response('图片不能超过 10MB', { status: 413 });
    const [post] = await getDb()
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
    if (!post) throw new Response('文章不存在', { status: 404 });
    const buffer = Buffer.from(await file.arrayBuffer());
    let result;
    try {
      const metadata = await sharp(buffer, {
        limitInputPixels: 40_000_000,
        animated: false,
      }).metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error('format');
      result = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new Response(
        '仅支持有效的静态 JPEG、PNG、WebP 图片，最多 4000 万像素',
        { status: 400 },
      );
    }
    const id = randomUUID(),
      objectKey = `${id}.webp`,
      root = getUploadDir();
    await mkdir(root, { recursive: true });
    const path = join(root, objectKey);
    await writeFile(path, result.data, { flag: 'wx', mode: 0o640 });
    try {
      await getDb()
        .insert(assets)
        .values({
          id,
          postId,
          objectKey,
          originalName: file.name.slice(0, 255),
          mimeType: 'image/webp',
          width: result.info.width,
          height: result.info.height,
          alt: typeof alt === 'string' ? alt.slice(0, 240) : '',
        });
    } catch (error) {
      await unlink(path);
      throw error;
    }
    return Response.json({ id, src: `/api/assets/${id}` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
