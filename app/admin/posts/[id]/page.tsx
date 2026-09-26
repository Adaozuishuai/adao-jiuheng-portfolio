import { redirect, notFound } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { posts } from '@/db/schema';
import { UUID } from '@/lib/blog/document';
import { getDb } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';
import { PostEditor } from '@/components/admin/post-editor';
export default async function EditPage({
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
    <PostEditor
      initial={{
        id,
        title: post.draftTitle,
        slug: post.draftSlug,
        excerpt: post.draftExcerpt,
        tags: post.draftTags,
        content: post.draftContent,
        coverAssetId: post.draftCoverAssetId,
        version: post.version,
        status: post.status,
        lockedSlug: Boolean(post.firstPublishedAt),
      }}
    />
  );
}
