'use client'

import { deskCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ShijimaMark } from '@/components/shell'
import { cn } from '@/lib/utils'
import { ChatChart } from './ChatChart'
import type { ChatTurn } from './chat-model'
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
}: {
  deskId: string
  slug: string
  initial: ChatTurn[]
  /** A question brought from elsewhere, such as "Ask about this" on a chart. Typed in, never sent for them. */
  prefill?: string | undefined
}) {
  const router = useRouter()
  const [turns, setTurns] = useState(initial)
  const [input, setInput] = useState(prefill.slice(0, 500))
  const [typingId, setTypingId] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const busy = turns.some((t) => t.status === 'pending' || t.status === 'claimed')

  const toBottom = useCallback(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the thread grows
  useEffect(toBottom, [turns.length, busy])

  const replace = (id: string, next: ChatTurn) => setTurns((all) => all.map((t) => (t.id === id ? next : t)))

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
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
  }

  return (
    <section className="desk-chat" aria-label={deskCopy.chat.title}>
      <header className="desk-chat-head">
        <span className="type-label-micro text-ink-muted">{deskCopy.chat.eyebrow}</span>
        <p className="type-caption text-ink-secondary">{deskCopy.chat.intro}</p>
      </header>

      <div ref={scroller} className="sensei-drawer-msgs desk-chat-msgs">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            <div className="sd-row user">
              <div className="sd-msg user">{turn.question}</div>
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
                <Cites ids={turn.cites} slug={slug} />
                {turn.chart && <ChatChart symbol={turn.chart.symbol} days={turn.chart.days} />}
                {turn.card && <ProposalCard card={turn.card} />}
              </div>
            )}
          </div>
        ))}
        {turns.length === 0 && (
          <div className="sensei-drawer-starters desk-chat-starters">
            {deskCopy.chat.starters.map((starter) => (
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
      </div>

      {problem && <p className="px-4 pb-2 text-loss type-caption">{problem}</p>}
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
          placeholder={deskCopy.chat.placeholder}
          aria-label={deskCopy.chat.placeholder}
        />
        <button type="submit" disabled={busy || !input.trim()} data-cursor="hover">
          {deskCopy.chat.send}
        </button>
      </form>
      <p className="px-4 pb-3 type-caption text-ink-muted">{deskCopy.chat.notAdvice}</p>
    </section>
  )
}
