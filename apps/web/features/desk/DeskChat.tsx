'use client'

import { deskCopy } from '@desk/shared'
import { ArrowUp, UserRound } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ShijimaMark } from '@/components/shell'
import { SignInButton } from '@/components/shell/SignInButton'
import { cn } from '@/lib/utils'
import { ChatChart } from './ChatChart'
import { ChatTokens, useChatTokens } from './ChatTokens'
import type { ChatTurn } from './chat-model'
import { matchingChatTokens } from './chat-tokens'
import { ProposalCard } from './ProposalCard'
import { Typewriter } from './Typewriter'

const POLL_MS = 700
const SLOW_MS = 15_000
const GIVE_UP_MS = 75_000

function citeLabel(id: string): string | null {
  const c = deskCopy.chat.cite
  if (/^d\d+$/.test(id)) return c.record(id.slice(1))
  if (/^a\d+$/.test(id)) return c.approval
  if (/^w\d+$/.test(id)) return c.wait
  if (/^r\d+$/.test(id)) return c.note(id.slice(1))
  if (id.startsWith('p-')) return c.price(id.slice(2))
  return null
}

function Cites({ ids, slug }: { ids: string[]; slug: string }) {
  const shown = ids.flatMap((id) => {
    const label = citeLabel(id)
    return label ? [{ id, label }] : []
  })
  if (shown.length === 0) return null
  return (
    <p className="desk-cites type-caption text-ink-muted">
      {deskCopy.chat.relies}:{' '}
      {shown.map((c, i) => (
        <span key={c.id}>
          {i > 0 ? ', ' : ''}
          {/^d\d+$/.test(c.id) ? (
            <Link
              href={`/agents/${slug}/decision/${c.id.slice(1)}` as Route}
              className="underline-offset-2 hover:underline"
            >
              {c.label}
            </Link>
          ) : (
            c.label
          )}
        </span>
      ))}
    </p>
  )
}

/**
 * The desk's chat, the main way in. Masayume's Sensei thread (the bubbles, the dots, the typewriter, the
 * starters) as a full-height panel, on a brain that can propose. A message is written as a row for the worker,
 * which holds the model key; this page polls for the answer.
 */
