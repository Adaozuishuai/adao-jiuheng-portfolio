import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArticleView } from '@/components/article-view';
import { SiteFooter } from '@/components/portfolio-content';
import { SiteHeader } from '@/components/site-header';
import { getPublishedBySlug } from '@/lib/server/posts';
export const dynamic = 'force-dynamic';
const getPost = cache(getPublishedBySlug);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: '文章未找到 · JIUHENG' };
  return {
    title: `${post.title} · JIUHENG`,
    description: post.excerpt || post.title,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.firstPublishedAt.toISOString(),
      modifiedTime: post.lastPublishedAt.toISOString(),
    },
  };
}
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  return (
    <div className="reading-site">
      <SiteHeader active="blog" />
      <ArticleView
        {...post}
        date={post.firstPublishedAt.toISOString().slice(0, 10)}
      />
      <SiteFooter />
    </div>
  );
}
