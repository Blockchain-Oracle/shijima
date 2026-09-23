import { Hanken_Grotesk, IBM_Plex_Mono, Noto_Serif_JP } from 'next/font/google'

/**
 * ZK Freighter's two faces (packages/ui/src/tokens.ts: Hanken Grotesk and IBM Plex Mono), loaded under the
 * variable names the rest of the design system already reads. `--font-sora` (display) and `--font-inter`
 * (body) are both Hanken Grotesk now, and `--font-jetbrains` (numbers) is IBM Plex Mono, so every page takes the
 * reference's type without a CSS change. Noto Serif JP stays for the しじま mark.
 */

export const display = Hanken_Grotesk({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const body = Hanken_Grotesk({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const mono = IBM_Plex_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const notoSerifJp = Noto_Serif_JP({
  variable: '--font-noto-serif-jp',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '700'],
})

export const fontVariables = [display.variable, body.variable, mono.variable, notoSerifJp.variable].join(' ')
