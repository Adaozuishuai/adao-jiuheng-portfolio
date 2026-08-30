import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://adao-zhou-product-portfolio.wangguangyi1007.chatgpt.site',
  ),
  title: 'Adao Jiuheng — AI 产品构建者',
  description:
    '独立 AI 产品构建者，专注于产品战略、智能体系统与可落地的数字体验。',
  openGraph: {
    type: 'website',
    title: 'Adao Jiuheng — AI 产品构建者',
    description:
      '独立 AI 产品构建者，专注于产品战略、智能体系统与可落地的数字体验。',
    images: [{ url: '/og.png', width: 1600, height: 900, alt: 'Adao Jiuheng — AI 产品构建者' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Adao Jiuheng — AI 产品构建者',
    description:
      '独立 AI 产品构建者，专注于产品战略、智能体系统与可落地的数字体验。',
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
