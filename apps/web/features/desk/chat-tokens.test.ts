import { describe, expect, it } from 'vitest'
import { type ChatToken, matchingChatTokens } from './chat-tokens'

const tokens: ChatToken[] = [
  { symbol: 'NVDA', name: 'Nvidia', price: null, at: null },
  { symbol: 'META', name: 'Meta', price: null, at: null },
  { symbol: 'SPY', name: 'S&P 500 fund', price: null, at: null },
]
describe('chat token discovery', () => {
  it('matches tickers, pasted cashtags and company names', () => {
    expect(matchingChatTokens(tokens, 'Compare $NVDA and meta.').map((t) => t.symbol)).toEqual([
      'NVDA',
      'META',
    ])
    expect(matchingChatTokens(tokens, 'Show Nvidia').map((t) => t.symbol)).toEqual(['NVDA'])
  })
  it('does not fabricate a card for substrings or unlisted tokens', () => {
    expect(matchingChatTokens(tokens, 'metaverse, spying and BTC')).toEqual([])
  })
})
