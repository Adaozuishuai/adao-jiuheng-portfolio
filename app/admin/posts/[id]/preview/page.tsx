import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { posts } from '@/db/schema';
import { UUID } from '@/lib/blog/document';
import { getDb } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';
import { ArticleView } from '@/components/article-view';
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [post] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)));
  if (!post) notFound();
  return (
    <>
      <div className="preview-banner">
        草稿预览 · 仅管理员可见{' '}
        <Link href={`/admin/posts/${id}`}>继续编辑 →</Link>
      </div>
      <ArticleView
        title={post.draftTitle || '未命名文章'}
        excerpt={post.draftExcerpt}
        tags={post.draftTags}
        content={post.draftContent}
        coverAssetId={post.draftCoverAssetId}
        backHref={`/admin/posts/${id}`}
        backLabel="继续编辑"
      />
    </>
  );
}
