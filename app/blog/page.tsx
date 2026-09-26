import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { PostList, SiteFooter } from '@/components/portfolio-content';
import { listBlogPage } from '@/lib/server/posts';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: '博客 · JIUHENG',
  description: '技术探索与思考随笔。',
};
export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.page || '1', 10) || 1),
  );
  const tag = typeof query.tag === 'string' ? query.tag.slice(0, 24) : '';
  const data = await listBlogPage(page, tag).catch(() => null);
  const url = (target: number) =>
    `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(target) })}`;
  return (
    <div className="reading-site">
      <SiteHeader active="blog" />
      <main id="main-content" className="blog-index container">
        <header className="blog-intro">
          <p className="blog-eyebrow">WRITING &amp; NOTES</p>
          <h1>
            博客<span>。</span>
          </h1>
        </header>
        {data ? (
          <>
            <nav className="tag-filter" aria-label="按标签筛选">
              <Link href="/blog" aria-current={!tag ? 'page' : undefined}>
                全部 <small>{data.total && !tag ? data.total : ''}</small>
              </Link>
              {[...new Set([...data.tags, ...(tag ? [tag] : [])])].map(
                (item) => (
                  <Link
                    key={item}
                    href={`/blog?tag=${encodeURIComponent(item)}`}
                    aria-current={item === tag ? 'page' : undefined}
                  >
                    {item}
                  </Link>
                ),
              )}
            </nav>
            {tag && !data.posts.length ? (
              <p className="blog-notice">暂无带有“{tag}”标签的文章。</p>
            ) : (
              <PostList posts={data.posts} />
            )}
            {data.pages > 1 && (
              <nav className="blog-pagination" aria-label="文章分页">
                {data.page > 1 ? (
                  <Link href={url(data.page - 1)}>← 上一页</Link>
                ) : (
                  <span />
                )}
                <span>
                  {data.page} / {data.pages}
                </span>
                {data.page < data.pages ? (
                  <Link href={url(data.page + 1)}>下一页 →</Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        ) : (
          <output className="blog-notice">
            <strong>文章暂时无法加载</strong>
            <p>请稍后刷新重试。</p>
          </output>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
