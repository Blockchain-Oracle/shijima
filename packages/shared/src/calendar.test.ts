import { describe, expect, it } from 'vitest'
import { lastRegularClose, marketAgeSeconds, marketClock, nextRegularOpen, nyWallToUtc } from './calendar'

// September 2026 is EDT (UTC-4). After 1 Nov 2026 it is EST (UTC-5).
const utc = (s: string) => new Date(`${s}Z`)

describe('marketClock sessions', () => {
  it('regular session on a weekday', () => {
    expect(marketClock(utc('2026-09-21T15:00:00')).session).toBe('regular') // Mon 11:00 ET
  })
  it('extended before the open and after the close', () => {
    expect(marketClock(utc('2026-09-21T12:00:00')).session).toBe('extended') // 08:00 ET
    expect(marketClock(utc('2026-09-21T21:00:00')).session).toBe('extended') // 17:00 ET
  })
  it('overnight on a weeknight, and it is anchored', () => {
    const c = marketClock(utc('2026-09-22T05:00:00')) // Tue 01:00 ET
    expect(c.session).toBe('overnight')
    expect(c.anchored).toBe(true)
  })
  it('weekend starts Friday 20:00 ET and ends Sunday 20:00 ET', () => {
    expect(marketClock(utc('2026-09-25T23:59:00')).session).toBe('extended') // Fri 19:59 ET
    const fri = marketClock(utc('2026-09-26T00:00:00')) // Fri 20:00 ET
    expect(fri.session).toBe('weekend')
    expect(fri.anchored).toBe(false)
    expect(marketClock(utc('2026-09-27T23:59:00')).session).toBe('weekend') // Sun 19:59 ET
    const sun = marketClock(utc('2026-09-28T00:00:00')) // Sun 20:00 ET, the hackathon deadline instant
    expect(sun.session).toBe('overnight')
    expect(sun.anchored).toBe(true)
  })
  it('holiday is closed and not anchored', () => {
    const c = marketClock(utc('2026-11-26T16:00:00')) // Thanksgiving, 11:00 EST
    expect(c.session).toBe('holiday')
    expect(c.anchored).toBe(false)
  })
  it('early close day ends the regular session at 13:00 ET', () => {
    expect(marketClock(utc('2026-11-27T17:30:00')).session).toBe('regular') // 12:30 EST
    expect(marketClock(utc('2026-11-27T18:30:00')).session).toBe('extended') // 13:30 EST
  })
})

describe('DST', () => {
  it('maps New York wall time to the right UTC instant on both sides of the change', () => {
    expect(nyWallToUtc('2026-10-30', 570).toISOString()).toBe('2026-10-30T13:30:00.000Z') // EDT
    expect(nyWallToUtc('2026-11-02', 570).toISOString()).toBe('2026-11-02T14:30:00.000Z') // EST
    expect(nyWallToUtc('2027-03-15', 570).toISOString()).toBe('2027-03-15T13:30:00.000Z') // EDT again
  })
})

describe('nextRegularOpen and lastRegularClose', () => {
  it('from a Saturday, the next open is Monday 09:30 ET', () => {
    expect(nextRegularOpen(utc('2026-09-19T17:47:00')).toISOString()).toBe('2026-09-21T13:30:00.000Z')
  })
  it('from a Saturday, the last close was Friday 16:00 ET', () => {
    expect(lastRegularClose(utc('2026-09-19T17:47:00')).toISOString()).toBe('2026-09-18T20:00:00.000Z')
  })
  it('skips a holiday', () => {
    // Wed 25 Nov 2026 evening -> Thanksgiving is closed -> Fri 27 Nov 09:30 EST
    expect(nextRegularOpen(utc('2026-11-25T23:00:00')).toISOString()).toBe('2026-11-27T14:30:00.000Z')
  })
  it('uses the early close as the reference boundary', () => {
    expect(lastRegularClose(utc('2026-11-28T12:00:00')).toISOString()).toBe('2026-11-27T18:00:00.000Z')
  })
  it('during the regular session, the last close is the previous day', () => {
    expect(lastRegularClose(utc('2026-09-22T15:00:00')).toISOString()).toBe('2026-09-21T20:00:00.000Z')
  })
})

describe('marketAgeSeconds', () => {
  it('a feed from Friday 19:55 ET read on Sunday noon is 5 minutes old in market time', () => {
    const from = utc('2026-09-18T23:55:00') // Fri 19:55 ET
    const to = utc('2026-09-20T16:00:00') // Sun 12:00 ET
    expect(marketAgeSeconds(from, to)).toBe(300)
  })
  it('the real NVDA feed reading from 19 Sep: updated Fri 19:55 UTC, read Sat 17:47 UTC', () => {
    // Fri 19:55 UTC is 15:55 ET. Anchored time runs until Fri 20:00 ET (00:00 UTC Sat): 4h05m.
    expect(marketAgeSeconds(utc('2026-09-18T19:55:32'), utc('2026-09-19T17:47:00'))).toBe(
      4 * 3600 + 4 * 60 + 28,
    )
  })
  it('counts weeknight hours in full', () => {
    expect(marketAgeSeconds(utc('2026-09-22T01:00:00'), utc('2026-09-22T05:00:00'))).toBe(4 * 3600)
  })
  it('spans a whole weekend', () => {
    // Fri 12:00 ET to Mon 12:00 ET is 72h wall clock, minus the 48h weekend
    expect(marketAgeSeconds(utc('2026-09-25T16:00:00'), utc('2026-09-28T16:00:00'))).toBe(24 * 3600)
  })
  it('never negative', () => {
    expect(marketAgeSeconds(utc('2026-09-22T05:00:00'), utc('2026-09-22T01:00:00'))).toBe(0)
  })
})
