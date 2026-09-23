import { APPROVED_TOKENS, EXPLORER } from '@desk/chain'
import { homeCopy as H, lookOf, money, OPENSERV, PRESETS, short } from '@desk/shared'
import { ArrowRight, ArrowUpRight, Fingerprint } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { outcomeLabel } from '@/components/outcome'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import { SectionHeader } from '@/components/ui/section-header'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { doingNow } from '@/features/desk/AgentCard'
import { StrategyCard } from '@/features/strategies/StrategyCard'
import type { DeskView } from '@/lib/desk.server'
import type { PresetPerformance } from '@/lib/markets.server'
import './home.css'

const TOKENS = APPROVED_TOKENS.map((t) => ({
  symbol: t.symbol,
  name: t.displayName,
  address: t.address,
  tradability: t.tradability,
}))
const nameOf = (symbol: string) => APPROVED_TOKENS.find((t) => t.symbol === symbol)?.displayName ?? symbol
const dollars = (n: number) => `$${n.toFixed(2)}`

/** The live showcase desk as a small agent card: what it is doing, what it is worth, its latest decision. */
function LiveAgent({ view }: { view: DeskView | undefined }) {
  if (!view) return <div className="hm-live lp-note">{H.live.none}</div>
  const latest = view.agent.latest
  const symbols = view.mandate?.targets.map((t) => t.symbol) ?? []
  return (
    <section className="hm-live" aria-label={H.live.eyebrow}>
      <div className="hm-live-head">
        <span className="hm-live-eyebrow">
          <i aria-hidden />
          {H.live.eyebrow}
        </span>
        {symbols.length > 0 ? <TokenStack symbols={symbols} size={28} /> : null}
      </div>
      <div className="hm-live-agent">
        <span className="hm-live-avatar" aria-hidden>
          <ShijimaMark />
        </span>
        <div>
          <div className="hm-live-name">Shijima</div>
          <div className="hm-live-sub">
            {view.desk.name} · {view.mandate?.preset ?? symbols.join(', ')}
          </div>
        </div>
      </div>
      <p className="hm-live-now">{doingNow(view)}</p>
      {view.plate ? (
        <div className="hm-live-value">
          <b>{money((Number(view.plate.totalUsdg) / 1e6).toString())}</b>
          <span>{H.live.value}</span>
        </div>
      ) : null}
      {latest ? (
        <Link href={`/agents/${view.slug}/decision/${latest.seq}` as Route} className="hm-live-latest">
          <small>
            {H.live.latest} · {outcomeLabel(latest.outcome as Parameters<typeof outcomeLabel>[0])}
          </small>
          <p>{latest.summary}</p>
        </Link>
      ) : null}
      <div className="hm-live-foot">
        <span className="inline-flex items-center gap-1.5">
          <Fingerprint className="size-3.5" aria-hidden />
          {H.live.check}
        </span>
        <Link href={`/agents/${view.slug}` as Route} className="lp-link">
          {H.live.open} →
        </Link>
      </div>
    </section>
  )
}

