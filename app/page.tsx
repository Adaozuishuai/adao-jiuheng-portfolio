import { HomeSectionLink } from '@/components/home-section-link';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { HeroIntro } from '@/components/hero-intro';
import { SiteHeader } from '@/components/site-header';
import { PostList } from '@/components/portfolio-content';
import { BasketballScene } from '@/components/home/basketball-scene';
import { FeaturedWorkGallery } from '@/components/featured-work-gallery';
import { projects, projectVisuals } from '@/lib/content';
import { listPublished } from '@/lib/server/posts';
import './home.css';

export const dynamic = 'force-dynamic';
function Label({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <p className="editorial-label">
      <span>{number}</span>
      <span>/</span>
      {children}
    </p>
  );
}
export default async function Home() {
  const posts = await listPublished(5).catch(() => null);
  return (
    <div className="editorial-home">
      <SiteHeader />
      <main id="main-content">
        <section
          className="editorial-hero home-container"
          aria-labelledby="hero-title"
        >
          <div className="hero-wall" aria-hidden="true" />
          <HeroIntro split />
          <div className="hero-identity">
            <p>Be yourself. Let others think what they will.</p>
          </div>
          <a className="hero-explore" href="#writing">
            阅读博客 <ArrowDown size={16} aria-hidden="true" />
          </a>
          <BasketballScene />
        </section>
        <section
          className="home-writing home-container home-section"
          id="writing"
          aria-labelledby="posts-title"
        >
          <Label number="01">WRITING &amp; NOTES</Label>
          <div className="home-heading">
            <h2 id="posts-title">博客</h2>
            <Link href="/blog">全部博客 ↗</Link>
          </div>
          {posts === null ? (
            <output className="blog-notice">
              文章暂时无法加载，请稍后重试。
            </output>
          ) : (
            <PostList featured posts={posts} />
          )}
        </section>
        <section
          className="home-section home-container"
          id="featured"
          aria-labelledby="work-title"
        >
          <Label number="02">SELECTED WORK</Label>
          <div className="home-heading">
            <h2 id="work-title">精选作品</h2>
          </div>
          <FeaturedWorkGallery projects={projects} visuals={projectVisuals} />
          <p className="concept-note">概念探索 / CONCEPT STUDIES</p>
        </section>
      </main>
      <footer className="home-footer home-container">
        <Link href="/" aria-label="Jiuheng 首页">
          <Image
            src="/logo-dao.png"
            alt="DAO"
            width={1024}
            height={396}
            style={{ width: 64, height: 'auto' }}
          />
        </Link>
        <div className="footer-legal">
          <small>© 2026 JIUHENG</small>
          <a
            className="icp-link"
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
          >
            皖ICP备2026031835号-1
          </a>
        </div>
        <nav aria-label="页脚导航">
          <HomeSectionLink section="writing">博客</HomeSectionLink>
          <HomeSectionLink section="featured">作品</HomeSectionLink>
          <Link className="admin-entry" href="/admin">
            管理
          </Link>
        </nav>
      </footer>
    </div>
  );
}
