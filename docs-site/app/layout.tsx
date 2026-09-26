import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { site } from '@/lib/site';
import './global.css';

const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['500', '600', '700'] });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  metadataBase: new URL(site.docs),
  title: { default: 'Shijima Docs: AI agents for Stock Tokens', template: '%s · Shijima Docs' },
  description:
    'How Shijima works: an AI agent that keeps your basket of US Stock Tokens on plan around the clock on Robinhood Chain, inside limits your own account enforces.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable} ${mono.variable}`}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <RootProvider
          theme={{ defaultTheme: 'system', enableSystem: true, storageKey: 'shijima-docs-theme' }}
          search={{
            links: [
              ['Your first agent', '/start/first-agent'],
              ['How it decides', '/agent/how-it-decides'],
              ['System overview', '/architecture/overview'],
            ],
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
