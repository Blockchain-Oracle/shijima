/**
 * US market clock for the desk.
 *
 * Two questions matter to this product, and they are different:
 *   1. Which session is the underlying market in? (what the owner sees)
 *   2. Is the on-chain price ANCHORED right now? Authorised Participants can mint and burn Stock Tokens
 *      from Sunday 20:00 ET to Friday 20:00 ET, which keeps the pool near the real market. Outside that
 *      window nothing anchors it. That unanchored window is the reason this product exists.
 *
 * No library: npm has nothing maintained. Holiday table is from nyse.com, verified 2026-09-19.
 * Timezone maths uses built-in Intl, which is DST safe. Temporal is not available on Node 24 or 25.
 *
 * ASSUMPTION: on a full market holiday the overnight venues are closed too, so the closed window runs
 * from 20:00 ET the evening before to 20:00 ET on the holiday. No holiday falls inside the hackathon.
 */

export type Session = 'regular' | 'extended' | 'overnight' | 'weekend' | 'holiday'

const CLOSED = new Set([
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-03-26',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-11-25',
  '2027-12-24',
])
const EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26'])

const OPEN_MIN = 9 * 60 + 30
const CLOSE_MIN = 16 * 60
const EARLY_CLOSE_MIN = 13 * 60
const EXT_START_MIN = 7 * 60
const EVENING_MIN = 20 * 60
const MS_MIN = 60_000
const MS_DAY = 86_400_000

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

export interface NyTime {
  date: string
  weekday: string
  minutes: number
  seconds: number
}

export function nyTime(at: Date): NyTime {
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(at)) p[part.type] = part.value
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday ?? '',
    minutes: Number(p.hour) * 60 + Number(p.minute),
    seconds: Number(p.second),
  }
}

/** The UTC instant of a New York wall-clock time. Correct across DST changes. */
export function nyWallToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, minutes)
  // New York is UTC-5 or UTC-4. Try both and keep the one that reads back as the requested wall time.
  for (const offsetH of [4, 5]) {
    const guess = new Date(wallAsUtc + offsetH * 3_600_000)
    const back = nyTime(guess)
    if (back.date === date && back.minutes === minutes) return guess
  }
  throw new Error(`nyWallToUtc: ${date} ${minutes} does not exist in New York (DST gap)`)
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d) + n * MS_DAY).toISOString().slice(0, 10)
}
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 Sun .. 6 Sat
}
const isTradingDay = (date: string) => {
  const wd = weekdayOf(date)
  return wd !== 0 && wd !== 6 && !CLOSED.has(date)
}
export const closeMinutes = (date: string) => (EARLY_CLOSE.has(date) ? EARLY_CLOSE_MIN : CLOSE_MIN)

export interface MarketClock {
  nyDate: string
  session: Session
  /** True while Authorised Participants can mint and burn, so the pool tracks the real market. */
  anchored: boolean
  isEarlyCloseDay: boolean
}

export function marketClock(at: Date = new Date()): MarketClock {
  const t = nyTime(at)
  const wd = weekdayOf(t.date)
  const anchored = !inClosedWindow(at)
  const base = { nyDate: t.date, anchored, isEarlyCloseDay: EARLY_CLOSE.has(t.date) }
  if (wd === 6 || (wd === 0 && t.minutes < EVENING_MIN) || (wd === 5 && t.minutes >= EVENING_MIN)) {
    return { ...base, session: 'weekend' }
  }
  if (!anchored) return { ...base, session: 'holiday' }
  if (wd === 0) return { ...base, session: 'overnight' } // Sunday evening, Monday's overnight session
  const close = closeMinutes(t.date)
  if (CLOSED.has(t.date)) return { ...base, session: 'overnight' } // holiday after 20:00 ET
  if (t.minutes >= OPEN_MIN && t.minutes < close) return { ...base, session: 'regular' }
  if (
    (t.minutes >= EXT_START_MIN && t.minutes < OPEN_MIN) ||
    (t.minutes >= close && t.minutes < EVENING_MIN)
  ) {
    return { ...base, session: 'extended' }
  }
  return { ...base, session: 'overnight' }
}

/** Closed windows [start, end) that overlap [from, to]. Weekends, and holidays from the evening before. */
export function closedWindows(from: Date, to: Date): Array<[number, number]> {
  const raw: Array<[number, number]> = []
  let date = addDays(nyTime(from).date, -3)
  const last = addDays(nyTime(to).date, 3)
  while (date <= last) {
    if (weekdayOf(date) === 5) {
      raw.push([
        nyWallToUtc(date, EVENING_MIN).getTime(),
        nyWallToUtc(addDays(date, 2), EVENING_MIN).getTime(),
      ])
    }
    if (CLOSED.has(date)) {
      raw.push([
        nyWallToUtc(addDays(date, -1), EVENING_MIN).getTime(),
        nyWallToUtc(date, EVENING_MIN).getTime(),
      ])
    }
    date = addDays(date, 1)
  }
  raw.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const w of raw) {
    const prev = merged[merged.length - 1]
    if (prev && w[0] <= prev[1]) prev[1] = Math.max(prev[1], w[1])
    else merged.push([w[0], w[1]])
  }
  return merged.filter(([s, e]) => e > from.getTime() && s < to.getTime())
}

function inClosedWindow(at: Date): boolean {
  const ms = at.getTime()
  return closedWindows(new Date(ms - MS_MIN), new Date(ms + MS_MIN)).some(([s, e]) => ms >= s && ms < e)
}

/**
 * Seconds of ANCHORED market time between two instants. This is how feed staleness must be measured:
 * the Chainlink feed is "24/5", so a price from Friday 19:55 ET read on Sunday noon is 5 minutes old in
 * market time, not 40 hours. Never measure feed age in wall-clock hours.
 */
export function marketAgeSeconds(from: Date, to: Date = new Date()): number {
  const a = from.getTime()
  const b = to.getTime()
  if (b <= a) return 0
  let closed = 0
  for (const [s, e] of closedWindows(from, to)) closed += Math.max(0, Math.min(b, e) - Math.max(a, s))
  return Math.round((b - a - closed) / 1000)
}

/** The next regular-session open strictly after `at`. */
export function nextRegularOpen(at: Date = new Date()): Date {
  let date = nyTime(at).date
  for (let i = 0; i < 14; i++) {
    if (isTradingDay(date)) {
      const open = nyWallToUtc(date, OPEN_MIN)
      if (open.getTime() > at.getTime()) return open
    }
    date = addDays(date, 1)
  }
  throw new Error('nextRegularOpen: no trading day found in 14 days')
}

/** The most recent regular-session close at or before `at`. The reference price is taken here. */
export function lastRegularClose(at: Date = new Date()): Date {
  let date = nyTime(at).date
  for (let i = 0; i < 14; i++) {
    if (isTradingDay(date)) {
      const close = nyWallToUtc(date, closeMinutes(date))
      if (close.getTime() <= at.getTime()) return close
    }
    date = addDays(date, -1)
  }
  throw new Error('lastRegularClose: no trading day found in 14 days')
}
