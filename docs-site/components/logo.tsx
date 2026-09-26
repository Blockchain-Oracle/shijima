/* Published logos only: the same files the app ships in apps/web/public (brand, logos), plus Uniswap, Chainlink,
   Morpho and Relay from their own published marks. A logo with a light and a dark file swaps with the theme. */

type LogoFile = { name: string; light: string; dark?: string };

export const logos = {
  openserv: { name: 'OpenServ', light: '/logos/openserv-mark-black.svg', dark: '/logos/openserv-mark-white.svg' },
  robinhood: { name: 'Robinhood Chain', light: '/logos/chains/4663.webp', dark: '/logos/chains/4663-dark.webp' },
  telegram: { name: 'Telegram', light: '/logos/telegram.svg' },
  walletconnect: { name: 'WalletConnect', light: '/logos/walletconnect.svg' },
  uniswap: { name: 'Uniswap', light: '/logos/uniswap.png' },
  chainlink: { name: 'Chainlink', light: '/logos/chainlink.png' },
  relay: { name: 'Relay', light: '/logos/relay-mark-black.svg', dark: '/logos/relay-mark-white.svg' },
  morpho: { name: 'Morpho', light: '/logos/morpho.png' },
  base: { name: 'Base', light: '/logos/chains/8453.png', dark: '/logos/chains/8453-dark.png' },
  arbitrum: { name: 'Arbitrum', light: '/logos/chains/42161.png', dark: '/logos/chains/42161-dark.png' },
  ethereum: { name: 'Ethereum', light: '/logos/chains/1.png', dark: '/logos/chains/1-dark.png' },
  bnb: { name: 'BNB Chain', light: '/logos/chains/56.png', dark: '/logos/chains/56-dark.png' },
  usdg: { name: 'USDG', light: '/logos/tokens/usdg.png' },
  eth: { name: 'ETH', light: '/logos/tokens/eth.png' },
} satisfies Record<string, LogoFile>;

export type LogoName = keyof typeof logos;

/** One logo at a fixed size. Decorative when a label sits beside it. */
export function Logo({ name, size = 20, label = false }: { name: LogoName; size?: number; label?: boolean }) {
  const file: LogoFile = logos[name];
  const alt = label ? '' : file.name;
  const common = { width: size, height: size, alt, loading: 'lazy' as const, decoding: 'async' as const };
  return (
    <span className="logo" style={{ width: size, height: size }}>
      {/* biome-ignore lint/performance/noImgElement: static files, no optimiser needed */}
      <img {...common} src={file.light} className={file.dark ? 'logo-light' : undefined} />
      {file.dark && <img {...common} src={file.dark} className="logo-dark" aria-hidden="true" alt="" />}
    </span>
  );
}

/** A logo with its name, for inline use in prose: <Brandname name="openserv" />. */
export function Named({ name }: { name: LogoName }) {
  return (
    <span className="named">
      <Logo name={name} size={16} label />
      {logos[name].name}
    </span>
  );
}

/** A row of partner cards: logo, name and the one job each does for Shijima. */
export function Partners({ items }: { items: { name: LogoName; job: string; href?: string }[] }) {
  return (
    <div className="partners not-prose">
      {items.map((item) => {
        const inner = (
          <>
            <Logo name={item.name} size={28} label />
            <span>
              <strong>{logos[item.name].name}</strong>
              <small>{item.job}</small>
            </span>
          </>
        );
        return item.href ? (
          <a key={item.name} className="partner" href={item.href} target="_blank" rel="noreferrer">
            {inner}
          </a>
        ) : (
          <div key={item.name} className="partner">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
