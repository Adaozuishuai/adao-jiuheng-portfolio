import { HomeSectionLink } from './home-section-link';
import Image from 'next/image';
import Link from 'next/link';

export function SiteHeader({ active, home = false }: { active?: 'work' | 'blog'; home?: boolean }) {
  return (
    <header className={`site-header container${home ? ' site-header-home' : ''}`}>
      <Link className="brand" href="/" aria-label="Jiuheng 首页">
        <Image src="/logo-dao.png" alt="DAO" width={88} height={40} priority />
      </Link>
      <nav aria-label="主要导航">
        <HomeSectionLink section="writing" active={active === 'blog'}>
          博客
        </HomeSectionLink>
        <HomeSectionLink section="featured" active={active === 'work'}>
          作品
        </HomeSectionLink>
      </nav>
      {home && (
        <a className="site-header-zhihu" href="https://www.zhihu.com/people/m11fiv" target="_blank" rel="noopener noreferrer">
          <Image src="/zhihu-logo.svg" alt="知乎" width={48} height={23} />
        </a>
      )}
    </header>
  );
}
