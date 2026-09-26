import 'server-only';

import { and, desc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { assets, postRevisions, posts } from '@/db/schema';
import {
  imageIds,
  nodeText,
  UUID,
  validateDocument,
} from '@/lib/blog/document';
import type { PostSnapshot, RevisionKind } from '@/lib/blog/types';
import { getDb } from './db';
import { readAsset } from './storage';

type Post = typeof posts.$inferSelect;
type Transaction = Parameters<
  Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0];

function textField(
  input: Record<string, unknown>,
  key: string,
  max = Infinity,
) {
  const value = input[key];
  if (typeof value !== 'string' || value.length > max)
    throw new Response(`${key} 格式无效或超出长度限制`, { status: 400 });
  return value.trim();
}

function draftSnapshot(post: Post): PostSnapshot {
  return {
    title: post.draftTitle,
    slug: post.draftSlug,
    excerpt: post.draftExcerpt,
    tags: post.draftTags,
    coverAssetId: post.draftCoverAssetId,
    content: post.draftContent,
  };
}

function publishedSnapshot(post: Post): PostSnapshot | null {
  if (!post.publishedTitle || !post.publishedContent) return null;
  return {
    title: post.publishedTitle,
    slug: post.publishedSlug ?? '',
    excerpt: post.publishedExcerpt ?? '',
    tags: post.publishedTags,
    coverAssetId: post.publishedCoverAssetId,
    content: post.publishedContent,
  };
}

