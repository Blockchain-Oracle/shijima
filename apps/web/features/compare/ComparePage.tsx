import type { ComparisonRun, SituationId } from '@desk/core'
import { compareCopy } from '@desk/shared'
import { ArrowLeft, CircleCheck, CircleX } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { riseDelay } from '@/features/how-it-works/rise'
import { cn } from '@/lib/utils'

export interface CompareSituation {
  id: SituationId
  userMessage: string
}

/**
 * /compare (design brief 8.20), drawn in How it works' card grammar: a saved situation, exactly what both were
 * shown, and the two answers side by side. The brief asks for a simple two-column layout, not a new design.
 */
export function ComparePage({
  situations,
  selected,
  runs,
}: {
  situations: readonly CompareSituation[]
  selected: SituationId
  runs: { raw: ComparisonRun | undefined; serv: ComparisonRun | undefined }
}) {
  const s = situations.find((x) => x.id === selected) ?? situations[0]
  if (!s) return null
  const words = compareCopy.situations[s.id]
  return (
    <div className="hiw">
      <div className="hiw-glows" aria-hidden>
        <div className="hiw-glow-mint" />
        <div className="hiw-glow-blue" />
      </div>
      <div className="hiw-main">
        <div className="hiw-wrap">
          <Link href="/how-it-works" className="hiw-back" data-cursor="hover">
            <ArrowLeft className="hiw-back-arrow" aria-hidden />
            {compareCopy.back}
          </Link>

          <header className="hiw-hero hiw-rise" style={{ marginBottom: 40 }}>
            <h1 className="hiw-title">{compareCopy.title}</h1>
            <p className="hiw-lead">{compareCopy.lead}</p>
          </header>

          <nav className="mb-6 flex flex-wrap gap-2" aria-label={compareCopy.pickLabel}>
            {situations.map((x) => (
              <Link
                key={x.id}
                href={`/compare?s=${x.id}` as Route}
                scroll={false}
                aria-current={x.id === s.id ? 'true' : undefined}
                className={cn(
                  'rounded-full border px-4 py-2 type-caption transition-colors',
                  x.id === s.id
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-hairline text-ink-secondary hover:text-ink',
                )}
                data-cursor="hover"
              >
                {compareCopy.situations[x.id].tab}
              </Link>
            ))}
          </nav>

          <section className="hiw-card hiw-card-wide hiw-rise" aria-label={words.title} style={riseDelay(0)}>
            <p className="hiw-example-tag">{compareCopy.tag}</p>
            <h2 className="hiw-fee-title" style={{ fontSize: 18 }}>
              {words.title}
            </h2>
            <p className="hiw-body">{words.summary}</p>
            <p className="hiw-body mt-3">
              <span className="text-ink">{compareCopy.lookFor}:</span> {words.lookFor}
            </p>
            <p className="mt-3 type-caption text-ink-muted">{compareCopy.example}</p>
            <details className="mt-5">
              <summary className="cursor-pointer type-caption text-ink-secondary" data-cursor="hover">
                {compareCopy.shown}
              </summary>
              <pre
                className="hiw-formula mt-3"
                style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-400)', fontSize: 12 }}
              >
                {s.userMessage}
              </pre>
            </details>
          </section>

          <div className="hiw-grid mt-4">
            <Answer run={runs.raw} column="raw" index={1} />
            <Answer run={runs.serv} column="serv" index={2} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Answer({
  run,
  column,
  index,
}: {
  run: ComparisonRun | undefined
  column: 'raw' | 'serv'
  index: number
}) {
  const c = compareCopy.columns[column]
  const d = run?.decision
  return (
    <article
      className={cn('hiw-card hiw-rise flex flex-col gap-4', column === 'serv' && 'hiw-card-blue')}
      style={riseDelay(index)}
    >
      <header>
        <h3 className="hiw-card-title" style={{ marginBottom: 4 }}>
          {c.title}
        </h3>
        {run && <p className="type-caption text-ink-muted">{c.sub(run.model)}</p>}
      </header>

      {!run || !d ? (
        <p className="hiw-body-dim">{compareCopy.notRun}</p>
      ) : (
        <>
          <div>
            <div className="hiw-figure" style={{ fontSize: 22 }}>
              {compareCopy.options[d.option] ?? d.option}
              {d.option === 'ACT_PART' && d.partPercent ? ` · ${compareCopy.part(d.partPercent)}` : ''}
            </div>
            <div className="hiw-figure-label">{compareCopy.confidence(d.confidencePercent)}</div>
          </div>
          <p className="hiw-body text-ink">{d.headline}</p>

          <div>
            <h4 className="hiw-step-label mb-1">{compareCopy.reasons}</h4>
            <ul className="flex flex-col gap-2">
              {d.reasons.map((r) => (
                <li key={r.text} className="hiw-body">
                  {r.text}{' '}
                  {r.evidenceIds.length > 0 && (
                    <span className="type-caption text-ink-muted">
                      ({compareCopy.cites(r.evidenceIds.join(', '))})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="hiw-step-label mb-1">{compareCopy.rejected}</h4>
            <ul className="flex flex-col gap-2">
              {d.rejected.map((r) => (
                <li key={r.option} className="hiw-body">
                  <span className="text-ink">{compareCopy.options[r.option] ?? r.option}:</span> {r.reason}
                </li>
              ))}
            </ul>
          </div>

          <ul className="flex flex-col gap-1 type-caption text-ink-secondary">
            <li>{compareCopy.news[d.newsExplainsGap] ?? d.newsExplainsGap}</li>
            <li>{d.ruleIds.length > 0 ? compareCopy.rules(d.ruleIds.join(', ')) : compareCopy.noRules}</li>
            {d.warnings.length > 0 && (
              <li>
                {compareCopy.warnings}: {d.warnings.join(' ')}
              </li>
            )}
          </ul>

          {run.problems.length === 0 ? (
            <p className="flex items-start gap-2 hiw-body text-profit">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {compareCopy.accepted}
            </p>
          ) : (
            <div className="flex items-start gap-2 hiw-body text-loss">
              <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                {compareCopy.refused}
                <ul className="mt-1 list-disc pl-4">
                  {run.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <p className="mt-auto type-caption text-ink-muted">
            {compareCopy.meta(
              `${(run.latencyMs / 1000).toFixed(1)} s`,
              run.totalTokens === null ? '—' : run.totalTokens.toLocaleString('en-US'),
              new Date(run.ranAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            )}
          </p>
        </>
      )}
    </article>
  )
}
