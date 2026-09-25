'use client'

import { appCopy, type Preset, studioCopy } from '@desk/shared'
import { useEffect } from 'react'
import type { CopyQuote } from '@/app/copy-actions'
import type { DraftToken } from './draft'
import type { Performance } from './StrategyCard'
import { Studio } from './Studio'
import { useStudioDraft } from './useStudioDraft'

const T = studioCopy

/**
 * `/agents/new`: the create flow and nothing else. A short title, the banner when copying another agent, and the
 * studio. Browsing strategies lives on /strategies and your agents on /agents, so neither is repeated here.
 */
export function StrategiesScreen({
  presets,
  tokens,
  signedIn,
  disclosureOn,
  contractVersion,
  goLiveChecks,
  requestedPreset,
  performance,
  copyOf = null,
}: {
  presets: Preset[]
  tokens: DraftToken[]
  signedIn: string | null
  disclosureOn: string | null
  contractVersion: string
  goLiveChecks: number
  requestedPreset: string | undefined
  /** The agent being copied, when the studio was opened from "Copy this agent". */
  copyOf?: CopyQuote | null
  /** Each preset's return over the price log's last month, by preset id. */
  performance: Record<string, Performance>
}) {
  const { draft, setDraft, reset } = useStudioDraft(presets, requestedPreset)

  // Copying starts from the leader's own mix, named after it. The owner still chooses the money and the limits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per agent being copied
  useEffect(() => {
    if (!copyOf) return
    const symbolOf = new Map(tokens.map((t) => [t.address.toLowerCase(), t.symbol]))
    const weights = Object.fromEntries(
      copyOf.targets.flatMap((t) => {
        const symbol = symbolOf.get(t.token.toLowerCase())
        return symbol ? [[symbol, t.weightBps]] : []
      }),
    )
    setDraft((d) => ({
      ...d,
      name: appCopy.copy.studio.banner(copyOf.name),
      preset: copyOf.presetId,
      weights,
      cashBps: copyOf.cashBps,
    }))
  }, [copyOf?.leaderId])

  return (
    <div className="na-page">
      <header className="na-head">
        <h1>{T.newTitle}</h1>
        <p>{T.newSub}</p>
      </header>

      {copyOf && (
        <div className="copy-progress copy-banner">
          <strong>{appCopy.copy.studio.banner(copyOf.name)}</strong>
          <p>{appCopy.copy.studio.bannerBody}</p>
        </div>
      )}

      <Studio
        draft={draft}
        setDraft={setDraft}
        resetDraft={reset}
        presets={presets}
        tokens={tokens}
        signedIn={signedIn}
        disclosureOn={disclosureOn}
        contractVersion={contractVersion}
        goLiveChecks={goLiveChecks}
        performance={performance}
        copyOf={copyOf}
      />

      <p className="na-foot">{T.notAdvice}</p>
    </div>
  )
}
