'use client'

import type { Mandate } from '@desk/shared'
import { studioCopy } from '@desk/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatTurn } from '@/features/desk/chat-model'
import { mandateJson } from './draft'

const R = studioCopy.read
const POLL_MS = 1500
const GIVE_UP_MS = 90_000

export type TestRead =
  | { status: 'idle' }
  | { status: 'reading'; key: string }
  | { status: 'heard'; key: string; requestId: string; text: string; unclear: string[] }
  | { status: 'failed'; key: string; text: string }

/** Splits the desk's reply into its restatement and the bullet list of what it found unclear. */
function split(reply: string): { text: string; unclear: string[] } {
  const [head, ...rest] = reply.split('\n\n')
  const bullets = rest
    .join('\n')
    .split('\n')
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter(Boolean)
  return { text: head ?? '', unclear: bullets }
}

/**
 * The studio's test read (design brief 8.7): the draft goes to the worker as a `readback` request, the worker
 * makes one model call, and the page polls for the answer, exactly as the chat does. Nothing is saved or signed.
 */
export function useTestRead() {
  const [read, setRead] = useState<TestRead>({ status: 'idle' })
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(async (mandate: Mandate, key: string) => {
    setRead({ status: 'reading', key })
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'readback', payload: { mandate: mandateJson(mandate) } }),
      })
      const body = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !body.id) throw new Error(body.error ?? R.failed)
      const started = Date.now()
      while (alive.current && Date.now() - started < GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        const poll = await fetch(`/api/ask/${body.id}`, { cache: 'no-store' })
        if (!poll.ok) continue
        const { turn } = (await poll.json()) as { turn: ChatTurn }
        if (turn.status === 'failed') throw new Error(turn.error ?? R.failed)
        if (turn.status === 'answered') {
          if (turn.promptVersion && turn.reply) {
            setRead({ status: 'heard', key, requestId: turn.id, ...split(turn.reply) })
          } else {
            setRead({ status: 'failed', key, text: turn.refused ?? turn.reply ?? R.failed })
          }
          return
        }
      }
      throw new Error(R.failed)
    } catch (e) {
      if (alive.current) setRead({ status: 'failed', key, text: e instanceof Error ? e.message : R.failed })
    }
  }, [])

  return { read, run }
}

/** Step 3: hear the draft read back, and see what the desk found unclear. */
export function ReadStep({
  read,
  currentKey,
  signedIn,
  onRun,
}: {
  read: TestRead
  currentKey: string | null
  signedIn: boolean
  onRun: () => void
}) {
  const stale = read.status !== 'idle' && read.status !== 'reading' && read.key !== currentKey
  return (
    <div className="space-y-5">
      <p className="strat-choice-body">{R.body}</p>
      {signedIn ? (
        <button
          type="button"
          className="strat-sensei"
          onClick={onRun}
          disabled={read.status === 'reading' || !currentKey}
          data-cursor="hover"
        >
          {read.status === 'reading' ? R.reading : read.status === 'idle' ? `${R.run} →` : `${R.again} →`}
        </button>
      ) : (
        <p className="type-caption text-warning">{R.signIn}</p>
      )}

      {read.status === 'heard' && (
        <div className="strat-dry" aria-live="polite">
          <span className="strat-micro text-vermilion">{R.heard}</span>
          <p className="studio-read mt-2">{read.text}</p>
          {read.unclear.length > 0 && (
            <>
              <div className="strat-micro mt-4 text-ink-muted">{R.unclear}</div>
              <ul className="studio-read-list">
                {read.unclear.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
          {stale && <p className="type-caption mt-3 text-warning">{R.edited}</p>}
        </div>
      )}
      {read.status === 'failed' && (
        <div className="strat-dry" aria-live="polite">
          <p className="strat-mono-11 leading-relaxed text-ink-secondary">{read.text}</p>
        </div>
      )}
      {read.status !== 'heard' && <p className="strat-mono-11 text-ink-muted">{R.skipped}</p>}
    </div>
  )
}
