/**
 * Turning exact numbers into words for a person.
 *
 * This is the ONLY place in the product where a float is allowed. Everywhere else money is a bigint and a
 * record holds decimal strings, because a float cannot be hashed reproducibly. Here the number has already
 * done its work and is only being read.
 *
 * No value is ever shown without knowing where it came from and how old it is, so the price helpers take that
 * with them rather than letting a caller forget.
 */
const USDG_DECIMALS = 6
const TOKEN_DECIMALS = 18
const PRICE_DECIMALS = 8

const scaled = (value: bigint, decimals: number) => Number(value) / 10 ** decimals

function dollars(n: number): string {
  const abs = Math.abs(n)
  const places = abs !== 0 && abs < 0.01 ? 4 : 2
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}`
}

/** Dollars, as the owner reads them. Small amounts keep their cents, because a desk can hold a few dollars. */
export const usd = (value: bigint, decimals = USDG_DECIMALS): string => dollars(scaled(value, decimals))

/** The same, for the decimal strings a record holds. A record never carries a float, so this is where it becomes one. */
export const money = (decimal: string): string => dollars(Number(decimal))

/** A price, always shown with more care than a total: four decimal places, never rounded to the dollar. */
export const price = (value: bigint, decimals = PRICE_DECIMALS): string =>
  `$${scaled(value, decimals).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`

/** An amount of a Stock Token. Enough places to be exact at these sizes, with trailing zeros dropped. */
export function tokens(value: bigint, decimals = TOKEN_DECIMALS): string {
  const n = scaled(value, decimals)
  if (n === 0) return '0'
  const places = Math.abs(n) < 1 ? 6 : 4
  return n.toFixed(places).replace(/\.?0+$/, '')
}

/** Basis points as a percentage. 300 becomes "3.0%". */
export const percent = (bps: number, places = 1): string => `${(bps / 100).toFixed(places)}%`

/** Basis points with their sign kept, for a gap or a drift. 40 becomes "+0.4%". */
export const signedPercent = (bps: number, places = 2): string =>
  `${bps > 0 ? '+' : bps < 0 ? '-' : ''}${(Math.abs(bps) / 100).toFixed(places)}%`

/** "in line", "0.4% below" or "0.4% above". Under the threshold the difference is not worth a number. */
export function comparedTo(bps: number, inLineBelowBps = 50): string {
  if (Math.abs(bps) < inLineBelowBps) return 'in line'
  return `${percent(Math.abs(bps), 2)} ${bps < 0 ? 'below' : 'above'}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". Never a bare timestamp where a person reads it. */
export function ago(at: Date, now: Date = new Date()): string {
  const ms = now.getTime() - at.getTime()
  if (ms < 0) return 'in the future'
  if (ms < MINUTE) return 'just now'
  if (ms < HOUR) return plural(Math.round(ms / MINUTE), 'minute')
  if (ms < DAY) return plural(Math.round(ms / HOUR), 'hour')
  return plural(Math.round(ms / DAY), 'day')
}

/** "in 45 minutes", "in 2 hours", or "expired". Used for anything the owner has a limited time to answer. */
export function until(at: Date, now: Date = new Date()): string {
  const ms = at.getTime() - now.getTime()
  if (ms <= 0) return 'expired'
  if (ms < MINUTE) return 'in under a minute'
  if (ms < HOUR) return `in ${plural(Math.round(ms / MINUTE), 'minute', false)}`
  if (ms < DAY) return `in ${plural(Math.round(ms / HOUR), 'hour', false)}`
  return `in ${plural(Math.round(ms / DAY), 'day', false)}`
}

function plural(n: number, unit: string, suffix = true): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}${suffix ? ' ago' : ''}`
}

/** A time in New York, where the market is, labelled so nobody mistakes it for their own clock. */
export function newYorkTime(at: Date): string {
  return `${at.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })} New York`
}

/** The viewer's own clock. Rendered on the client, where the browser knows the zone. */
export function localTime(at: Date): string {
  return at.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/** The first and last few characters of an address or a hash, for somewhere there is no room for all of it. */
export const short = (hex: string, lead = 6, tail = 4): string =>
  hex.length <= lead + tail + 2 ? hex : `${hex.slice(0, lead)}…${hex.slice(-tail)}`
