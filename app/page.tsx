import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { HeroIntro } from '@/components/hero-intro';

const featured = [
  { index: '01', title: '界面与体验', type: '产品设计 · 2026', tone: 'red', mark: 'UI' },
  { index: '02', title: '人与智能体', type: '交互实验 · 2025', tone: 'ink', mark: 'AI' },
  { index: '03', title: '未命名练习', type: '视觉研究 · 2025', tone: 'acid', mark: 'LAB' },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Jiuheng 首页">
          <Image src="/logo-dao.png?v=6" alt="DAO" width={88} height={40} priority />
        </Link>
        <nav aria-label="主要导航">
          <Link href="/work">作品</Link><Link href="/blog">博客</Link>
        </nav>
        <span className="header-index">作品与文字 · 2026</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <HeroIntro />
        <div className="hero-meta">
          <p>个人作品集<br />设计、实验与持续思考</p>
          <p>中国 · 2026<br />持续更新</p>
        </div>
        <a className="scroll-cue" href="#featured"><span>查看作品</span><ArrowDown aria-hidden="true" size={18} /></a>
      </section>

      <section className="featured" id="featured" aria-labelledby="featured-title">
        <div className="section-head">
          <p>01 / SELECTED WORK</p>
          <h2 id="featured-title">精选作品</h2>
          <Link href="/work">全部作品 <ArrowUpRight aria-hidden="true" size={18} /></Link>
        </div>
        <div className="project-grid">
          {featured.map((project) => (
            <Link className="project-card" href="/work" key={project.index}>
              <div className={`project-art art-${project.tone}`}>
                <span className="art-index">({project.index})</span><strong>{project.mark}</strong>
                <ArrowUpRight className="art-arrow" aria-hidden="true" />
              </div>
              <div className="project-caption"><h3>{project.title}</h3><p>{project.type}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-blog">
        <div className="blog-heading"><p>02 / LATEST WRITING</p><h2>最近在写</h2><Link href="/blog">全部文章 <ArrowUpRight size={18}/></Link></div>
        <div className="home-posts">
          <Link href="/blog"><span>01</span><div><p>设计笔记 · 2026.08.21</p><h3>一个作品什么时候才算真正完成？</h3></div><ArrowUpRight /></Link>
          <Link href="/blog"><span>02</span><div><p>过程记录 · 2026.07.09</p><h3>从模糊想法到可以使用的产品</h3></div><ArrowUpRight /></Link>
          <Link href="/blog"><span>03</span><div><p>随笔 · 2026.05.16</p><h3>我如何整理视觉参考</h3></div><ArrowUpRight /></Link>
        </div>
        <footer className="site-footer"><strong>JIUHENG</strong><p>WORK & WRITING<br/>© 2026</p></footer>
      </section>
    </main>
  );
}
