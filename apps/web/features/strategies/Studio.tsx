'use client'

import { money, type Preset, studioCopy } from '@desk/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import type { CopyQuote } from '@/app/copy-actions'
import { AllocationDonut } from '@/components/ui/allocation-donut'
import { Stepper } from '@/components/ui/stepper'
import { TokenStack } from '@/components/ui/token-logo'
import { CopyFinish } from '@/features/copy/CopyFinish'
import { cn } from '@/lib/utils'
import { type Created, CreateStep } from './CreateStep'
import { type DraftToken, draftToMandate, draftTotalBps, mandateKey, type StudioDraft } from './draft'
import { FirstSteps } from './FirstSteps'
import { MeetAgent } from './MeetAgent'
import { amountProblem, MoneyStep, useUsdgBalance } from './MoneyStep'
import { ReadStep, useTestRead } from './ReadStep'
import { mixSlices, type Performance } from './StrategyCard'
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
  performance,
  copyOf = null,
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
  performance: Record<string, Performance>
  /** Set when this agent is being made to copy another: after creating it, the fee and the link come first. */
  copyOf?: CopyQuote | null
}) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(1)
  // Which way the step content slides: forward from the right, back from the left.
  const [dir, setDir] = useState(1)
  const [problem, setProblem] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [createdAs, setCreatedAs] = useState({ name: '', perAction: '0', daily: '0' })
  const { read, run } = useTestRead()
  const balance = useUsdgBalance(signedIn)

  const result = useMemo(() => draftToMandate(draft, tokens), [draft, tokens])
  const mandate = result.ok ? result.mandate : null
  const key = useMemo(() => (mandate ? mandateKey(mandate) : null), [mandate])
  const heard = read.status === 'heard' && read.key === key
  // An unnamed desk takes its strategy's name: "The giants" reads better than "Unnamed desk".
  const name = draft.name.trim() || presets.find((p) => p.id === draft.preset)?.name || SIDE.unnamed

  const advance = () => {
    if (step === 1 && draftTotalBps(draft) !== 10_000) return setProblem(S.identity.mustAddUp)
    const short = step === 2 ? amountProblem(draft.amount, balance) : null
    if (short) return setProblem(short)
    if (step === 3 && !result.ok) return setProblem(`${result.problems.join('. ')}.`)
    setProblem(null)
    setDir(1)
    setStep((s) => Math.min(4, s + 1))
  }
  const goBack = (to: number) => {
    setProblem(null)
    setDir(-1)
    setStep(to)
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
      <>
        {copyOf && <CopyFinish quote={copyOf} followerDeskId={created.deskId} followerSlug={created.slug} />}
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
      </>
    )
  }

  const preset = presets.find((p) => p.id === draft.preset)
  const slices = mixSlices(draft.weights, draft.cashBps, tokens)
  const symbols = slices.filter((x) => x.symbol !== 'CASH').map((x) => x.symbol)

  return (
    <section className="agent-builder" aria-label={S.studioTitle}>
      <div className="agent-builder-heading">
        <div>
          <p className="strat-micro text-vermilion">{S.studioKicker}</p>
          <h2 className="strat-h2 mt-2 text-ink">{S.studioTitle}</h2>
        </div>
        <p className="strat-choice-body">{S.studioBody}</p>
      </div>

      <Stepper steps={S.steps} current={step} onBack={goBack} label={S.stepsAria} counter={S.counter} />

      <div className="agent-builder-grid">
        <div className="agent-builder-panel">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduced ? false : { opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3 className="strat-choice-title mb-5 text-ink">{S.steps[step - 1]}</h3>
              {step === 1 && (
                <BasketStep
                  draft={draft}
                  setDraft={setDraft}
                  presets={presets}
                  tokens={tokens}
                  performance={performance}
                />
              )}
              {step === 2 && (
                <MoneyStep
                  draft={draft}
                  setDraft={setDraft}
                  tokens={tokens}
                  signedIn={signedIn}
                  balance={balance}
                />
              )}
              {step === 3 && <LimitsStep draft={draft} setDraft={setDraft} tokens={tokens} />}
              {step === 4 && (
                <MeetAgent
                  amount={draft.amount && draft.amount !== '0' ? money(draft.amount) : null}
                  basket={preset?.name ?? SIDE.own.toLowerCase()}
                  perAction={mandate ? money(formatUnits(mandate.perActionCapUsdg, 6)) : '—'}
                  daily={mandate ? money(formatUnits(mandate.dailyCapUsdg, 6)) : '—'}
                />
              )}
              {step === 4 && (
                <div className="mb-6">
                  <ReadStep
                    read={read}
                    currentKey={key}
                    signedIn={Boolean(signedIn)}
                    onRun={() => mandate && key && run(mandate, key)}
                  />
                </div>
              )}
              {step === 4 && mandate && (
                <CreateStep
                  amount={draft.amount ?? '0'}
                  name={name}
                  mandate={mandate}
                  signedIn={signedIn}
                  disclosureOn={disclosureOn}
                  readRequestId={heard && read.status === 'heard' ? read.requestId : null}
                  onCreated={onCreated}
                />
              )}
            </motion.div>
          </AnimatePresence>
          {problem && (
            <p className="agent-form-error" role="alert">
              {problem}
            </p>
          )}
          <div className="agent-builder-actions">
            {step > 1 ? (
              <button type="button" className="strat-sensei" onClick={() => goBack(step - 1)}>
                {S.back}
              </button>
            ) : (
              <span />
            )}
            {step < 4 && (
              <button type="button" onClick={advance} className="strat-confirm strat-confirm--live">
                {S.next}
              </button>
            )}
          </div>
        </div>

        <aside className="strat-preview agent-builder-preview">
          <p className="strat-micro text-ink-muted">{SIDE.kicker}</p>
          <h3 className="strat-choice-title mt-3 break-words text-ink">{name}</h3>
          <p className="strat-mono-11 mt-1 text-ink-muted">{preset?.name ?? SIDE.own}</p>
          <p className="mt-2 font-semibold text-[14px] text-ink">
            {draft.amount && draft.amount !== '0' ? S.money.side(money(draft.amount)) : S.money.sideNone}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <AllocationDonut slices={slices} size={72} thickness={9} />
            <div className="min-w-0">
              {symbols.length > 0 ? (
                <TokenStack symbols={symbols} size={24} max={5} />
              ) : (
                <span className="text-[12px] text-muted-foreground">{SIDE.onlyCash}</span>
              )}
              <p className="mt-2 text-[12px] text-muted-foreground">
                {SIDE.split(symbols.length, Math.round(draft.cashBps / 100))}
              </p>
            </div>
          </div>
          {mandate && (
            <p className="mt-4 rounded-[var(--radius-md)] border border-border bg-[var(--color-surface-2)] p-3 text-[12.5px] text-foreground/85">
              {SIDE.sentence(
                money(formatUnits(mandate.perActionCapUsdg, 6)),
                money(formatUnits(mandate.dailyCapUsdg, 6)),
              )}
            </p>
          )}
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
