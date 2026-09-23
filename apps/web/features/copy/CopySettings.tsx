'use client'

import { appCopy } from '@desk/shared'
import { useEffect, useState, useTransition } from 'react'
import { followersAction, setCopyableAction } from '@/app/copy-actions'
import { Switch } from '@/components/ui/switch'

const c = appCopy.copy.settings
const usd = (raw: string) => `$${(Number(raw) / 1e6).toFixed(2)}`

type Follower = Awaited<ReturnType<typeof followersAction>>[number]

/**
 * The creator's side of copy trading: open this agent to copying, set the one-time fee ($0 to $5), and see who
 * copies it and what the fees came to. Copying needs the agent's public link on, since that is how others find it.
 */
export function CopySettings({
  deskId,
  initial,
  shared,
}: {
  deskId: string
  initial: { copyable: boolean; feeUsdg: string }
  shared: boolean
}) {
  const [copyable, setCopyable] = useState(initial.copyable)
  const [fee, setFee] = useState((Number(initial.feeUsdg) / 1e6).toString())
  const [state, setState] = useState<'idle' | 'saved' | string>('idle')
  const [followers, setFollowers] = useState<Follower[]>([])
  const [pending, start] = useTransition()

  useEffect(() => {
    followersAction(deskId)
      .then(setFollowers)
      .catch(() => setFollowers([]))
  }, [deskId])

  const save = (next: boolean) =>
    start(async () => {
      const r = await setCopyableAction(deskId, next, Number(fee || 0))
      setState(r.ok ? 'saved' : (r.why ?? appCopy.copy.refused.failed))
      if (r.ok) setCopyable(next)
    })

  const earned = followers.reduce((sum, f) => sum + BigInt(f.feeUsdg), 0n)

  return (
    <div className="copyset">
      <label className="copyset-row">
        <Switch checked={copyable} onCheckedChange={(v) => save(v)} disabled={pending || !shared} />
        <span>{copyable ? c.on : c.off}</span>
      </label>
      {!shared && <p className="copy-muted">{appCopy.copy.refused.missing}</p>}
      <label className="copyset-fee">
        <span>{c.fee}</span>
        <span className="copyset-input">
          $
          <input
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))}
          />
          <button
            type="button"
            className="btn-secondary ov-btn-sm"
            disabled={pending}
            onClick={() => save(copyable)}
          >
            {c.save}
          </button>
        </span>
      </label>
      {state === 'saved' ? (
        <p className="copy-done">{c.saved}</p>
      ) : state !== 'idle' ? (
        <p className="copy-why">{state}</p>
      ) : null}
      <div className="copyset-followers">
        <strong>{c.followers}</strong>
        {followers.length === 0 ? (
          <p className="copy-muted">{c.noFollowers}</p>
        ) : (
          <>
            <ul>
              {followers.map((f) => (
                <li key={`${f.name}-${f.since}`}>
                  <span>{f.name}</span>
                  <small>
                    {f.status} · {usd(f.feeUsdg)}
                  </small>
                </li>
              ))}
            </ul>
            <p className="copy-muted">{c.earned(usd(earned.toString()))}</p>
          </>
        )}
      </div>
    </div>
  )
}
