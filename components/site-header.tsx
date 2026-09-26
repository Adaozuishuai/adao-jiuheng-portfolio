import { HomeSectionLink } from './home-section-link';
import Image from 'next/image';
import Link from 'next/link';

export function SiteHeader({ active }: { active?: 'work' | 'blog' }) {
  return (
    <header className="site-header container">
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
    </header>
  );
}
