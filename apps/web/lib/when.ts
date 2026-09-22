/**
 * A moment in the reader's own zone with the New York fact beside it, from Agari (`lib/when.ts`, D-120).
 *
 * The market's clock is New York's, and a reader in Lagos who sees "reopens Mon 09:30" reads it as their own
 * morning. So a boundary is written as "Mon 14:30 (09:30 ET)": theirs first, the market's beside it. A reader
 * whose clock is New York's sees the plain form once. With no zone known (the server render), the New York
 * form stands, labelled, and the browser rewrites it once it knows where it is.
 */
type Parts = { clock: string; day: string; date: string }

function parts(timeZone: string, at: Date): Parts {
  const clock = at.toLocaleTimeString('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const day = at.toLocaleDateString('en-US', { timeZone, weekday: 'short' })
  const date = at.toLocaleDateString('en-CA', { timeZone })
  return { clock, day, date }
}

const NEW_YORK = 'America/New_York'

/** A formatter for one viewer zone, or for none. `clock` gives the short form with no weekday. */
export function whenFor(zone: string | null) {
  return (at: Date, options: { clock?: boolean } = {}): string => {
    const ny = parts(NEW_YORK, at)
    const nyText = options.clock ? `${ny.clock} ET` : `${ny.day} ${ny.clock} ET`
    if (!zone) return nyText
    const local = parts(zone, at)
    if (local.clock === ny.clock && local.date === ny.date) return nyText
    if (options.clock) return `${local.clock} (${ny.clock} ET)`
    const today = local.date === parts(zone, new Date()).date
    const mine = `${today ? '' : `${local.day} `}${local.clock}`
    const theirs = `${local.date === ny.date ? '' : `${ny.day} `}${ny.clock} ET`
    return `${mine} (${theirs})`
  }
}
