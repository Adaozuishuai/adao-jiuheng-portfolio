import Image from 'next/image';
import Link from 'next/link';

export function SiteHeader({ label = '作品与文字 · 2026' }: { label?: string }) {
  return (
    <header className="site-header page-header">
      <Link className="brand" href="/" aria-label="Jiuheng 首页">
        <Image src="/logo-dao.png?v=6" alt="DAO" width={88} height={40} priority />
      </Link>
      <nav aria-label="主要导航">
        <Link href="/work">作品</Link><Link href="/blog">博客</Link>
      </nav>
      <span className="header-index">{label}</span>
    </header>
  );
}