function parseSnapshot(
  input: Record<string, unknown>,
  post: Post,
): PostSnapshot {
  const title = textField(input, 'title');
  const excerpt = textField(input, 'excerpt');
  let slug = textField(input, 'slug', 180);
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Response('链接仅支持小写英文字母、数字和连字符', {
      status: 400,
    });
  if (post.firstPublishedAt && slug !== post.publishedSlug)
    throw new Response('首次发布后不能修改链接', { status: 400 });
  if (post.firstPublishedAt) slug = post.publishedSlug!;
  if (
    !Array.isArray(input.tags) ||
    input.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    throw new Response('标签必须是非空文本', {
      status: 400,
    });
  const tags = [...new Set((input.tags as string[]).map((tag) => tag.trim()))];
  let content;
  try {
    content = validateDocument(input.content);
  } catch (error) {
    throw new Response((error as Error).message, { status: 400 });
  }
  const cover = input.coverAssetId;
  if (cover !== null && (typeof cover !== 'string' || !UUID.test(cover)))
    throw new Response('封面无效', { status: 400 });
  return {
    title,
    slug,
    excerpt,
    tags,
    coverAssetId: cover as string | null,
    content,
  };
}

function snapshotInput(snapshot: PostSnapshot): Record<string, unknown> {
  return {
    title: snapshot.title,
    slug: snapshot.slug,
    excerpt: snapshot.excerpt,
    tags: snapshot.tags,
    coverAssetId: snapshot.coverAssetId,
    content: snapshot.content,
  };
}

function sameSnapshot(left: PostSnapshot, right: PostSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function assertAssets(
  tx: Transaction,
  postId: string,
  snapshot: PostSnapshot,
  requireFiles = false,
) {
  const referenced = [
    ...new Set([
      ...imageIds(snapshot.content),
      ...(snapshot.coverAssetId ? [snapshot.coverAssetId] : []),
    ]),
  ];
  if (!referenced.length) return referenced;
  const owned = await tx
    .select({ id: assets.id, objectKey: assets.objectKey })
    .from(assets)
    .where(and(eq(assets.postId, postId), inArray(assets.id, referenced)));
  if (owned.length !== referenced.length)
    throw new Response('正文包含不属于本文的图片，请重新上传', {
      status: 400,
    });
  if (requireFiles) {
    try {
      await Promise.all(owned.map((asset) => readAsset(asset.objectKey)));
    } catch {
      throw new Response('历史版本引用的图片文件已不存在，未修改当前文章', {
        status: 409,
      });
    }
  }
  return referenced;
}

async function insertRevision(
  tx: Transaction,
  postId: string,
  postVersion: number,
  kind: RevisionKind,
  snapshot: PostSnapshot,
  deduplicate = false,
) {
  if (deduplicate) {
    const [latest] = await tx
      .select({ snapshot: postRevisions.snapshot })
      .from(postRevisions)
      .where(eq(postRevisions.postId, postId))
      .orderBy(desc(postRevisions.createdAt), desc(postRevisions.id))
      .limit(1);
    if (latest && sameSnapshot(latest.snapshot, snapshot)) return false;
  }
  await tx.insert(postRevisions).values({
    postId,
    postVersion,
    kind,
    title: snapshot.title || '未命名文章',
    characterCount: nodeText(snapshot.content).length,
    snapshot,
  });
  return true;
}

async function setPublicAssets(
  tx: Transaction,
  postId: string,
  referenced: string[],
) {
  await tx
    .update(assets)
    .set({ isPublic: false })
    .where(eq(assets.postId, postId));
  if (referenced.length)
    await tx
      .update(assets)
      .set({ isPublic: true })
      .where(and(eq(assets.postId, postId), inArray(assets.id, referenced)));
}

function ensureVersion(post: Post, input: Record<string, unknown>) {
  if (input.version !== post.version)
    throw new Response(
      '文章已在其他页面修改，请重新打开后编辑；当前内容尚未覆盖',
      { status: 409 },
    );
}

export async function changePost(id: string, input: Record<string, unknown>) {
  if (!UUID.test(id)) throw new Response('文章不存在', { status: 404 });
  return getDb().transaction(async (tx) => {
    const [post] = await tx
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .for('update');
    if (!post) throw new Response('文章不存在', { status: 404 });
    ensureVersion(post, input);
    const action = input.action;
    const now = new Date();

    if (action === 'save') {
      const snapshot = parseSnapshot(input, post);
      await assertAssets(tx, id, snapshot);
      if (sameSnapshot(snapshot, draftSnapshot(post))) {
        if (input.saveKind === 'manual')
          await insertRevision(tx, id, post.version, 'manual', snapshot, true);
        return post;
      }
      const version = post.version + 1;
      const [saved] = await tx
        .update(posts)
        .set({
          version,
          updatedAt: now,
          draftTitle: snapshot.title,
          draftSlug: snapshot.slug,
          draftExcerpt: snapshot.excerpt,
          draftTags: snapshot.tags,
          draftContent: snapshot.content,
          draftCoverAssetId: snapshot.coverAssetId,
        })
        .where(eq(posts.id, id))
        .returning();
      const saveKind = input.saveKind === 'manual' ? 'manual' : 'auto';
      if (saveKind === 'manual') {
        await insertRevision(tx, id, version, 'manual', snapshot, true);
      } else {
        const [recentAuto] = await tx
          .select({ id: postRevisions.id })
          .from(postRevisions)
          .where(
            and(
              eq(postRevisions.postId, id),
              eq(postRevisions.kind, 'auto'),
              gte(postRevisions.createdAt, new Date(now.getTime() - 300_000)),
            ),
          )
          .limit(1);
        if (!recentAuto)
          await insertRevision(tx, id, version, 'auto', snapshot, true);
      }
      return saved;
    }

    if (action === 'publish') {
      const snapshot = parseSnapshot(input, post);
      const slug =
        post.publishedSlug || snapshot.slug || `post-${randomUUID()}`;
      const normalized = {
        ...snapshot,
        title: snapshot.title || '未命名文章',
        slug,
      };
      const referenced = await assertAssets(tx, id, normalized, true);
      const version = post.version + 1;
      const [published] = await tx
        .update(posts)
        .set({
          version,
          updatedAt: now,
          status: 'published',
          draftTitle: normalized.title,
          draftSlug: slug,
          draftExcerpt: normalized.excerpt,
          draftTags: normalized.tags,
          draftContent: normalized.content,
          draftCoverAssetId: normalized.coverAssetId,
          publishedSlug: slug,
          publishedTitle: normalized.title,
          publishedExcerpt: normalized.excerpt,
          publishedTags: normalized.tags,
          publishedContent: normalized.content,
          publishedCoverAssetId: normalized.coverAssetId,
          firstPublishedAt: post.firstPublishedAt ?? now,
          lastPublishedAt: now,
        })
        .where(eq(posts.id, id))
        .returning();
      await setPublicAssets(tx, id, referenced);
      await insertRevision(tx, id, version, 'publish', normalized);
      return published;
    }

    if (action === 'unpublish' || action === 'delete') {
      const [saved] = await tx
        .update(posts)
        .set({
          version: post.version + 1,
          updatedAt: now,
          status: 'draft',
          ...(action === 'delete' ? { deletedAt: now } : {}),
        })
        .where(eq(posts.id, id))
        .returning();
      await setPublicAssets(tx, id, []);
      return saved;
    }
    throw new Response('未知操作', { status: 400 });
  });
}

function parseCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      createdAt?: string;
      id?: string;
    };
    const createdAt = new Date(parsed.createdAt ?? '');
    if (!UUID.test(parsed.id ?? '') || Number.isNaN(createdAt.getTime()))
      throw new Error('invalid');
    return { createdAt, id: parsed.id! };
  } catch {
    throw new Response('分页参数无效', { status: 400 });
  }
}

