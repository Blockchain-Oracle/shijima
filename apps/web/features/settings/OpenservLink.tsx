'use client'

import { settingsCopy } from '@desk/shared'
import { useState, useTransition } from 'react'
import { openservCodeAction, openservUnlinkAction } from '@/app/owner-actions'

const W = settingsCopy.connections.workspace

/**
 * Link an OpenServ workspace to this desk: make a one-time code, send "link <code>" to Shijima in the workspace,
 * and its chat and tasks reach this desk's agent from then on. The same idea as the Telegram code.
 */
export function OpenservLink({ deskId, linked }: { deskId: string; linked: number }) {
  const [code, setCode] = useState<string | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [count, setCount] = useState(linked)
  const [pending, start] = useTransition()
  const line = code ? `link ${code}` : ''
  return (
    <div className="flex flex-col gap-2">
      <p className="type-caption text-ink-secondary">{W.intro}</p>
      {count > 0 ? (
        <p className="type-caption text-gain">
          {W.linked(count)}{' '}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() =>
              start(async () => {
                const r = await openservUnlinkAction(deskId)
                if (r.ok) setCount(0)
              })
            }
          >
            {W.unlink}
          </button>
        </p>
      ) : null}
      {code ? (
        <>
          <span className="type-caption text-ink-muted">{W.send}</span>
          <div className="flex items-center gap-2">
            <code className="rounded-md border border-hairline px-3 py-2 font-[family-name:var(--font-data)] text-ink">
              {line}
            </code>
            <button
              type="button"
              className="type-caption text-accent"
              onClick={() => {
                void navigator.clipboard?.writeText(line).then(() => setCopied(true))
              }}
            >
              {copied ? W.copied : W.copy}
            </button>
          </div>
          <span className="type-caption text-ink-muted">{W.expires}</span>
        </>
      ) : (
        <button
          type="button"
          className="connection-link self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setWhy(null)
              const r = await openservCodeAction(deskId)
              if (r.ok) setCode(r.code)
              else setWhy(r.why)
            })
          }
        >
          {pending ? W.making : W.make}
        </button>
      )}
      {why ? <p className="type-caption text-loss">{why}</p> : null}
    </div>
  )
}
