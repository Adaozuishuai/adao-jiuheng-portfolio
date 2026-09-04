import { ArrowDown } from 'lucide-react';
import Image from 'next/image';
import { HeroIntro } from '@/components/hero-intro';

export default function Home() {
  return (
    <main className="portfolio-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Adao Jiuheng，返回首页">
          <Image src="/logo-dao.png?v=6" alt="DAO" width={88} height={40} priority />
        </a>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <HeroIntro />

        <a className="scroll-cue" href="#work">
          <span>向下探索</span>
          <ArrowDown size={16} strokeWidth={1.5} />
        </a>
      </section>

      <section className="blank-canvas" id="work" aria-hidden="true" />
      <section className="blank-canvas" id="about" aria-hidden="true" />
      <section className="blank-canvas" id="playground" aria-hidden="true" />
      <section className="blank-canvas" id="contact" aria-hidden="true" />
    </main>
  );
}
