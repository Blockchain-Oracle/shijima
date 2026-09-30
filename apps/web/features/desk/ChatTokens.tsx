'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { TokenLogo } from '@/components/ui/token-logo'
import { type ChatToken, matchingChatTokens } from './chat-tokens'

export function useChatTokens() {
  return useQuery({
    queryKey: ['assistant-tokens'],
    staleTime: 60_000,
    queryFn: async (): Promise<ChatToken[]> => {
      const res = await fetch('/api/assistant/tokens')
      if (!res.ok) throw new Error('Could not load Stock Tokens.')
      return (await res.json()).tokens
    },
  })
}

export function ChatTokens({ tokens, text }: { tokens: ChatToken[]; text?: string }) {
  const shown = text === undefined ? tokens.slice(0, 3) : matchingChatTokens(tokens, text)
  if (!shown.length) return null
  return (
    <section className="chat-token-cards" aria-label="Stock Tokens">
      {shown.map((token) => (
        <Link key={token.symbol} href={`/stock/${token.symbol}` as Route} className="chat-token-card">
          <TokenLogo symbol={token.symbol} size={34} />
          <span className="chat-token-name">
            <strong>{token.symbol}</strong>
            <span>{token.name}</span>
          </span>
          <span className="chat-token-price">
            {token.price === null
              ? 'View token'
              : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(token.price)}
            <small>
              {token.at
                ? `Logged ${new Date(token.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Explore'}
            </small>
          </span>
          <ArrowUpRight className="chat-token-arrow size-3.5" aria-hidden="true" />
        </Link>
      ))}
    </section>
  )
}
