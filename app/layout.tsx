import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://adao-zhou-product-portfolio.wangguangyi1007.chatgpt.site',
  ),
  title: 'Jiuheng — 作品与文字',
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
    title: 'Jiuheng — 作品与文字',
    description: '九恒的个人作品集与博客。',
    images: [{ url: '/og.png', width: 1600, height: 900, alt: 'Jiuheng — 作品与文字' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jiuheng — 作品与文字',
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
      <body>{children}</body>
    </html>
  );
}
