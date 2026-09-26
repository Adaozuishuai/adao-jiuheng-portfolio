import Link from 'next/link';
import './admin.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: '写作后台 · JIUHENG',
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-site">
      <header className="admin-header">
        <Link href="/admin" className="admin-brand">
          JIUHENG <span>/ 写作台</span>
        </Link>
        <Link href="/">访问网站 ↗</Link>
      </header>
      {children}
    </div>
  );
}
