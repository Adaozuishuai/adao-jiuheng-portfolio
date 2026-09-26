import type { ReactNode } from 'react';

export function HomeSectionLink({ section, children, className, active }: {
  section: 'featured' | 'writing';
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  // Native anchors avoid duplicate hash fragments in Next 16.3 client navigation.
  // oxlint-disable-next-line next/no-html-link-for-pages
  return <a href={`/#${section}`} className={className} aria-current={active ? 'location' : undefined}>{children}</a>;
}