export async function listPostRevisions(id: string, cursor: string | null) {
  if (!UUID.test(id)) throw new Response('文章不存在', { status: 404 });
  const db = getDb();
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);
  if (!post) throw new Response('文章不存在', { status: 404 });
  const before = parseCursor(cursor);
  const rows = await db
    .select({
      id: postRevisions.id,
      postVersion: postRevisions.postVersion,
      kind: postRevisions.kind,
      title: postRevisions.title,
      characterCount: postRevisions.characterCount,
      createdAt: postRevisions.createdAt,
    })
    .from(postRevisions)
    .where(
      and(
        eq(postRevisions.postId, id),
        before
          ? or(
              lt(postRevisions.createdAt, before.createdAt),
              and(
                eq(postRevisions.createdAt, before.createdAt),
                lt(postRevisions.id, before.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(postRevisions.createdAt), desc(postRevisions.id))
    .limit(21);
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString('base64url')
        : null,
  };
}

export async function getPostRevision(postId: string, revisionId: string) {
  if (!UUID.test(postId) || !UUID.test(revisionId))
    throw new Response('存档版本不存在', { status: 404 });
  const [revision] = await getDb()
    .select({
      id: postRevisions.id,
      kind: postRevisions.kind,
      createdAt: postRevisions.createdAt,
      snapshot: postRevisions.snapshot,
    })
    .from(postRevisions)
    .innerJoin(posts, eq(posts.id, postRevisions.postId))
    .where(
      and(
        eq(postRevisions.id, revisionId),
        eq(postRevisions.postId, postId),
        isNull(posts.deletedAt),
      ),
    )
    .limit(1);
  if (!revision) throw new Response('存档版本不存在', { status: 404 });
  return revision;
}

export async function restorePostRevision(
  postId: string,
  revisionId: string,
  input: Record<string, unknown>,
) {
  if (!UUID.test(postId) || !UUID.test(revisionId))
    throw new Response('存档版本不存在', { status: 404 });
  return getDb().transaction(async (tx) => {
    const [post] = await tx
      .select()
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .for('update');
    if (!post) throw new Response('文章不存在', { status: 404 });
    ensureVersion(post, input);
    const [revision] = await tx
      .select({ snapshot: postRevisions.snapshot })
      .from(postRevisions)
      .where(
        and(eq(postRevisions.id, revisionId), eq(postRevisions.postId, postId)),
      )
      .limit(1);
    if (!revision) throw new Response('存档版本不存在', { status: 404 });
    const raw = {
      ...revision.snapshot,
      slug:
        post.status === 'published'
          ? (post.publishedSlug ?? '')
          : revision.snapshot.slug,
    };
    const snapshot = parseSnapshot(snapshotInput(raw), post);
    const publishing = post.status === 'published';
    if (publishing && !snapshot.title) snapshot.title = '未命名文章';
    const referenced = await assertAssets(tx, postId, snapshot, publishing);
    await insertRevision(
      tx,
      postId,
      post.version,
      'restore-draft-backup',
      draftSnapshot(post),
    );
    const publicBefore = publishedSnapshot(post);
    if (publishing && publicBefore)
      await insertRevision(
        tx,
        postId,
        post.version,
        'restore-public-backup',
        publicBefore,
      );
    const version = post.version + 1;
    const now = new Date();
    const [restored] = await tx
      .update(posts)
      .set({
        version,
        updatedAt: now,
        draftTitle: snapshot.title,
        draftSlug: snapshot.slug,
        draftExcerpt: snapshot.excerpt,
        draftTags: snapshot.tags,
        draftContent: snapshot.content,
        draftCoverAssetId: snapshot.coverAssetId,
        ...(publishing
          ? {
              publishedTitle: snapshot.title,
              publishedExcerpt: snapshot.excerpt,
              publishedTags: snapshot.tags,
              publishedContent: snapshot.content,
              publishedCoverAssetId: snapshot.coverAssetId,
              lastPublishedAt: now,
            }
          : {}),
      })
      .where(eq(posts.id, postId))
      .returning();
    if (publishing) await setPublicAssets(tx, postId, referenced);
    await insertRevision(tx, postId, version, 'restore', snapshot);
    return { post: restored, snapshot };
  });
}
