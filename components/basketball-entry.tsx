'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
// Keep the free-play world on inner pages, out of the homepage bundle.
const World = dynamic(
  () => import('./basketball-world').then((m) => m.BasketballWorld),
  { ssr: false },
);
export function BasketballEntry() {
  const pathname = usePathname();
  return pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/blog') ? null : (
    <World />
  );
}