/** "$100 in The 7 giants", split into what each stock and the cash get, with the logos in their colours. */
function DollarSplit({ vaultRateBps }: { vaultRateBps: number | null }) {
  const preset = PRESETS.find((p) => p.id === 'mag-seven') ?? PRESETS[0]
  if (!preset) return null
  const parts = [
    ...Object.entries(preset.weights).map(([symbol, bps]) => ({ symbol, usd: bps / 100 })),
    { symbol: 'CASH', usd: preset.cashBps / 100 },
  ]
  const each = parts[0]?.usd ?? 0
  return (
    <div className="hm-dollars">
      <div className="hm-dollars-copy">
        <p>{H.dollars.lead(preset.name)}</p>
        <p>{H.dollars.each(dollars(each), parts.length - 1)}</p>
        <p>{H.dollars.cash(dollars(preset.cashBps / 100))}</p>
        <p>
          {vaultRateBps !== null
            ? H.dollars.earns(`${(vaultRateBps / 100).toFixed(1)}%`)
            : H.dollars.earnsUnknown}
        </p>
        <p>{H.dollars.drift}</p>
      </div>
      <div className="hm-split">
        <div className="hm-split-bar" role="img" aria-label={H.dollars.lead(preset.name)}>
          {parts.map((p) => (
            <span
              key={p.symbol}
              className="hm-split-seg"
              style={{ flexGrow: p.usd, background: lookOf(p.symbol === 'CASH' ? '$' : p.symbol).color }}
            >
              {p.usd >= 10 ? `$${Math.round(p.usd)}` : ''}
            </span>
          ))}
        </div>
        <ul className="hm-split-rows">
          {parts.map((p) => (
            <li key={p.symbol}>
              <TokenLogo symbol={p.symbol} size={22} />
              {p.symbol === 'CASH' ? 'Cash' : nameOf(p.symbol)}
              <b>{dollars(p.usd)}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * `/` for someone who has never been here: what Shijima is, in the order they need it. A live agent at work on
 * the right of the first screen, then the five steps, the $100 story, why nights and weekends, the strategies,
 * the promises, and proof they can open. After Agari's landing (`features/landing`), in Masayume's tokens.
 */
export function HomePage({
  showcase,
  weekendFact,
  performance,
  vaultRateBps,
  factory,
}: {
  showcase: DeskView | undefined
  weekendFact: string | null
  performance: PresetPerformance[]
  vaultRateBps: number | null
  factory: string
}) {
  const recent = (showcase?.record ?? []).flatMap((r) => (r.kind === 'entry' ? [r.decision] : [])).slice(0, 4)
  return (
    <div className="lp hm">
      <section className="page-hero lp-hero">
        <span className="crop tl" />
        <span className="crop tr" />
        <span className="crop bl" />
        <span className="crop br" />
        <div className="container">
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="section-eyebrow lp-eyebrow">{H.hero.eyebrow}</div>
              <h1 className="lp-title">
                {H.hero.titleLead} <em>{H.hero.titleEm}</em>
              </h1>
              <p className="lp-line">{H.hero.line}</p>
              <div className="lp-ctas">
                <Link href={'/strategies' as Route} className="btn btn-primary lp-cta" data-cursor="hover">
                  {H.hero.primary}
                </Link>
                <Link
                  href={(showcase ? `/agents/${showcase.slug}` : '/markets') as Route}
                  className="btn btn-outline lp-cta"
                  data-cursor="hover"
                >
                  {H.hero.secondary}
                </Link>
              </div>
              <p className="lp-note mt-4">{H.hero.practice}</p>
            </div>
            <div className="min-w-0">
              <LiveAgent view={showcase} />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-label={H.steps.title}>
        <div className="container">
          <SectionHeader index={H.steps.index} title={H.steps.title} desc={H.steps.desc} className="mb-10" />
          <ol className="lp-steps hm-steps">
            {H.steps.items.map((step, i) => (
              <li
                key={step.title}
                className="lp-step"
                data-step={i + 1}
                data-who={step.kicker === 'You' ? 'you' : 'agent'}
              >
                <span className="lp-step-num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="lp-step-kicker">{step.kicker}</p>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-body">{step.body}</p>
                <div className="lp-step-art" aria-hidden>
                  {step.art.map((word) => (
                    <span key={word} className="lp-chip">
                      {word}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" aria-label={H.dollars.title}>
        <div className="container">
          <SectionHeader
            index={H.dollars.index}
            title={H.dollars.title}
            desc={H.dollars.desc}
            className="mb-10"
          />
          <DollarSplit vaultRateBps={vaultRateBps} />
        </div>
      </section>

      <section className="lp-section" aria-label={H.weekend.title}>
        <div className="container hm-week">
          <SectionHeader
            index={H.weekend.index}
            title={H.weekend.title}
            desc={H.weekend.desc}
            className="mb-4"
          />
          <div
            className="hm-week-bar"
            role="img"
            aria-label={`${H.weekend.open} 32h, ${H.weekend.shut} 136h`}
          >
            <span className="hm-week-open">
              {H.weekend.open} · {H.weekend.hours(32)}
            </span>
            <span className="hm-week-shut">
              <span>{H.weekend.shut}</span>
              <span>{H.weekend.hours(136)}</span>
            </span>
          </div>
          <p className="hm-week-fact">{weekendFact ?? H.weekend.noFact}</p>
          <p className="hm-week-never">{H.weekend.never}</p>
        </div>
      </section>

      <section className="lp-section" aria-label={H.strategies.title}>
        <div className="container">
          <SectionHeader
            index={H.strategies.index}
            title={H.strategies.title}
            desc={H.strategies.desc}
            className="mb-10"
            aside={
              <Link href={'/strategies' as Route} className="hm-strategy-cta">
                {H.strategies.all} <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="hm-strategies">
            {PRESETS.map((p, i) => (
              <StrategyCard
                key={p.id}
                index={i}
                name={p.name}
                description={p.description}
                suits={p.suits}
                weights={p.weights}
                cashBps={p.cashBps}
                tokens={TOKENS}
                performance={performance.find((x) => x.id === p.id)}
                action={
                  <Link href={`/strategies?preset=${p.id}` as Route} className="hm-strategy-cta">
                    {H.strategies.start} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" aria-label={H.promises.title}>
        <div className="container">
          <SectionHeader
            index={H.promises.index}
            title={H.promises.title}
            desc={H.promises.desc}
            className="mb-10"
          />
          <div className="lp-cover">
            <ol className="lp-desk-promise">
              {H.promises.items.map((point, i) => (
                <li key={point}>
                  <span className="lp-desk-n">{String(i + 1).padStart(2, '0')}</span>
                  {point}
                </li>
              ))}
            </ol>
            <div className="lp-cover-copy">
              <p className="lp-cover-p">{H.promises.worstCase}</p>
              <Link href={'/how-it-works#withdraw-without-us' as Route} className="lp-link">
                {H.promises.withdraw} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-label={H.proof.title}>
        <div className="container">
          <SectionHeader index={H.proof.index} title={H.proof.title} desc={H.proof.desc} className="mb-10" />
          <div className="lp-proof">
            <dl className="lp-proof-ids">
              {showcase ? (
                <div className="lp-proof-cell">
                  <dt className="lp-proof-label">{H.proof.desk}</dt>
                  <dd className="lp-proof-value">
                    <a
                      href={`${EXPLORER}/address/${showcase.desk.address}`}
                      className="lp-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(showcase.desk.address)}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="lp-proof-cell">
                <dt className="lp-proof-label">{H.proof.factory}</dt>
                <dd className="lp-proof-value">
                  <a
                    href={`${EXPLORER}/address/${factory}`}
                    className="lp-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(factory)}
                  </a>
                </dd>
              </div>
              <div className="lp-proof-cell">
                <dt className="lp-proof-label">{H.proof.agent}</dt>
                <dd className="lp-proof-value">
                  <a href={OPENSERV.agentUrl} className="lp-link" target="_blank" rel="noreferrer">
                    #{OPENSERV.agentId}
                  </a>
                </dd>
              </div>
              <div className="lp-proof-cell">
                <dt className="lp-proof-label">{H.proof.identity}</dt>
                <dd className="lp-proof-value">
                  <a href={OPENSERV.identity.url} className="lp-link" target="_blank" rel="noreferrer">
                    #{OPENSERV.identity.tokenId}
                  </a>
                </dd>
              </div>
              <div className="lp-proof-cell">
                <dt className="lp-proof-label">{H.proof.reasoning}</dt>
                <dd className="lp-proof-value">{H.proof.reasoningValue}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-3">
              <span className="lp-proof-label">{H.proof.recent}</span>
              <ul className="hm-proof-list">
                {recent.map((r) => (
                  <li key={r.seq}>
                    <Link href={`/agents/${showcase?.slug}/decision/${r.seq}` as Route}>
                      <small>#{r.seq}</small>
                      <span className="truncate">
                        {outcomeLabel(r.outcome)} · {r.summary}
                      </span>
                      <ArrowUpRight className="size-4 text-ink-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={'/status' as Route} className="lp-link text-sm">
                {H.proof.status} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-install" aria-label={H.install.title}>
        <div className="container">
          <div className="hm-install">
            <div>
              <h3>{H.install.title}</h3>
              <p>{H.install.line}</p>
            </div>
            <Link href={'/strategies' as Route} className="btn btn-primary lp-cta">
              {H.hero.primary}
            </Link>
          </div>
          <p className="lp-note mt-6">{H.who}</p>
        </div>
      </section>
    </div>
  )
}
