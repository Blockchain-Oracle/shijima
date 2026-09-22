'use client'

import { money, type Preset, percent, studioCopy } from '@desk/shared'
import { useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { cn } from '@/lib/utils'
import { type Created, CreateStep } from './CreateStep'
import { type DraftToken, draftToMandate, draftTotalBps, mandateKey, type StudioDraft } from './draft'
import { FirstSteps } from './FirstSteps'
import { ReadStep, useTestRead } from './ReadStep'
import { BasketStep, LimitsStep } from './StudioFields'

const S = studioCopy
const SIDE = studioCopy.side

/**
 * Masayume's creator studio (Agari `CreatorStudio.tsx`) around our meaning of a strategy: 01 the basket, 02 how
 * strict and the limits, 03 the test read, 04 create. The side card is the desk card, and it follows every edit.
 * Drafting is open to anyone; the test read needs a sign-in, and creating needs the wallet.
 */
export function Studio({
  draft,
  setDraft,
  resetDraft,
  presets,
  tokens,
  signedIn,
  disclosureOn,
  contractVersion,
  goLiveChecks,
}: {
  draft: StudioDraft
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void
  resetDraft: () => void
  presets: Preset[]
  tokens: DraftToken[]
  signedIn: string | null
  disclosureOn: string | null
  contractVersion: string
  goLiveChecks: number
}) {
  const [step, setStep] = useState(1)
  const [problem, setProblem] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [createdAs, setCreatedAs] = useState({ name: '', perAction: '0', daily: '0' })
  const { read, run } = useTestRead()

  const result = useMemo(() => draftToMandate(draft, tokens), [draft, tokens])
  const mandate = result.ok ? result.mandate : null
  const key = useMemo(() => (mandate ? mandateKey(mandate) : null), [mandate])
  const heard = read.status === 'heard' && read.key === key
  const name = draft.name.trim() || SIDE.unnamed

  const advance = () => {
    if (step === 1 && draftTotalBps(draft) !== 10_000) return setProblem(S.identity.mustAddUp)
    if (step === 2 && !result.ok) return setProblem(`${result.problems.join('. ')}.`)
    setProblem(null)
    setStep((s) => Math.min(4, s + 1))
  }

  const onCreated = useCallback(
    (c: Created) => {
      // Kept before the draft is cleared: the first steps describe the desk as it was created.
      setCreatedAs({
        name,
        perAction: mandate?.perActionCapUsdg.toString() ?? '0',
        daily: mandate?.dailyCapUsdg.toString() ?? '0',
      })
      setCreated(c)
      resetDraft()
    },
    [name, mandate, resetDraft],
  )

  if (created && signedIn) {
    return (
      <FirstSteps
        created={created}
        name={createdAs.name}
        owner={signedIn}
        contractVersion={contractVersion}
        perActionUsdg={createdAs.perAction}
        dailyUsdg={createdAs.daily}
        goLiveChecks={goLiveChecks}
        onAnother={() => {
          setCreated(null)
          setStep(1)
        }}
      />
    )
  }

  const preset = presets.find((p) => p.id === draft.preset)
  const held = tokens.filter((t) => (draft.weights[t.symbol] ?? 0) > 0)

  return (
    <section className="agent-builder" aria-label={S.studioTitle}>
      <div className="agent-builder-heading">
        <div>
          <p className="strat-micro text-vermilion">{S.studioKicker}</p>
          <h2 className="strat-h2 mt-2 text-ink">{S.studioTitle}</h2>
        </div>
        <p className="strat-choice-body">{S.studioBody}</p>
      </div>

      <ol className="agent-steps" aria-label={S.stepsAria}>
        {S.steps.map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
            <button
              type="button"
              disabled={index + 1 >= step}
              onClick={() => {
                if (index + 1 < step) {
                  setProblem(null)
                  setStep(index + 1)
                }
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="agent-builder-grid">
        <div className="agent-builder-panel">
          <h3 className="strat-choice-title mb-5 text-ink">{S.steps[step - 1]}</h3>
          {step === 1 && <BasketStep draft={draft} setDraft={setDraft} presets={presets} tokens={tokens} />}
          {step === 2 && <LimitsStep draft={draft} setDraft={setDraft} tokens={tokens} />}
          {step === 3 && (
            <ReadStep
              read={read}
              currentKey={key}
              signedIn={Boolean(signedIn)}
              onRun={() => mandate && key && run(mandate, key)}
            />
          )}
          {step === 4 && mandate && (
            <CreateStep
              name={name}
              mandate={mandate}
              signedIn={signedIn}
              disclosureOn={disclosureOn}
              readRequestId={heard && read.status === 'heard' ? read.requestId : null}
              onCreated={onCreated}
            />
          )}
          {problem && (
            <p className="agent-form-error" role="alert">
              {problem}
            </p>
          )}
          <div className="agent-builder-actions">
            {step > 1 ? (
              <button
                type="button"
                className="strat-sensei"
                onClick={() => {
                  setProblem(null)
                  setStep((s) => s - 1)
                }}
              >
                {S.back}
              </button>
            ) : (
              <span />
            )}
            {step < 4 && (
              <button type="button" onClick={advance} className="strat-confirm strat-confirm--live">
                {step === 3 && !heard ? S.nextWithoutRead : S.next}
              </button>
            )}
          </div>
        </div>

        <aside className="strat-preview agent-builder-preview">
          <p className="strat-micro text-ink-muted">{SIDE.kicker}</p>
          <h3 className="strat-choice-title mt-3 break-words text-ink">{name}</h3>
          <p className="strat-mono-11 mt-1 text-ink-muted">{preset?.name ?? SIDE.own}</p>
          <div className="studio-bar" aria-hidden>
            {held.map((t, i) => (
              <span
                key={t.symbol}
                style={{
                  width: `${(draft.weights[t.symbol] ?? 0) / 100}%`,
                  background: `color-mix(in srgb, var(--color-vermilion) ${90 - i * 8}%, var(--bg))`,
                }}
              />
            ))}
          </div>
          <div className="studio-weights">
            {held.map((t) => (
              <span key={t.symbol}>
                {t.symbol} <b>{percent(draft.weights[t.symbol] ?? 0)}</b>
              </span>
            ))}
            <span>
              {SIDE.cash} <b>{percent(draft.cashBps)}</b>
            </span>
          </div>
          <dl className="agent-preview-facts">
            <div>
              <dt>{SIDE.perAction}</dt>
              <dd>{mandate ? money(formatUnits(mandate.perActionCapUsdg, 6)) : '—'}</dd>
            </div>
            <div>
              <dt>{SIDE.daily}</dt>
              <dd>{mandate ? money(formatUnits(mandate.dailyCapUsdg, 6)) : '—'}</dd>
            </div>
            <div>
              <dt>{SIDE.mode}</dt>
              <dd>{SIDE.modeValue}</dd>
            </div>
            <div>
              <dt>{SIDE.read}</dt>
              <dd className={cn(heard && 'text-gain')}>
                {heard ? SIDE.readDone : read.status === 'heard' ? SIDE.readStale : SIDE.readNone}
              </dd>
            </div>
          </dl>
          <p className="strat-choice-body">{SIDE.approach}</p>
        </aside>
      </div>
    </section>
  )
}
