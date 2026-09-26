import { APPROVED_TOKENS } from '@desk/chain'
import {
  appCopy,
  homeCopy as H,
  lookOf,
  money,
  OPENSERV,
  onchainCopy,
  PRESETS,
  settingsCopy,
} from '@desk/shared'
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bot, Fingerprint, KeyRound } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/ui/brand-logo'
import { ChainLogo } from '@/components/ui/chain-logo'
import { LogoMarquee, type MarqueeItem } from '@/components/ui/logo-marquee'
import { Qr } from '@/components/ui/qr'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { factsOf } from '@/features/onchain/OnChainFacts'
import type { PublicAgent } from '@/lib/agents.server'
import type { PresetPerformance } from '@/lib/markets.server'
import { DeviceShowcase } from './DeviceShowcase'
import { Logo } from './Logo'
import { appHrefFor, SHOWCASE_ROUTE } from './links'
import { MockScreen } from './MockScreen'
import { Reveal } from './Reveal'
import { type ChatLatest, TelegramChat } from './TelegramChat'

interface Showcase {
  slug: string
  address: string
  recent: { seq: number; outcome: string; summary: string }[]
}

const nameOf = (symbol: string) => APPROVED_TOKENS.find((t) => t.symbol === symbol)?.displayName ?? symbol
const dollars = (n: number) => `$${n.toFixed(2)}`
const usdRaw = (raw: string | null) => (raw === null ? '—' : money((Number(raw) / 1e6).toString()))
const wholeDollars = (raw: string) => `$${Math.round(Number(raw) / 1e6).toLocaleString('en-US')}`

/* ── Hero: 21st.dev's Hero with Mockup (Launch UI), in Shijima's colours ── */

