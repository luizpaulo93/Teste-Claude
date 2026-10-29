import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import { Toaster } from '@/components/toast';
import { ConfirmHost } from '@/components/confirm';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Vértice — Área do Aluno', template: '%s · Vértice' },
  description: 'Plataforma de estudos para Enem e vestibulares.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Vértice' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07080c' },
    { media: '(prefers-color-scheme: light)', color: '#f5f7fb' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value === 'light' ? 'light' : 'dark';
  return (
    <html lang="pt-BR" data-theme={theme} className={jakarta.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
