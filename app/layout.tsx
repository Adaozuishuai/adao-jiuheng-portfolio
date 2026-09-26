import type { Metadata } from 'next';
import { BasketballEntry } from '@/components/basketball-entry';
import './globals.css';
import './blog.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL || 'http://localhost:3000',
  ),
  title: 'JiuHeng',
  description: '九恒的个人作品集与博客。',
  icons: {
    icon: [
      { url: '/favicon-dao-connected.png?v=6', type: 'image/png', sizes: '1024x1024' },
    ],
    shortcut: ['/favicon-dao-connected.png?v=6'],
    apple: [
      { url: '/favicon-dao-connected.png?v=6', type: 'image/png', sizes: '1024x1024' },
    ],
  },
  openGraph: {
    type: 'website',
    title: 'JiuHeng',
    description: '九恒的个人作品集与博客。',
    images: [{ url: '/og.png', width: 1600, height: 900, alt: 'JiuHeng' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JiuHeng',
    description: '九恒的个人作品集与博客。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}<BasketballEntry /></body>
    </html>
  );
}