function Hero({ appHref }: { appHref: string }) {
  return (
    <section className="land-hero" aria-label={H.hero.aria}>
      <div className="hero-stage">
        <div className="hero-copy">
          <Logo size={56} glow />
          <h1 className="hero-in" style={{ animationDelay: '80ms' }}>
            {H.hero.titleLead}
            <br />
            <em>{H.hero.titleEm}</em>
          </h1>
          <p className="hero-line hero-in" style={{ animationDelay: '180ms' }}>
            {H.hero.line}
          </p>
          <div className="hero-actions hero-in" style={{ animationDelay: '280ms' }}>
            <Link className="land-cta cta-sheen" href={appHref as Route}>
              {H.hero.primary} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="land-secondary" href={SHOWCASE_ROUTE}>
              <span className="live-dot" aria-hidden /> {H.hero.secondary}
            </Link>
          </div>
          <p className="hero-live hero-in" style={{ animationDelay: '360ms' }}>
            <ChainLogo chainId={4663} size={16} /> {H.hero.live}
          </p>
        </div>
        <div className="hero-mock hero-in" style={{ animationDelay: '460ms' }}>
          <span className="hero-halo" aria-hidden />
          <Link className="hero-screen" href={SHOWCASE_ROUTE}>
            {/* biome-ignore lint/performance/noImgElement: a fixed screenshot per theme; CSS shows the one that matches */}
            <img
              className="shot-dark"
              src="/landing/agent-dark.png"
              alt={H.hero.shot}
              width={1264}
              height={549}
            />
            {/* biome-ignore lint/performance/noImgElement: as above, for the light theme */}
            <img className="shot-light" src="/landing/agent-light.png" alt="" width={1264} height={549} />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Built on: 21st.dev's Logo Cloud Marquee, with the real marks, the real numbers and the live prices ── */

const PARTNERS: MarqueeItem[] = [
  { key: 'rh', label: 'Robinhood Chain', logo: <ChainLogo chainId={4663} size={24} /> },
  { key: 'os', label: 'OpenServ · SERV Reasoning', logo: <BrandLogo brand="openserv" size={24} /> },
  { key: 'uni', label: 'Uniswap', logo: <BrandLogo brand="uniswap" size={24} /> },
  { key: 'link', label: 'Chainlink', logo: <BrandLogo brand="chainlink" size={24} /> },
  { key: 'morpho', label: 'Morpho', logo: <BrandLogo brand="morpho" size={24} /> },
  { key: 'cb', label: 'Coinbase AgentKit', logo: <BrandLogo brand="coinbase" size={24} /> },
  { key: 'relay', label: 'Relay', logo: <BrandLogo brand="relay" size={24} /> },
  { key: 'tg', label: 'Telegram', logo: <BrandLogo brand="telegram" size={24} /> },
]

function BuiltOnStrip({
  stats,
  vaultRateBps,
  prices,
}: {
  stats: { trades: number; movedUsdg: string } | null
  vaultRateBps: number | null
  prices: { symbol: string; price: string }[]
}) {
  const b = H.builtOn
  return (
    <Reveal as="div" className="built-on">
      <div className="built-on-row">
        <span className="built-on-label">{b.label}</span>
        <div className="built-on-stats">
          {stats ? (
            <>
              <span>
                <b>{stats.trades.toLocaleString('en-US')}</b> {b.trades}
              </span>
              <span>
                <b>{wholeDollars(stats.movedUsdg)}</b> {b.moved}
              </span>
            </>
          ) : null}
          {vaultRateBps !== null ? (
            <span>
              <b>{(vaultRateBps / 100).toFixed(1)}%</b> {b.rate}
            </span>
          ) : null}
        </div>
      </div>
      <LogoMarquee items={PARTNERS} seconds={40} className="built-on-logos" />
      {prices.length > 0 ? (
        <div className="built-on-prices">
          <span className="built-on-label">{b.prices}</span>
          <LogoMarquee
            reverse
            seconds={Math.max(30, prices.length * 4)}
            items={prices.map((p) => ({
              key: p.symbol,
              logo: <TokenLogo symbol={p.symbol} size={22} />,
              label: (
                <>
                  <b>{nameOf(p.symbol)}</b> {p.price}
                </>
              ),
            }))}
          />
        </div>
      ) : null}
    </Reveal>
  )
}

/* ── One agent, everywhere ── */

function Platforms({
  appHref,
  bot,
  botLink,
  latest,
}: {
  appHref: string
  bot: string
  botLink: string
  latest: ChatLatest | null
}) {
  const p = H.platforms
  return (
    <Reveal id="everywhere" className="land-section" label={p.label}>
      <span className="section-label">{p.label}</span>
      <h2>{p.title}</h2>
      <p className="section-sub">{p.sub}</p>
      <div className="screens-band">
        <DeviceShowcase appHref={appHref} bot={bot} botLink={botLink} latest={latest} />
      </div>
    </Reveal>
  )
}

/* ── Money in. Agent trades. Only you take it out. ── */

const STEP_ICON: Record<string, ReactNode> = {
  in: <ArrowDownToLine size={16} aria-hidden />,
  agent: <Bot size={16} aria-hidden />,
  out: <KeyRound size={16} aria-hidden />,
}

function MoneyModel({ weekendFact }: { weekendFact: string | null }) {
  const m = H.model
  return (
    <Reveal id="money" className="land-section" label={m.title}>
      <span className="section-label">{m.label}</span>
      <h2>{m.title}</h2>
      <Link className="section-link" href={'/how-it-works#withdraw-without-us' as Route}>
        {m.link} <ArrowRight size={15} aria-hidden />
      </Link>
      <div className="privacy-grid">
        {m.steps.map((step, index) => (
          <article
            className={`privacy-step tone-${step.tone}`}
            key={step.title}
            style={{ transitionDelay: `${index * 90}ms` }}
          >
            <span className="privacy-tag">
              {STEP_ICON[step.tone]}
              {step.tag}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            {step.tone === 'agent' ? <p className="step-note">{weekendFact ?? m.weekendNone}</p> : null}
          </article>
        ))}
      </div>
      <div className="promises">
        <div className="proof-panel">
          <p className="panel-title">{m.promisesTitle}</p>
          <ol>
            {m.promises.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ol>
        </div>
        <div className="proof-panel worst">
          <p className="panel-title">{m.worstTitle}</p>
          <p>{m.worstCase}</p>
          <p>{m.never}</p>
        </div>
      </div>
    </Reveal>
  )
}

/* ── On chain now ── */

function OnChainNow({ factory, showcase }: { factory: string; showcase: Showcase | null }) {
  const facts = factsOf(factory, showcase ? { address: showcase.address, mine: false } : undefined)
  return (
    <Reveal id="onchain" className="land-section" label={onchainCopy.title}>
      <span className="section-label">{onchainCopy.eyebrow}</span>
      <h2>{onchainCopy.title}</h2>
      <p className="section-sub">{onchainCopy.desc}</p>
      <div className="platform-grid is-four">
        {facts.map((f, index) => {
          const Icon = f.icon
          return (
            <a
              key={f.key}
              href={f.href}
              target="_blank"
              rel="noreferrer noopener"
              className="platform-card"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <span className="platform-meta">
                <Icon size={14} aria-hidden />
                {f.label}
                <ArrowUpRight size={15} aria-hidden className="go" />
              </span>
              <h3>{f.shown}</h3>
              <p>{f.what}</p>
              {f.when ? <span className="platform-spec">{f.when}</span> : null}
            </a>
          )
        })}
      </div>
    </Reveal>
  )
}

/* ── Live agents ── */

function LiveAgents({ agents }: { agents: PublicAgent[] }) {
  const c = appCopy.carousel
  if (agents.length === 0) return null
  return (
    <Reveal id="live" className="land-section" label={c.title}>
      <span className="section-label">{H.live.label}</span>
      <h2>{c.title}</h2>
      <p className="section-sub">{c.desc}</p>
      <Link className="section-link" href="/agents">
        {c.all} <ArrowRight size={15} aria-hidden />
      </Link>
      <div className="platform-grid">
        {agents.slice(0, 7).map((a, index) => (
          <article
            key={a.id}
            className="platform-card agent-card"
            style={{ transitionDelay: `${Math.min(index, 5) * 90}ms` }}
          >
            <Link href={`/agents/${a.slug}` as Route} className="card-cover" aria-label={a.name} />
            <span className="platform-meta">
              <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} size={22} max={4} />
              <span className={`mode${a.mode !== 'shadow' ? ' is-live' : ''}`}>
                {a.mode === 'shadow' ? c.practice : c.live}
              </span>
            </span>
            <h3>{a.name}</h3>
            <p>{a.latest?.summary ?? c.noDecision}</p>
            <div className="card-foot">
              <Sparkline values={a.spark} width={90} height={30} />
              <span>
                <b>{usdRaw(a.valueUsdg)}</b>
                <br />
                {appCopy.agents.record(a.better, a.graded)}
              </span>
              <Link href={`/agents/${a.slug}?copy=1` as Route} className="copy-link">
                {c.copy} →
              </Link>
            </div>
          </article>
        ))}
        {/* Two cards that are always true: how to start your own, and what copying means. */}
        {[
          { ...c.create, href: '/agents/new' },
          { ...c.how, href: '/how-it-works' },
        ].map((q) => (
          <Link key={q.label} href={q.href as Route} className="platform-card">
            <span className="platform-meta">{q.label}</span>
            <h3>{q.title}</h3>
            <p>{q.body}</p>
            <span className="platform-spec">{q.cta} →</span>
          </Link>
        ))}
      </div>
    </Reveal>
  )
}

/* ── Strategies ── */

function DollarSplit({ vaultRateBps }: { vaultRateBps: number | null }) {
  const d = H.strategies.dollars
  const preset = PRESETS.find((p) => p.id === 'mag-seven') ?? PRESETS[0]
  if (!preset) return null
  const parts = [
    ...Object.entries(preset.weights).map(([symbol, bps]) => ({ symbol, usd: bps / 100 })),
    { symbol: 'CASH', usd: preset.cashBps / 100 },
  ]
  const each = parts[0]?.usd ?? 0
  return (
    <div className="dollars">
      <div>
        <h3>{d.title(preset.name)}</h3>
        <p>{d.each(dollars(each), parts.length - 1)}</p>
        <p>{d.cash(dollars(preset.cashBps / 100))}</p>
        <p>{vaultRateBps !== null ? d.earns(`${(vaultRateBps / 100).toFixed(1)}%`) : d.earnsUnknown}</p>
        <p>{d.drift}</p>
      </div>
      <div>
        <div className="split-bar" role="img" aria-label={d.title(preset.name)}>
          {parts.map((p) => (
            <span
              key={p.symbol}
              style={{ flexGrow: p.usd, background: lookOf(p.symbol === 'CASH' ? '$' : p.symbol).color }}
            >
              {p.usd >= 10 ? `$${Math.round(p.usd)}` : ''}
            </span>
          ))}
        </div>
        <ul className="split-rows">
          {parts.map((p) => (
            <li key={p.symbol}>
              <TokenLogo symbol={p.symbol} size={20} />
              <span>{p.symbol === 'CASH' ? d.cashName : nameOf(p.symbol)}</span>
              <b>{dollars(p.usd)}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Strategies({
  performance,
  vaultRateBps,
}: {
  performance: PresetPerformance[]
  vaultRateBps: number | null
}) {
  const s = H.strategies
  return (
    <Reveal id="strategies" className="land-section" label={s.title}>
      <span className="section-label">{s.label}</span>
      <h2>{s.title}</h2>
      <p className="section-sub">{s.sub}</p>
      <Link className="section-link" href="/strategies">
        {s.all} <ArrowRight size={15} aria-hidden />
      </Link>
      <div className="platform-grid is-four">
        {PRESETS.slice(0, 4).map((p, index) => {
          const perf = performance.find((x) => x.id === p.id)
          const change = perf?.changePct ?? null
          return (
            <article
              key={p.id}
              className="platform-card strategy-card"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <span className="platform-meta">{p.suits}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <span className="platform-spec">
                {change === null ? (
                  s.noChange
                ) : (
                  <>
                    <span className={`change ${change >= 0 ? 'up' : 'down'}`}>
                      {change >= 0 ? '+' : ''}
                      {change.toFixed(1)}%
                    </span>
                    &nbsp;· {s.days(perf?.days ?? 30)}
                  </>
                )}
              </span>
              <div className="card-foot">
                <TokenStack symbols={Object.keys(p.weights)} size={22} max={4} />
                <Link href={`/agents/new?preset=${p.id}` as Route} className="start">
                  {s.start} →
                </Link>
              </div>
            </article>
          )
        })}
      </div>
      <DollarSplit vaultRateBps={vaultRateBps} />
    </Reveal>
  )
}

/* ── Check it yourself ── */

function CheckIt({ showcase }: { showcase: Showcase | null }) {
  const p = H.proof
  return (
    <Reveal id="check" className="land-section" label={p.label}>
      <span className="section-label">{p.label}</span>
      <h2>{p.title}</h2>
      <p className="section-sub">{p.sub}</p>
      <div className="platform-grid">
        {p.how.map((step, index) => (
          <article className="platform-card" key={step.title} style={{ transitionDelay: `${index * 90}ms` }}>
            <span className="platform-meta">
              <Fingerprint size={14} aria-hidden />
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
      <div className="proof-grid">
        <div className="proof-panel">
          <p className="panel-title">{p.recent}</p>
          {showcase && showcase.recent.length > 0 ? (
            <ul className="proof-list">
              {showcase.recent.map((r) => (
                <li key={r.seq}>
                  <Link href={`/agents/${showcase.slug}/decision/${r.seq}` as Route}>
                    <small>#{r.seq}</small>
                    <span className="text">
                      {r.outcome} · {r.summary}
                    </span>
                    <Fingerprint size={16} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="land-note">{p.none}</p>
          )}
        </div>
        <div className="proof-panel proof-os">
          <p className="panel-title">{p.runs}</p>
          {/* biome-ignore lint/performance/noImgElement: a small static brand mark, drawn as the theme asks */}
          <img src="/brand/openserv-logo-white-for-dark-bg.svg" alt="OpenServ" className="osc-dark" />
          {/* biome-ignore lint/performance/noImgElement: as above, for the light theme */}
          <img src="/brand/openserv-logo-black-for-light-bg.svg" alt="" className="osc-light" />
          <p>{appCopy.credit.line}</p>
          <nav>
            <a className="section-link" href={OPENSERV.agentUrl} target="_blank" rel="noreferrer">
              {onchainCopy.agent.label} #{OPENSERV.agentId} <ArrowUpRight size={15} aria-hidden />
            </a>
            <Link className="section-link" href="/compare">
              {appCopy.credit.compare} <ArrowRight size={15} aria-hidden />
            </Link>
            <Link className="section-link" href="/live">
              {appCopy.credit.live} <ArrowRight size={15} aria-hidden />
            </Link>
            <Link className="section-link" href="/status">
              {p.status} <ArrowRight size={15} aria-hidden />
            </Link>
          </nav>
        </div>
      </div>
    </Reveal>
  )
}

/* ── Get Shijima ── */

function GetSection({
  appHref,
  origin,
  bot,
  botLink,
  latest,
}: {
  appHref: string
  origin: string
  bot: string
  botLink: string
  latest: ChatLatest | null
}) {
  const g = H.get
  return (
    <Reveal id="get" className="get" label={g.label}>
      <span className="section-label">{g.label}</span>
      <h2>{g.title}</h2>
      <div className="get-grid">
        <article className="get-card">
          <div className="get-card-copy">
            <h3>{g.web.title}</h3>
            <p>{g.web.body}</p>
            <div className="get-actions">
              <Link className="get-pill" href={appHref as Route}>
                {g.web.open} <ArrowRight size={15} aria-hidden />
              </Link>
              <Link className="get-pill" href={SHOWCASE_ROUTE}>
                {g.web.watch}
              </Link>
            </div>
            <small>{g.web.small}</small>
          </div>
          <div className="get-qr">
            <Qr text={origin} label={g.web.qr} />
          </div>
          <div className="get-shot get-shot-phone">
            <MockScreen src={SHOWCASE_ROUTE} width={390} height={844} radius={18} maxHeight={396} />
          </div>
        </article>

        <article className="get-card">
          <div className="get-card-copy">
            <h3>{g.telegram.title}</h3>
            <p>{g.telegram.body}</p>
            <div className="get-actions">
              <a className="get-pill" href={botLink} target="_blank" rel="noreferrer">
                {g.telegram.open(bot)} <ArrowUpRight size={15} aria-hidden />
              </a>
            </div>
            <small>{g.telegram.small}</small>
          </div>
          <div className="get-qr">
            <Qr text={botLink} label={g.telegram.qr} />
          </div>
          <div className="get-shot get-shot-chat" aria-hidden inert>
            <TelegramChat bot={bot} link={botLink} latest={latest} />
          </div>
        </article>
      </div>
    </Reveal>
  )
}

/* ── Footer CTA ── */

function FooterCta({ appHref }: { appHref: string }) {
  const f = H.footerCta
  return (
    <Reveal className="footer-cta" label={f.title}>
      <Logo size={46} glow />
      <h2>{f.title}</h2>
      <p>{f.body}</p>
      <div className="hero-actions">
        <Link className="land-cta cta-sheen" href={appHref as Route}>
          {f.primary} <ArrowRight size={17} aria-hidden />
        </Link>
        <Link className="land-secondary" href={SHOWCASE_ROUTE}>
          {f.secondary}
        </Link>
      </div>
      <span className="mainnet-flag">{f.flag}</span>
    </Reveal>
  )
}

/**
 * The landing, in the reference landing's order (W12): the hero with the live agent's screen, the Built-on
 * marquee with the real marks, numbers and live prices, the three live screens, how the money moves,
 * then what is live on chain, the live agents, the strategies and how to check it, then Get Shijima and the
 * closing call. The nav pill and the footer come from the website shell.
 */
export function LandingPage({
  signedIn,
  showcase,
  latest,
  agents,
  weekendFact,
  performance,
  vaultRateBps,
  stats,
  prices,
  factory,
  origin,
  bot,
}: {
  signedIn: boolean
  showcase: Showcase | null
  latest: ChatLatest | null
  agents: PublicAgent[]
  weekendFact: string | null
  performance: PresetPerformance[]
  vaultRateBps: number | null
  stats: { trades: number; movedUsdg: string } | null
  prices: { symbol: string; price: string }[]
  factory: string
  origin: string
  bot: string
}) {
  const appHref = appHrefFor(signedIn)
  const botLink = `https://t.me/${bot || settingsCopy.telegram.bot}`
  return (
    <>
      <Hero appHref={appHref} />
      <BuiltOnStrip stats={stats} vaultRateBps={vaultRateBps} prices={prices} />
      <Platforms appHref={appHref} bot={bot} botLink={botLink} latest={latest} />
      <MoneyModel weekendFact={weekendFact} />
      <OnChainNow factory={factory} showcase={showcase} />
      <LiveAgents agents={agents} />
      <Strategies performance={performance} vaultRateBps={vaultRateBps} />
      <CheckIt showcase={showcase} />
      <GetSection appHref={appHref} origin={origin} bot={bot} botLink={botLink} latest={latest} />
      <FooterCta appHref={appHref} />
    </>
  )
}
