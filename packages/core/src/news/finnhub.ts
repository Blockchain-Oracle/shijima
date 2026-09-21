/**
 * Company news from Finnhub. Verified on a Sunday (2026-09-20): weekend volume is good, but the feed for a
 * ticker is full of loosely related articles, so only headlines that NAME the company or ticker are kept.
 *
 * Headlines are untrusted text from the internet that ends up in front of a model which can trigger trades.
 * So: strip markup, drop control characters, collapse whitespace, cap the length, and always present them
 * as quoted data.
 *
 * Licence: Finnhub's free plan forbids passing its text on to third parties. The model may read it. A public
 * page may show only source, time and link. So a hashed record stores a HASH of the title, never the title.
 */
export interface Headline {
  title: string
  source: string
  url: string
  publishedAt: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function sanitiseHeadline(raw: string, maxLength = 160): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** True when the headline names the company. Whole words only, so "AMD" does not match "AMDOCS". */
export function namesCompany(title: string, names: string[]): boolean {
  return names.some((n) => new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(n)}([^A-Za-z0-9]|$)`, 'i').test(title))
}

/** Returns undefined when news cannot be fetched. "No news" and "news unavailable" are different facts. */
export async function fetchCompanyNews(
  symbol: string,
  names: string[],
  apiKey: string,
  opts: { hours?: number; max?: number; now?: Date } = {},
): Promise<Headline[] | undefined> {
  const now = opts.now ?? new Date()
  const from = new Date(now.getTime() - (opts.hours ?? 72) * 3_600_000)
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${day(from)}&to=${day(now)}&token=${apiKey}`
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const items = (await res.json()) as Array<{
        headline?: string
        source?: string
        url?: string
        datetime?: number
      }>
      if (!Array.isArray(items)) throw new Error('unexpected response shape')
      const seen = new Set<string>()
      return items
        .filter((x) => x.headline && x.url && x.datetime && x.datetime * 1000 >= from.getTime())
        .map((x) => ({
          title: sanitiseHeadline(x.headline as string),
          source: sanitiseHeadline(x.source ?? 'unknown', 40),
          url: x.url as string,
          publishedAt: new Date((x.datetime as number) * 1000).toISOString(),
        }))
        .filter((h) => namesCompany(h.title, [symbol, ...names]))
        .filter((h) => {
          const key = h.title.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, opts.max ?? 5)
    } catch {
      await sleep(1500 * (i + 1))
    }
  }
  return undefined
}
