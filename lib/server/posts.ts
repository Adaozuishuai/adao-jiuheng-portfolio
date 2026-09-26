import { and, desc, eq, isNotNull, isNull, sql, count } from 'drizzle-orm';
import { posts } from '@/db/schema';
import type { PublishedPost } from '@/lib/blog/types';
import { getDb } from './db';

export async function listPublished(limit?: number): Promise<PublishedPost[]> {
  let query = getDb()
    .select({
      id: posts.id,
      title: posts.publishedTitle,
      slug: posts.publishedSlug,
      excerpt: posts.publishedExcerpt,
      tags: posts.publishedTags,
      coverAssetId: posts.publishedCoverAssetId,
      content: posts.publishedContent,
      firstPublishedAt: posts.firstPublishedAt,
      lastPublishedAt: posts.lastPublishedAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.status, 'published'),
        isNull(posts.deletedAt),
        isNotNull(posts.publishedSlug),
      ),
    )
    .orderBy(desc(posts.firstPublishedAt))
    .$dynamic();
  if (limit) query = query.limit(limit);
  const rows = await query;
  return rows.filter(
    (row) =>
      row.title &&
      row.slug &&
      row.content &&
      row.firstPublishedAt &&
      row.lastPublishedAt,
  ) as PublishedPost[];
}

export async function getPublishedBySlug(
  slug: string,
): Promise<PublishedPost | null> {
  const [row] = await getDb()
    .select({
      id: posts.id,
      title: posts.publishedTitle,
      slug: posts.publishedSlug,
      excerpt: posts.publishedExcerpt,
      tags: posts.publishedTags,
      coverAssetId: posts.publishedCoverAssetId,
      content: posts.publishedContent,
      firstPublishedAt: posts.firstPublishedAt,
      lastPublishedAt: posts.lastPublishedAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.publishedSlug, slug),
        eq(posts.status, 'published'),
        isNull(posts.deletedAt),
      ),
    )
    .limit(1);
  return row?.title &&
    row.slug &&
    row.content &&
    row.firstPublishedAt &&
    row.lastPublishedAt
    ? (row as PublishedPost)
    : null;
}

export async function listBlogPage(page: number, tag: string) {
  const condition = and(
    eq(posts.status, 'published'),
    isNull(posts.deletedAt),
    isNotNull(posts.publishedSlug),
    tag ? sql`${tag} = ANY(${posts.publishedTags})` : undefined,
  );
  const db = getDb();
  const [total] = await db
    .select({ value: count() })
    .from(posts)
    .where(condition);
  const pages = Math.max(1, Math.ceil(total.value / 10));
  const current = Math.min(page, pages);
  const rows = await db
    .select({
      id: posts.id,
      title: posts.publishedTitle,
      slug: posts.publishedSlug,
      tags: posts.publishedTags,
      firstPublishedAt: posts.firstPublishedAt,
    })
    .from(posts)
    .where(condition)
    .orderBy(desc(posts.firstPublishedAt), desc(posts.id))
    .limit(10)
    .offset((current - 1) * 10);
  const tagRows = await db
    .select({ tags: posts.publishedTags })
    .from(posts)
    .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt)));
  return {
    posts: rows,
    total: total.value,
    page: current,
    pages,
    tags: [...new Set(tagRows.flatMap((row) => row.tags))].sort(),
  };
}
