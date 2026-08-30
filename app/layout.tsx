import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://adao-zhou-product-portfolio.wangguangyi1007.chatgpt.site',
  ),
  title: 'Adao Zhou — AI Product Builder',
  description:
    'Independent AI product builder shaping useful products, systems and digital experiences.',
  openGraph: {
    type: 'website',
    title: 'Adao Zhou — AI Product Builder',
    description:
      'Independent AI product builder shaping useful products, systems and digital experiences.',
    images: [{ url: '/og.png', width: 1600, height: 900, alt: 'Adao Zhou — AI Product Builder' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Adao Zhou — AI Product Builder',
    description:
      'Independent AI product builder shaping useful products, systems and digital experiences.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
