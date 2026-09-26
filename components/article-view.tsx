import Link from 'next/link';
import Image from 'next/image';
import type { EditorDocument } from '@/lib/blog/types';
import { headings } from '@/lib/blog/document';
import { ArticleContent } from './article-content';
import { ArticleToc } from './article-toc';
export function ArticleView({
  title,
  excerpt,
  tags,
  content,
  coverAssetId,
  date,
  backHref = '/blog',
  backLabel = '返回博客',
}: {
  title: string;
  excerpt: string;
  tags: string[];
  content: EditorDocument;
  coverAssetId: string | null;
  date?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const toc = headings(content);
  return (
    <main id="main-content" className="article-shell">
      <aside className="article-sidebar" aria-label="作者与文章目录">
        <div className="article-sidebar-inner">
          <Link className="article-author" href="/" aria-label="九恒的个人主页">
            <span className="article-author-avatar" aria-hidden="true">
              恒
            </span>
            <span className="article-author-info">
              <strong>jiuheng</strong>
            </span>
          </Link>
          <ArticleToc headings={toc} className="article-toc" />
        </div>
      </aside>
      <article className="article-page">
        <Link className="detail-back" href={backHref}>
          ← {backLabel}
        </Link>
        <header>
          <div className="article-meta">
            {date && <time dateTime={date}>{date.replaceAll('-', '.')}</time>}
          </div>
          <h1>{title}</h1>
          <div className="post-tags">
            {tags.map((tag) => (
              <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
          {excerpt && <p>{excerpt}</p>}
        </header>
        {coverAssetId && (
          <Image
            className="article-cover"
            src={`/api/assets/${coverAssetId}`}
            alt="文章封面"
            width={1600}
            height={1000}
            unoptimized
            priority
          />
        )}
        <ArticleToc headings={toc} className="mobile-toc" />
        <ArticleContent document={content} />
        <p className="article-end">— 感谢阅读 —</p>
      </article>
    </main>
  );
}
