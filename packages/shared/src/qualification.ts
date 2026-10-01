import { z } from 'zod'

/** A current fixed-rule check, separate from immutable historical decisions. */
const Qualification = z.object({
  summary: z.string(),
  eligibleSymbols: z.array(z.string()),
  excluded: z.array(
    z.object({
      symbol: z.string(),
      rule: z.enum(['MINIMUM_TRADE', 'CASH_RESERVE', 'ACTION_LIMIT', 'PRICE_UNAVAILABLE']),
      text: z.string(),
    }),
  ),
})

export function readQualification(health: Record<string, unknown> | null | undefined) {
  const result = Qualification.safeParse(health?.qualification)
  return result.success ? result.data : null
}
