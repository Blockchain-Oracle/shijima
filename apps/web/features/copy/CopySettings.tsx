'use client'

import { appCopy, settingsCopy } from '@desk/shared'
import { CircleAlert, CircleCheck, Users } from 'lucide-react'
import { useEffect, useId, useState, useTransition } from 'react'
import { followersAction, setCopyableAction } from '@/app/copy-actions'
import { Switch } from '@/components/ui/switch'

const c = appCopy.copy.settings
const g = settingsCopy.sharing

/** Shijima's share of each copy fee, as copy-actions' PLATFORM_BPS charges it: 20%. The creator keeps 80%. */
const SHIJIMA_PCT = 20
const CREATOR_PCT = 100 - SHIJIMA_PCT

const dollars = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd = (raw: string) => dollars(Number(raw) / 1e6)

type Follower = Awaited<ReturnType<typeof followersAction>>[number]
type Outcome = { saved: true; on: boolean; fee: number } | { saved: false; why: string } | null

/**
 * Step 2, the creator's side of copy trading, kept apart from the link so the two never read as one switch. After
 * 21st's Feature Toggle Switch Cards (22208) for the card and its on state, and Receipt Pricing (26309) for the fee
 * as a ledger with dot leaders: the fee, then 80% to the creator and 20% to Shijima, in dollars. Public reading
 * is independent of the owner’s explicit permission to copy.
 */
export function CopySettings({
  deskId,
  initial,
}: {
  deskId: string
  initial: { copyable: boolean; feeUsdg: string }
}) {
  const [copyable, setCopyable] = useState(initial.copyable)
  const [fee, setFee] = useState((Number(initial.feeUsdg) / 1e6).toString())
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [followers, setFollowers] = useState<Follower[]>([])
  const [pending, start] = useTransition()
  const switchId = useId()

  useEffect(() => {
    followersAction(deskId)
      .then(setFollowers)
      .catch(() => setFollowers([]))
  }, [deskId])

  const feeNum = Number(fee || 0)
  const feeOk = Number.isFinite(feeNum) && feeNum >= 0 && feeNum <= 5
  const shown = feeOk ? feeNum : 0
  const creatorShare = Math.round(shown * CREATOR_PCT) / 100
  const shijimaShare = Math.round((shown - creatorShare) * 100) / 100

  const save = (next: boolean) =>
    start(async () => {
      const r = await setCopyableAction(deskId, next, feeNum)
      if (r.ok) {
        setCopyable(next)
        setOutcome({ saved: true, on: next, fee: feeNum })
      } else setOutcome({ saved: false, why: r.why ?? appCopy.copy.refused.failed })
    })

  const live = copyable
  const earned = followers.reduce((sum, f) => sum + BigInt(f.feeUsdg), 0n)

  return (
    <section
      className="sh-card sh-card--copy"
      data-on={live ? '' : undefined}
      aria-labelledby="sh-copy-title"
    >
      <header className="sh-head">
        <span className="sh-chip" aria-hidden="true">
          <Users />
        </span>
        <div className="sh-titles">
          <span className="sh-step">{g.step(2)}</span>
          <h3 id="sh-copy-title">{g.copyTitle}</h3>
        </div>
        <span className="sh-pill" data-on={live ? '' : undefined}>
          <i aria-hidden="true" />
          {live ? g.copyOn : g.copyOff}
        </span>
      </header>
      <p className="sh-body">{c.body}</p>

      <div className="sh-toggle">
        <label htmlFor={switchId} className="sh-toggle-text">
          <b>{g.switchLabel}</b>
          <small>{copyable ? c.on : c.off}</small>
        </label>
        <Switch
          id={switchId}
          className="sh-switch"
          checked={copyable}
          onCheckedChange={(v) => save(v)}
          disabled={pending}
        />
      </div>

      <div className="sh-fee">
        <div className="sh-fee-input">
          <label htmlFor={`${switchId}-fee`}>
            <b>{g.feeTitle}</b>
            <small>{g.feeNote}</small>
          </label>
          <div className="sh-fee-row">
            <span className="sh-money">
              <span aria-hidden="true">$</span>
              <input
                id={`${switchId}-fee`}
                inputMode="decimal"
                value={fee}
                aria-invalid={!feeOk || undefined}
                onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </span>
            <button
              type="button"
              className="st-btn st-btn--sm"
              disabled={pending || !feeOk}
              onClick={() => save(copyable)}
            >
              {g.saveFee}
            </button>
          </div>
          {!feeOk && <p className="sh-why">{appCopy.copy.refused.feeRange}</p>}
        </div>

        <div className="sh-ledger">
          <span className="sh-ledger-title">{g.splitTitle}</span>
          <div className="sh-split" aria-hidden="true">
            <i style={{ width: `${CREATOR_PCT}%` }} />
            <i style={{ width: `${SHIJIMA_PCT}%` }} />
          </div>
          <dl>
            <div>
              <dt>
                <i className="sh-dot sh-dot--you" aria-hidden="true" />
                {g.creator} <em>{CREATOR_PCT}%</em>
              </dt>
              <dd>{dollars(creatorShare)}</dd>
            </div>
            <div>
              <dt>
                <i className="sh-dot" aria-hidden="true" />
                {g.shijima} <em>{SHIJIMA_PCT}%</em>
              </dt>
              <dd>{dollars(shijimaShare)}</dd>
            </div>
            <div className="sh-ledger-total">
              <dt>{g.total}</dt>
              <dd>{dollars(shown)}</dd>
            </div>
          </dl>
          {shown === 0 && <small className="sh-ledger-note">{g.free}</small>}
        </div>
      </div>

      <div aria-live="polite">
        {outcome?.saved ? (
          <p className="sh-saved">
            <CircleCheck aria-hidden="true" />
            <span>
              {outcome.on ? (outcome.fee > 0 ? g.savedOn(dollars(outcome.fee)) : g.savedOnFree) : g.savedOff}
            </span>
          </p>
        ) : outcome ? (
          <p className="sh-saved sh-saved--bad" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{outcome.why}</span>
          </p>
        ) : null}
      </div>

      <div className="sh-followers">
        <div className="sh-followers-head">
          <span>{g.followersTitle}</span>
          {followers.length > 0 && (
            <span className="sh-earned">
              {g.earned} <b>{usd(earned.toString())}</b>
            </span>
          )}
        </div>
        {followers.length === 0 ? (
          <p className="sh-empty">{c.noFollowers}</p>
        ) : (
          <ul>
            {followers.map((f) => (
              <li key={`${f.name}-${f.since}`}>
                <span className="sh-avatar" aria-hidden="true">
                  {f.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="sh-follower">
                  <b>{f.name}</b>
                  <small>
                    {g.followerStatus[f.status] ?? f.status} ·{' '}
                    {g.since(new Date(f.since).toLocaleDateString('en-GB', { dateStyle: 'medium' }))}
                  </small>
                </span>
                <span className="sh-follower-fee">{usd(f.feeUsdg)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
