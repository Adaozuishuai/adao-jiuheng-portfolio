import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, isNull } from 'drizzle-orm';
import { posts } from '@/db/schema';
import { getDb } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';
import { DashboardActions } from '@/components/admin/dashboard-actions';
export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const rows = await getDb()
    .select({
      id: posts.id,
      title: posts.draftTitle,
      status: posts.status,
      updatedAt: posts.updatedAt,
      tags: posts.draftTags,
    })
    .from(posts)
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.updatedAt));
  return (
    <main className="admin-main">
      <div className="admin-heading">
        <div>
          <p className="blog-eyebrow">WORDS IN PROGRESS</p>
          <h1>我的文章</h1>
          <p>{rows.length} 篇记录 · 草稿只有你可见</p>
        </div>
        <DashboardActions />
      </div>
      <div className="admin-posts">
        {rows.length ? (
          rows.map((post) => (
            <Link
              className="admin-post-row"
              href={`/admin/posts/${post.id}`}
              key={post.id}
            >
              <div>
                <span className={`post-status ${post.status}`}>
                  {post.status === 'published' ? '已发布' : '草稿'}
                </span>
                <h2>{post.title || '未命名文章'}</h2>
                <p>{post.tags.join(' / ') || '未添加标签'}</p>
              </div>
              <div>
                <time>{post.updatedAt.toISOString().slice(0, 10)}</time>
                <span>编辑 ↗</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="blog-empty">
            <p>从第一篇记录开始。</p>
            <span>点击“新建文章”，写下此刻的想法。</span>
          </div>
        )}
      </div>
    </main>
  );
}
