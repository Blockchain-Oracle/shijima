import { cn } from '@/lib/utils'

/**
 * A partner's real mark, never a stand-in icon. OpenServ's comes from its own brand files, cut to the mark alone
 * and drawn white or black as the theme asks. Telegram, WalletConnect and Chainlink are Simple Icons' marks (CC0)
 * in each brand's colour; Coinbase is its round logomark; Uniswap and Morpho are their token logos, Relay its mark.
 */
export type Brand =
  | 'openserv'
  | 'telegram'
  | 'walletconnect'
  | 'uniswap'
  | 'chainlink'
  | 'morpho'
  | 'coinbase'
  | 'relay'

const LABEL: Record<Brand, string> = {
  openserv: 'OpenServ',
  telegram: 'Telegram',
  walletconnect: 'WalletConnect',
  uniswap: 'Uniswap',
  chainlink: 'Chainlink',
  morpho: 'Morpho',
  coinbase: 'Coinbase',
  relay: 'Relay',
}

/** The file for each mark in public/brand: official artwork, SVG where the brand publishes one. */
const FILE: Record<Exclude<Brand, 'openserv'>, string> = {
  telegram: 'telegram.svg',
  walletconnect: 'walletconnect.svg',
  uniswap: 'uniswap.png',
  chainlink: 'chainlink.svg',
  morpho: 'morpho.png',
  coinbase: 'coinbase.svg',
  relay: 'relay.png',
}

export function BrandLogo({
  brand,
  size = 20,
  className,
  decorative = true,
}: {
  brand: Brand
  size?: number
  className?: string
  /** Beside its own name the mark is decoration; alone it must say what it is. */
  decorative?: boolean
}) {
  const alt = decorative ? '' : LABEL[brand]
  if (brand === 'openserv') {
    return (
      <span className={cn('brand-logo', className)} style={{ width: size, height: size }}>
        {/* biome-ignore lint/performance/noImgElement: a small static brand mark, drawn as the theme asks */}
        <img src="/brand/openserv-mark-white.svg" alt={alt} className="brand-on-dark" />
        {/* biome-ignore lint/performance/noImgElement: as above, for the light theme */}
        <img src="/brand/openserv-mark-black.svg" alt="" className="brand-on-light" />
      </span>
    )
  }
  return (
    <span className={cn('brand-logo', className)} style={{ width: size, height: size }}>
      {/* biome-ignore lint/performance/noImgElement: a small static brand mark */}
      <img src={`/brand/${FILE[brand]}`} alt={alt} />
    </span>
  )
}
