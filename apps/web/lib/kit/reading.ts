/**
 * Every live read on the website comes back as a Reading, so a page can never show a number without knowing
 * whether it is fresh. Masayume's contract, as Agari has it (`packages/core/src/schemas/reading.ts`):
 *
 *   null              loading: nothing was ever known, so a skeleton and never an invented number
 *   ok, not stale     live
 *   ok, stale         the last good value at full ink, with a tick saying how old it is
 *   ok, but empty     says why it is empty and names the next step (the caller decides what empty means)
 *   not ok            unavailable: an honest diagnosis in plain words
 */
import type { DiagnosisKind } from '@desk/shared'

export interface Diagnosis {
  kind: DiagnosisKind
  technical: string
}

export interface ReadingOk<T> {
  ok: true
  value: T
  asOfMs: number
  stale: boolean
}

export interface ReadingErr {
  ok: false
  error: Diagnosis
}

export type Reading<T> = ReadingOk<T> | ReadingErr

export const ok = <T>(value: T, asOfMs: number, stale = false): ReadingOk<T> => ({
  ok: true,
  value,
  asOfMs,
  stale,
})

export const err = (kind: DiagnosisKind, technical: string): ReadingErr => ({
  ok: false,
  error: { kind, technical },
})

export const isOk = <T>(reading: Reading<T>): reading is ReadingOk<T> => reading.ok

/** The previous good value, now marked stale because a refresh failed. */
export const stale = <T>(previous: ReadingOk<T>): ReadingOk<T> => ({ ...previous, stale: true })
