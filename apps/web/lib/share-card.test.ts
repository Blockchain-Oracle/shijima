import type { DecisionInFull, PublicDesk } from '@desk/db'
import { describe, expect, it } from 'vitest'
import { decisionCard } from '../features/share/card-data'

const id = 'b94afdb8-06d9-4d80-9133-2e17304f99db'
const desk = { id, name: 'AI builders', shareSlug: null, mode: 'on_its_own' } as PublicDesk
const full = {
  decision: {
    seq: 4,
    outcome: 'nothing_to_do',
    summary: 'No trade qualified: cash reserve.',
    decidedAt: new Date(),
    confidencePercent: null,
    recordHash: `0x${'ab'.repeat(32)}`,
    sealedByTx: null,
    mode: 'on_its_own',
  },
  actions: [],
  grade: null,
} as unknown as DecisionInFull

describe('share links and honest card copy', () => {
  it('uses an existing agent ID rather than an unresolvable placeholder', () => {
    const card = decisionCard(desk, full, undefined)
    expect(card.path).toBe(`/agents/${id}/decision/4`)
    expect(card.sub).toBe(full.decision.summary)
  })
  it('preserves existing share slugs for new cards', () => {
    expect(decisionCard({ ...desk, shareSlug: 'desk' }, full, undefined).path).toBe('/agents/desk/decision/4')
  })
})
