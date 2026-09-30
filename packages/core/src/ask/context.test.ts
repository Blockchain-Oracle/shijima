import type { Db } from '@desk/db'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ prices: vi.fn(), conversation: vi.fn() }))
vi.mock('@desk/db', () => ({ latestPricePoints: mocks.prices, recentConversation: mocks.conversation }))

import { loadAskContext } from './context'

describe('assistant before an agent exists', () => {
  it('includes this owner’s previous exchanges and permits no agent action', async () => {
    mocks.prices.mockResolvedValue([])
    mocks.conversation.mockResolvedValue([
      { question: 'Tell me about NVDA', reply: { reply: 'Nvidia is a Stock Token.' } },
    ])
    const db = {} as Db
    const context = await loadAskContext(db, {
      deskId: null,
      ownerAddress: '0xowner',
      question: 'And the strategies?',
      approved: [],
      now: new Date(),
    })
    expect(mocks.conversation).toHaveBeenCalledWith(db, null, '0xowner')
    expect(context).toMatchObject({ facts: null, desk: null })
    if ('refused' in context) throw new Error('The no-agent conversation was refused')
    expect(context.message).toContain('Owner: Tell me about NVDA')
    expect(context.message).toContain('Shijima: Nvidia is a Stock Token.')
    expect(context.message).toContain('propose nothing')
    expect(context.message).toContain('And the strategies?')
  })
})
