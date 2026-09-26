import { HomeSectionLink } from '@/components/home-section-link';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/portfolio-content';
import { projects, projectVisuals } from '@/lib/content';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((item) => item.id === slug);
  if (!project) return { title: '作品未找到 · JIUHENG' };
  return {
    title: `${project.title} · JIUHENG`,
    description: `${project.category} · ${project.year} · 概念探索`,
    alternates: { canonical: `/work/${project.id}` },
  };
}

export default async function WorkDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = projects.find((item) => item.id === slug);
  if (!project) notFound();
  const visual = projectVisuals[project.id];

  return <>
    <SiteHeader active="work" />
    <main className="article-page work-detail" id="main-content">
      <HomeSectionLink className="detail-back" section="featured">← 返回作品</HomeSectionLink>
      <header>
        <p>{project.category} · {project.year}</p>
        <h1>{project.title}</h1>
        <p>概念探索 / CONCEPT STUDIES</p>
      </header>
      {visual.src ? (
        <Image className="article-cover" src={visual.src} alt={visual.alt} width={1600} height={1000} sizes="(max-width: 800px) 100vw, 760px" priority />
      ) : (
        <div className="project-system-art detail-system-art" aria-hidden="true">{project.mark}</div>
      )}
      <p className="project-pending">项目介绍待补充。</p>
    </main>
    <SiteFooter />
  </>;
}