export function DeskChat({
  deskId,
  slug,
  initial,
  prefill = '',
  signedIn = true,
}: {
  deskId?: string | undefined
  slug?: string | undefined
  initial: ChatTurn[]
  signedIn?: boolean
  /** A question brought from elsewhere, such as "Ask about this" on a chart. Typed in, never sent for them. */
  prefill?: string | undefined
}) {
  const router = useRouter()
  const { data: tokens = [], isError: tokensFailed, isPending: tokensLoading } = useChatTokens()
  const [turns, setTurns] = useState(initial)
  const [input, setInput] = useState(prefill.slice(0, 500))
  const [typingId, setTypingId] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const sending = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const busy = turns.some((t) => t.status === 'pending' || t.status === 'claimed')

  const toBottom = useCallback(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the thread grows
  useEffect(toBottom, [turns.length, busy])

  const replace = (id: string, next: ChatTurn) => setTurns((all) => all.map((t) => (t.id === id ? next : t)))

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy || sending.current) return
    if (!signedIn) {
      const found = matchingChatTokens(tokens, question)
      const reply = found.length
        ? `Explore ${found.map((t) => t.name).join(', ')} below. Sign in to ask AI about their prices and strategies.`
        : /agent|start|strategy|practice/i.test(question)
          ? 'Choose a strategy, then start an agent in practice mode to see its decisions before putting money in. Sign in to ask AI about your setup.'
          : 'You can explore Stock Tokens and strategies before signing in. Enter a token symbol or company name, or sign in for AI answers.'
      setTurns((all) => [
        ...all,
        {
          id: crypto.randomUUID(),
          question,
          reply,
          status: 'answered',
          cites: [],
          chart: null,
          card: null,
          refused: null,
          error: null,
          at: new Date().toISOString(),
          promptVersion: null,
        },
      ])
      return
    }
    sending.current = true
    try {
      setProblem(null)
      setSlow(false)
      const tempId = `pending-${Date.now()}`
      const placeholder: ChatTurn = {
        id: tempId,
        question,
        status: 'pending',
        reply: null,
        refused: null,
        cites: [],
        chart: null,
        error: null,
        card: null,
        at: new Date().toISOString(),
        promptVersion: null,
      }
      setTurns((all) => [...all, placeholder])
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, deskId }),
      }).catch(() => null)
      const body = (await res?.json().catch(() => null)) as { id?: string; error?: string } | null
      if (!res?.ok || !body?.id) {
        setTurns((all) => all.filter((t) => t.id !== tempId))
        setProblem(body?.error ?? deskCopy.chat.failed)
        setInput(question)
        return
      }
      const id = body.id
      replace(tempId, { ...placeholder, id })
      const started = Date.now()
      while (Date.now() - started < GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        if (!alive.current) return
        if (Date.now() - started > SLOW_MS) setSlow(true)
        const poll = await fetch(`/api/ask/${id}`, { cache: 'no-store' }).catch(() => null)
        if (!poll?.ok) continue
        const { turn } = (await poll.json()) as { turn: ChatTurn }
        if (turn.status === 'answered' || turn.status === 'failed') {
          setSlow(false)
          setTypingId(turn.status === 'answered' ? turn.id : null)
          replace(id, turn)
          return
        }
      }
      setSlow(false)
      replace(id, { ...placeholder, id, status: 'failed', error: deskCopy.chat.failed })
    } finally {
      sending.current = false
    }
  }

  return (
    <section className="desk-chat" aria-label={deskCopy.chat.title}>
      {deskId && (
        <header className="desk-chat-head">
          <span className="type-label-micro text-ink-muted">{deskCopy.chat.eyebrow}</span>
          <p className="type-caption text-ink-secondary">{deskCopy.chat.intro}</p>
        </header>
      )}

      <div ref={scroller} className="sensei-drawer-msgs desk-chat-msgs">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            <div className="sd-row user">
              <div className="sd-msg user">{turn.question}</div>
              <span className="sd-ava chat-user-avatar" aria-hidden="true">
                <UserRound className="size-3.5" />
              </span>
            </div>
            {turn.status === 'pending' || turn.status === 'claimed' ? (
              <div className="sd-row assistant">
                <span className="sd-ava" aria-hidden>
                  <ShijimaMark />
                </span>
                <div className="sd-msg assistant">
                  <span className="sensei-dots" role="status" aria-label={deskCopy.chat.thinking}>
                    <i />
                    <i />
                    <i />
                  </span>
                  {slow && (
                    <span className="mt-1 block type-caption text-ink-muted">{deskCopy.chat.slow}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="sd-row assistant">
                <span className="sd-ava" aria-hidden>
                  <ShijimaMark />
                </span>
                <div className={cn('sd-msg assistant', turn.status === 'failed' && 'is-failed')}>
                  {turn.status === 'failed' ? (
                    (turn.error ?? deskCopy.chat.failed)
                  ) : typingId === turn.id && turn.reply ? (
                    <Typewriter text={turn.reply} onDone={() => setTypingId(null)} onType={toBottom} />
                  ) : (
                    turn.reply
                  )}
                  {turn.refused && turn.refused !== turn.reply && typingId !== turn.id && (
                    <span className="mt-2 block text-warning type-caption">{turn.refused}</span>
                  )}
                </div>
              </div>
            )}
            {turn.status === 'answered' && typingId !== turn.id && (
              <div className="desk-chat-extras">
                {slug && <Cites ids={turn.cites} slug={slug} />}
                <ChatTokens
                  tokens={tokens}
                  text={`${turn.question} ${turn.reply ?? ''} ${turn.chart?.symbol ?? ''} ${turn.cites.join(' ').replaceAll('p-', '')}`}
                />
                {turn.chart && <ChatChart symbol={turn.chart.symbol} days={turn.chart.days} />}
                {turn.card && <ProposalCard card={turn.card} />}
              </div>
            )}
          </div>
        ))}
        {turns.length === 0 && (
          <div className="sensei-drawer-starters desk-chat-starters">
            {!deskId && (
              <div className="chat-welcome">
                <span className="chat-welcome-avatar logo-mark" aria-hidden="true">
                  <ShijimaMark />
                </span>
                <h3>What shall we explore?</h3>
                <p>
                  {signedIn
                    ? 'Ask about a Stock Token, compare strategies, or work through your first agent.'
                    : 'Explore tokens here. Sign in when you’re ready for AI answers.'}
                </p>
                <ChatTokens tokens={tokens} />
                {tokensLoading && <p role="status">Loading Stock Tokens…</p>}
                {tokensFailed && <p role="status">Tokens couldn’t load. You can still browse Markets.</p>}
              </div>
            )}
            {(deskId
              ? deskCopy.chat.starters
              : ['Show me NVDA', 'How do I start an agent?', 'Compare strategies']
            ).map((starter) => (
              <button
                key={starter}
                type="button"
                className="sd-starter"
                onClick={() => void send(starter)}
                data-cursor="hover"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
        {!deskId && (
          <div className="chat-next-actions">
            <Link href={'/strategies' as Route}>Explore strategies</Link>
            <Link href={'/agents/new' as Route}>
              Start an agent <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </div>

      {problem && (
        <p className="px-4 pb-2 text-loss type-caption" role="alert">
          {problem}
        </p>
      )}
      {!signedIn && (
        <div className="chat-signin">
          <SignInButton label="Sign in for AI answers" className="btn btn-primary w-full" />
        </div>
      )}
      {input.trim() && (
        <div className="chat-composer-preview">
          <ChatTokens tokens={tokens} text={input} />
        </div>
      )}
      <form
        className="sensei-drawer-input"
        onSubmit={(event) => {
          event.preventDefault()
          const text = input
          setInput('')
          void send(text).then(() => router.refresh())
        }}
      >
        <input
          value={input}
          maxLength={1000}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            !signedIn
              ? 'Find a token or explore Shijima…'
              : deskId
                ? deskCopy.chat.placeholder
                : 'Ask about tokens or your first agent…'
          }
          aria-label="Message Shijima"
          disabled={busy}
          type="text"
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !input.trim()} data-cursor="hover" aria-label="Send message">
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      </form>
      <p className="px-4 pb-3 type-caption text-ink-muted">{deskCopy.chat.notAdvice}</p>
    </section>
  )
}
