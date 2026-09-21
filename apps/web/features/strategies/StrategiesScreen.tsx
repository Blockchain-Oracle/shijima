'use client'

import { type Preset, percent, short, studioCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { HeaderAccount } from '@/components/shell/HeaderAccount'
import type { DraftToken } from './draft'
import { withPreset } from './draft'
import { Studio } from './Studio'
import { useStudioDraft } from './useStudioDraft'

const T = studioCopy

export interface SharedMix {
  name: string
  slug: string
  mode: string
  /** Bps by symbol, from the desk's mandate in force. */
  weights: Record<string, number>
  cashBps: number
}

export interface OwnDesk {
  id: string
  slug: string
  name: string
  lifecycle: string
  mode: string
  checks: number
}

type View = 'create' | 'from' | 'yours'

/**
 * `/strategies`, as Agari's `StrategiesScreen`: a nameplate, three entries, and the studio. "Start from a
 * strategy" takes a basket, or a shared desk's mix, into the studio; only the mix is ever copied. "Your desks"
 * lists the owner's desks, and an unfinished one from the studio with its address, to finish.
 */
export function StrategiesScreen({
  presets,
  tokens,
  shared,
  own,
  draftDesk,
  signedIn,
  disclosureOn,
  contractVersion,
  requestedPreset,
  requestedView,
}: {
  presets: Preset[]
  tokens: DraftToken[]
  shared: SharedMix[]
  own: OwnDesk[]
  draftDesk: { address: string; name: string | null } | null
  signedIn: string | null
  disclosureOn: string | null
  contractVersion: string
  requestedPreset: string | undefined
  requestedView: string | undefined
}) {
  const [view, setView] = useState<View>(
    requestedView === 'from' || requestedView === 'yours' ? requestedView : 'create',
  )
  const { draft, setDraft, reset } = useStudioDraft(presets, requestedPreset)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (view === 'create') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    window.history.replaceState(null, '', url)
  }, [view])

  const takeMix = (weights: Record<string, number>, cashBps: number, preset: string | null) => {
    setDraft((d) => ({ ...d, weights: { ...weights }, cashBps, preset }))
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container pt-7 pb-12">
      <div className="strat-nameplate">
        <p className="strat-meta mb-3 text-vermilion">{T.kicker}</p>
        <h1 className="strat-h1">{T.title}</h1>
      </div>
      <p className="mt-5 mb-2 max-w-2xl text-ink-secondary text-sm">{T.lede}</p>

      <nav className="agent-entry" aria-label={T.aria}>
        {(
          [
            ['create', T.tabs.create],
            ['from', T.tabs.from],
            ['yours', T.tabs.yours],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </nav>

      {draftDesk && view !== 'yours' && (
        <div className="copy-progress">
          <strong>{T.yours.draft}</strong>
          <p>{T.yours.draftBody(short(draftDesk.address, 6, 4))}</p>
        </div>
      )}

      <div hidden={view !== 'create'}>
        <Studio
          draft={draft}
          setDraft={setDraft}
          resetDraft={reset}
          presets={presets}
          tokens={tokens}
          signedIn={signedIn}
          disclosureOn={disclosureOn}
          contractVersion={contractVersion}
        />
      </div>

      {view === 'from' && (
        <StartFrom
          presets={presets}
          shared={shared}
          tokens={tokens}
          onPreset={(p) => {
            setDraft((d) => withPreset(d, p))
            setView('create')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onMix={(m) => takeMix(m.weights, m.cashBps, null)}
        />
      )}

      {view === 'yours' && (
        <YourDesks own={own} draftDesk={draftDesk} signedIn={signedIn} onCreate={() => setView('create')} />
      )}

      <p className="strat-mono-10 mt-8 max-w-2xl text-ink-muted">{T.notAdvice}</p>
    </div>
  )
}

function MixBar({
  weights,
  cashBps,
  tokens,
}: {
  weights: Record<string, number>
  cashBps: number
  tokens: DraftToken[]
}) {
  const held = tokens.filter((t) => (weights[t.symbol] ?? 0) > 0)
  const F = T.from
  return (
    <>
      <div className="studio-bar" aria-hidden>
        {held.map((t, i) => (
          <span
            key={t.symbol}
            style={{
              width: `${(weights[t.symbol] ?? 0) / 100}%`,
              background: `color-mix(in srgb, var(--color-vermilion) ${90 - i * 8}%, var(--bg))`,
            }}
          />
        ))}
      </div>
      <div className="studio-weights">
        {held.slice(0, 6).map((t) => (
          <span key={t.symbol}>
            {t.symbol} <b>{percent(weights[t.symbol] ?? 0)}</b>
          </span>
        ))}
        {held.length > 6 && <span>{F.more(held.length - 6)}</span>}
        <span>{F.cash(percent(cashBps))}</span>
      </div>
    </>
  )
}

function StartFrom({
  presets,
  shared,
  tokens,
  onPreset,
  onMix,
}: {
  presets: Preset[]
  shared: SharedMix[]
  tokens: DraftToken[]
  onPreset: (p: Preset) => void
  onMix: (m: SharedMix) => void
}) {
  const F = T.from
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="strat-h2">{F.title}</h2>
        <p className="strat-choice-body max-w-2xl">{F.body}</p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="strat-meta text-ink-muted">{F.presets}</h3>
        <div className="studio-cards">
          {presets.map((p) => (
            <div key={p.id} className="strat-choice">
              <span className="strat-choice-title text-ink">{p.name}</span>
              <p className="strat-choice-body">{p.description}</p>
              <MixBar weights={p.weights} cashBps={p.cashBps} tokens={tokens} />
              <button
                type="button"
                className="strat-sensei mt-4"
                onClick={() => onPreset(p)}
                data-cursor="hover"
              >
                {F.use}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="strat-meta text-ink-muted">{F.shared}</h3>
        {shared.length === 0 ? (
          <p className="strat-choice-body">{F.sharedEmpty}</p>
        ) : (
          <div className="studio-cards">
            {shared.map((m) => (
              <div key={m.slug} className="strat-choice">
                <span className="strat-choice-title text-ink">{m.name}</span>
                <MixBar weights={m.weights} cashBps={m.cashBps} tokens={tokens} />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="strat-sensei" onClick={() => onMix(m)} data-cursor="hover">
                    {F.use}
                  </button>
                  <Link
                    href={`/desk/${m.slug}` as Route}
                    className="type-caption text-ink-secondary hover:text-ink"
                  >
                    {F.watch} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function YourDesks({
  own,
  draftDesk,
  signedIn,
  onCreate,
}: {
  own: OwnDesk[]
  draftDesk: { address: string; name: string | null } | null
  signedIn: string | null
  onCreate: () => void
}) {
  const Y = T.yours
  if (!signedIn) {
    return (
      <div className="strat-empty">
        <h2 className="strat-h2 mb-3">{Y.title}</h2>
        <p className="mb-5 text-ink-secondary">{Y.signIn}</p>
        <div className="flex justify-center">
          <HeaderAccount signedInAs={undefined} />
        </div>
      </div>
    )
  }
  if (own.length === 0 && !draftDesk) {
    return (
      <div className="strat-empty">
        <h2 className="strat-h2">{Y.empty}</h2>
        <button
          type="button"
          className="strat-confirm strat-confirm--live mx-auto mt-5 max-w-xs"
          onClick={onCreate}
        >
          {Y.create}
        </button>
      </div>
    )
  }
  return (
    <div className="strat-rows">
      {draftDesk && (
        <div className="strat-row studio-desk-row">
          <div className="min-w-0">
            <p className="strat-choice-title text-ink">{draftDesk.name ?? T.side.unnamed}</p>
            <p className="strat-mono-11 text-ink-muted">{Y.draftBody(short(draftDesk.address, 6, 4))}</p>
          </div>
          <button type="button" className="strat-sensei" onClick={onCreate}>
            {Y.finish}
          </button>
        </div>
      )}
      {own.map((d) => (
        <div key={d.id} className="strat-row studio-desk-row">
          <div className="min-w-0">
            <p className="strat-choice-title text-ink">{d.name}</p>
            <p className="strat-mono-11 text-ink-muted">
              {Y.lifecycle[d.lifecycle] ?? d.lifecycle} · {d.mode} · {Y.checks(d.checks)}
            </p>
          </div>
          <Link href={`/desk/${d.slug}` as Route} className="strat-sensei">
            {Y.open}
          </Link>
        </div>
      ))}
    </div>
  )
}
