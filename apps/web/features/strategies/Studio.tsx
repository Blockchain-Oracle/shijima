'use client'

import { money, type Preset, studioCopy } from '@desk/shared'
import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import type { CopyQuote } from '@/app/copy-actions'
import { AllocationDonut } from '@/components/ui/allocation-donut'
import { TokenStack } from '@/components/ui/token-logo'
import { CopyFinish } from '@/features/copy/CopyFinish'
import { type Created, CreateStep } from './CreateStep'
import { type DraftToken, draftToMandate, draftTotalBps, type StudioDraft } from './draft'
import { FirstSteps } from './FirstSteps'
import { amountProblem, MoneyStep, useUsdgBalance } from './MoneyStep'
import { mixSlices, type Performance } from './StrategyCard'
import { StrategyStep } from './StrategyStep'
import { LimitsStep } from './StudioFields'

const S = studioCopy
const SIDE = studioCopy.side
const F = studioCopy.flow

/**
 * Creating an agent: Strategy, Amount, Limits, Review, one decision per screen, with a slim summary beside it
 * that follows every edit. Drafting is open to anyone; creating needs a signed-in wallet.
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
  const balance = useUsdgBalance(signedIn)

  const result = useMemo(() => draftToMandate(draft, tokens), [draft, tokens])
  const mandate = result.ok ? result.mandate : null
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
  const amountText = draft.amount && draft.amount !== '0' ? money(draft.amount) : F.practiceOn
  const limitsText = mandate
    ? F.limitsValue(
        money(formatUnits(mandate.perActionCapUsdg, 6)),
        money(formatUnits(mandate.dailyCapUsdg, 6)),
      )
    : '—'

  return (
    <section className="na-flow" aria-label={S.newTitle}>
      <ol className="na-steps" aria-label={S.stepsAria}>
        {S.steps.map((label, i) => {
          const n = i + 1
          const state = n < step ? 'done' : n === step ? 'now' : 'next'
          return (
            <li key={label} data-state={state}>
              <button type="button" disabled={n >= step} onClick={() => goBack(n)}>
                <span className="na-step-num">{state === 'done' ? <Check className="size-3.5" /> : n}</span>
                <span className="na-step-label">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="na-grid">
        <div className="na-card">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduced ? false : { opacity: 0, x: dir * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -20 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="na-card-title">
                {step === 2
                  ? F.amountTitle
                  : step === 3
                    ? F.limitsTitle
                    : step === 4
                      ? F.reviewTitle
                      : F.pickTitle}
              </h2>
              {step === 1 && (
                <StrategyStep
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
                <div className="na-stack">
                  <label className="na-name">
                    <span className="na-label">{F.name}</span>
                    <input
                      value={draft.name}
                      maxLength={40}
                      placeholder={name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </label>
                  <dl className="na-summary">
                    <div>
                      <dt>{F.strategy}</dt>
                      <dd>
                        <TokenStack symbols={symbols} size={20} max={4} />
                        {preset?.name ?? SIDE.own}
                      </dd>
                      <button type="button" onClick={() => goBack(1)}>
                        {F.edit}
                      </button>
                    </div>
                    <div>
                      <dt>{F.amount}</dt>
                      <dd>{amountText}</dd>
                      <button type="button" onClick={() => goBack(2)}>
                        {F.edit}
                      </button>
                    </div>
                    <div>
                      <dt>{F.limits}</dt>
                      <dd>{limitsText}</dd>
                      <button type="button" onClick={() => goBack(3)}>
                        {F.edit}
                      </button>
                    </div>
                  </dl>
                  {mandate && (
                    <CreateStep
                      amount={draft.amount ?? '0'}
                      name={name}
                      mandate={mandate}
                      signedIn={signedIn}
                      disclosureOn={disclosureOn}
                      readRequestId={null}
                      onCreated={onCreated}
                    />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {problem && (
            <p className="agent-form-error" role="alert">
              {problem}
            </p>
          )}
          {step < 4 && (
            <div className="na-actions">
              {step > 1 ? (
                <button type="button" className="st-btn" onClick={() => goBack(step - 1)}>
                  {S.back}
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={advance} className="st-btn st-btn--primary">
                {S.next}
              </button>
            </div>
          )}
          {step === 4 && (
            <div className="na-actions na-actions--static">
              <button type="button" className="st-btn" onClick={() => goBack(3)}>
                {S.back}
              </button>
              <span />
            </div>
          )}
        </div>

        <aside className="na-side">
          <div className="na-side-top">
            <AllocationDonut slices={slices} size={64} thickness={8} />
            <div className="min-w-0">
              <b className="na-side-name">{name}</b>
              {(preset?.name ?? SIDE.own) !== name && (
                <span className="na-side-sub">{preset?.name ?? SIDE.own}</span>
              )}
            </div>
          </div>
          <dl className="na-side-facts">
            <div>
              <dt>{F.amount}</dt>
              <dd>{amountText}</dd>
            </div>
            <div>
              <dt>{F.perTrade}</dt>
              <dd>{mandate ? money(formatUnits(mandate.perActionCapUsdg, 6)) : '—'}</dd>
            </div>
            <div>
              <dt>{F.perDay}</dt>
              <dd>{mandate ? money(formatUnits(mandate.dailyCapUsdg, 6)) : '—'}</dd>
            </div>
          </dl>
          {symbols.length > 0 && <TokenStack symbols={symbols} size={22} max={6} />}
        </aside>
      </div>
    </section>
  )
}
