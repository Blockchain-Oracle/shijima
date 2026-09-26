import { ImageResponse } from 'next/og';

export const alt = 'Shijima Docs: AI agents that keep your Stock Tokens on plan on Robinhood Chain';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const MOON = 'M14.17 4.53A10.5 10.5 0 1 0 25.12 17.79A8.6 8.6 0 0 1 14.17 4.53Z';

/** The share image, drawn at build time in the app's own dark preview colours (apps/web/features/og/theme.ts). */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#050505', color: '#FFFFFF', padding: '60px 72px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="48" height="48" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <path d={MOON} fill="#FFFFFF" />
          <rect x="4.5" y="27" width="23" height="2.2" rx="1.1" fill="#FFFFFF" opacity="0.9" />
          <circle cx="23.2" cy="9.2" r="2.6" fill="#CCFF00" />
        </svg>
        <span style={{ fontSize: 34, fontWeight: 700 }}>Shijima</span>
        <span style={{ fontSize: 26, color: '#A3A3A3', marginLeft: 8 }}>Docs</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 90 }}>
        <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>Wall Street closes.</span>
        <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, color: '#CCFF00' }}>Your agent doesn&apos;t.</span>
        <span style={{ fontSize: 26, lineHeight: 1.5, color: '#A3A3A3', marginTop: 28 }}>How it works, how it decides, and how it is built.</span>
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', color: '#737373', fontSize: 20 }}>Robinhood Chain mainnet · runs on OpenServ</div>
    </div>,
    size,
  );
}
