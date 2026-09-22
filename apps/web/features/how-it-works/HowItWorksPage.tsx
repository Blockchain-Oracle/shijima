import { EXPLORER } from '@desk/chain'
import { howCopy } from '@desk/shared'
import { ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Scale, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import {
  type Card,
  CHAIN,
  FAQS,
  FEES,
  LANES,
  MODES,
  ORDER,
  REFUSES,
  SESSION_WORDS,
  SPLIT,
  STEPS,
  TOKEN_ADDRESSES,
  WITHDRAW_STEPS,
} from './content'
import { Faq } from './Faq'
import { riseDelay } from './rise'

/** The anchor the disclosure and settings link to [8.22]. */
export const WITHDRAW_ANCHOR = 'withdraw-without-us'

/**
 * /how-it-works, on Agari's page (`features/how-it-works/HowItWorksPage.tsx`), section for section: back link,
 * hero, getting started, a worked example, the market clock (Agari's SessionLanes, rewritten for Stock Tokens),
 * key mechanics, the process, the architecture, the asides, the FAQ and the call to action. The content is the
 * brief's: how the desk decides [8.21] and how to withdraw without this website [8.22].
 *
 * Only classes Agari's stylesheet already defines are used, so nothing can drift from the source.
 */
export function HowItWorksPage({
  weekendFact,
  desks,
}: {
  /** A real weekend move from the price log, or null before the log holds a full weekend. */
  weekendFact: string | null
  /** The signed-in owner's desks, so the escape hatch can link straight to theirs. */
  desks: readonly { name: string; address: string }[]
}) {
  const sec = howCopy.sections
  return (
    <div className="hiw">
      <div className="hiw-glows" aria-hidden>
        <div className="hiw-glow-mint" />
        <div className="hiw-glow-blue" />
      </div>

      <div className="hiw-main">
        <div className="hiw-wrap">
          <Link href="/markets" className="hiw-back" data-cursor="hover">
            <ArrowLeft className="hiw-back-arrow" aria-hidden />
            {howCopy.back}
          </Link>

          <header className="hiw-hero hiw-rise">
            <h1 className="hiw-title">{howCopy.title}</h1>
            <p className="hiw-lead">{howCopy.lead}</p>
          </header>

          <section className="hiw-section" aria-label={sec.steps}>
            <h2 className="hiw-label">{sec.steps}</h2>
            <div className="hiw-grid">
              {STEPS.map((step, index) => (
                <article key={step.number} className="hiw-card hiw-rise" style={riseDelay(index)}>
                  <div className="hiw-step">
                    <span className="hiw-num" data-tone={step.tone} aria-hidden>
                      {step.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="hiw-card-title" data-tone={step.tone}>
                        <step.icon aria-hidden />
                        {step.title}
                      </h3>
                      <p className="hiw-body">{step.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Example />
          <Clock weekendFact={weekendFact} />

          <section className="hiw-section" aria-label={sec.split}>
            <h2 className="hiw-label">{sec.split}</h2>
            <div className="hiw-grid">
              {SPLIT.map((item, index) => (
                <IconCard key={item.title} card={item} style={riseDelay(index, 400)} />
              ))}
            </div>
          </section>

          <section className="hiw-section" aria-label={sec.modes}>
            <h2 className="hiw-label">{sec.modes}</h2>
            <div className="hiw-card hiw-card-wide hiw-fees hiw-rise" style={riseDelay(0, 450)}>
              {MODES.map((mode) => (
                <div key={mode.title}>
                  <h3 className="hiw-fee-title">{mode.title}</h3>
                  <p className="hiw-body">{mode.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="hiw-section" id="how-the-desk-decides" aria-label={sec.order}>
            <h2 className="hiw-label">{sec.order}</h2>
            <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(0, 500)}>
              <ol className="hiw-steps">
                {ORDER.map((step, index) => (
                  <li key={step.label} className="contents">
                    <div className="flex items-start gap-4">
                      <span className="hiw-step-num" aria-hidden>
                        {index + 1}
                      </span>
                      <div>
                        <div className="hiw-step-label">
                          {step.label}
                          <span className="ml-2 type-label-micro text-ink-muted">{step.kind}</span>
                        </div>
                        <div className="hiw-body">{step.desc}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <Judgment />

          <section className="hiw-section" aria-label={sec.refuses}>
            <h2 className="hiw-label">{sec.refuses}</h2>
            <div className="hiw-card hiw-card-wide hiw-fees hiw-rise" style={riseDelay(0, 550)}>
              {REFUSES.map((aside) => (
                <div key={aside.title}>
                  <div className="hiw-card-head">
                    <span className="hiw-icon" aria-hidden>
                      <aside.icon />
                    </span>
                    <h3 className="hiw-fee-title" style={{ marginBottom: 0 }}>
                      {aside.title}
                    </h3>
                  </div>
                  <p className="hiw-body">{aside.body}</p>
                </div>
              ))}
            </div>
            <p className="hiw-foot">
              <Link href="/status" className="text-accent hover:underline" data-cursor="hover">
                {howCopy.refuses.statusLink}
              </Link>
            </p>
          </section>

          <Chain />
          <Withdraw desks={desks} />

          <section className="hiw-section" aria-label={sec.fee}>
            <h2 className="hiw-label">{sec.fee}</h2>
            <div className="hiw-card hiw-card-wide hiw-fees hiw-rise" style={riseDelay(0, 600)}>
              {FEES.map((fee) => (
                <div key={fee.title}>
                  <h3 className="hiw-fee-title">{fee.title}</h3>
                  <p className="hiw-body">{fee.body}</p>
                </div>
              ))}
            </div>
          </section>

          <Faq faqs={FAQS} />

          <section
            className="hiw-card hiw-card-mint hiw-cta hiw-rise"
            style={riseDelay(0, 700)}
            aria-label={howCopy.cta.title}
          >
            <h2 className="hiw-cta-title">{howCopy.cta.title}</h2>
            <p className="hiw-cta-body">{howCopy.cta.body}</p>
            <Link href="/strategies" className="hiw-cta-button" data-cursor="hover">
              {howCopy.cta.action}
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}

function IconCard({ card, style, tone }: { card: Card; style: React.CSSProperties; tone?: 'blue' }) {
  return (
    <article className={`hiw-card hiw-rise${tone ? ' hiw-card-blue' : ''}`} style={style}>
      <div className="hiw-card-head">
        <span className="hiw-icon" data-tone={tone} aria-hidden>
          <card.icon />
        </span>
        <h3 className="hiw-card-title" style={{ marginBottom: 0 }}>
          {card.title}
        </h3>
      </div>
      <p className="hiw-body">{card.body}</p>
    </article>
  )
}

/** Agari's payout example, carrying the $10,000 example: the arithmetic part, and the one call left over. */
function Example() {
  const e = howCopy.example
  return (
    <section
      className="hiw-section hiw-card hiw-card-wide hiw-card-mint hiw-rise"
      style={riseDelay(4)}
      aria-label={howCopy.sections.example}
    >
      <h2 className="hiw-label">{howCopy.sections.example}</h2>
      <p className="hiw-example-tag">{e.tag}</p>
      <div className="hiw-example-grid">
        {e.figures.map((f, i) => (
          <div key={f.label}>
            <div className="hiw-figure" data-tone={i === 0 ? 'mint' : undefined}>
              {f.value}
            </div>
            <div className="hiw-figure-label">{f.label}</div>
          </div>
        ))}
      </div>
      <div className="hiw-example-row">
        <span>{e.start}</span>
        <span className="hiw-chip">{e.startChip}</span>
        <ArrowRight aria-hidden />
        <span>{e.middle}</span>
        <ArrowRight aria-hidden />
        <span>{e.end}</span>
        <span className="hiw-chip">{e.endChip}</span>
      </div>
      <p className="hiw-foot">{e.foot}</p>
    </section>
  )
}

/** Agari's SessionLanes, with Stock Tokens' clock: three lanes, the five words, and what the shut hours mean. */
function Clock({ weekendFact }: { weekendFact: string | null }) {
  const c = howCopy.clock
  const points = [weekendFact, c.shutPoints.noEdge, c.shutPoints.band, c.shutPoints.hourly].filter(
    (p): p is string => Boolean(p),
  )
  return (
    <section className="hiw-section" aria-label={howCopy.sections.clock}>
      <h2 className="hiw-label">
        <CalendarClock aria-hidden />
        {howCopy.sections.clock}
      </h2>
      <p className="hiw-body" style={{ marginBottom: 16 }}>
        {c.lead}
      </p>

      <div className="hiw-grid hiw-arch">
        {LANES.map((lane, index) => (
          <article key={lane.title} className="hiw-card hiw-rise" style={riseDelay(index, 250)}>
            <div className="hiw-card-head">
              <span className="hiw-icon" aria-hidden>
                <lane.icon />
              </span>
              <h3 className="hiw-card-title" style={{ marginBottom: 0 }}>
                {lane.title}
              </h3>
            </div>
            <p className="hiw-example-tag">{lane.clock}</p>
            <p className="hiw-body">{lane.body}</p>
          </article>
        ))}
      </div>

      <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(3, 250)}>
        <h3 className="hiw-fee-title">{c.wordsTitle}</h3>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {c.wordsBody}
        </p>
        <dl className="hiw-params">
          {SESSION_WORDS.map(([word, meaning]) => (
            <div key={word}>
              <dt>{word}</dt>
              <dd>: {meaning}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className="hiw-card hiw-card-wide hiw-card-mint hiw-rise"
        style={{ ...riseDelay(4, 250), marginTop: 16 }}
      >
        <h3 className="hiw-fee-title">{c.shutTitle}</h3>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {c.shutBody}
        </p>
        <ol className="hiw-steps">
          {points.map((point, index) => (
            <li key={point} className="contents">
              <div className="flex items-start gap-4">
                <span className="hiw-step-num" aria-hidden>
                  {index + 1}
                </span>
                <div className="hiw-body">{point}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Agari's "How a Price Is Made" card: a paragraph, a formula box, a parameter grid and a closing note. */
function Judgment() {
  const j = howCopy.judgment
  return (
    <section className="hiw-section" aria-label={howCopy.sections.judgment}>
      <h2 className="hiw-label">
        <Scale aria-hidden />
        {howCopy.sections.judgment}
      </h2>
      <div className="hiw-card hiw-card-wide hiw-rise" style={riseDelay(0, 450)}>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {j.body}
        </p>
        <figure className="hiw-formula" style={{ margin: 0 }} aria-label={howCopy.sections.judgment}>
          {j.formula.map((line) => (
            <span key={line} className="whitespace-pre">
              {line}
            </span>
          ))}
        </figure>
        <dl className="hiw-params">
          {Object.values(j.params).map(([key, meaning]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>: {meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="hiw-foot">{j.foot}</p>
        <p className="hiw-foot" style={{ marginTop: 12 }}>
          <Link href="/compare" className="text-accent hover:underline" data-cursor="hover">
            {j.compareLink}
          </Link>
        </p>
      </div>
    </section>
  )
}

/** Agari's "On-Chain Architecture": two cards side by side and one across. */
function Chain() {
  const [first, second, third] = CHAIN
  return (
    <section className="hiw-section" aria-label={howCopy.sections.chain}>
      <h2 className="hiw-label hiw-label-blue">
        <ShieldCheck aria-hidden />
        {howCopy.sections.chain}
      </h2>
      <div className="hiw-grid hiw-arch">
        {[first, second].map((card, index) =>
          card ? <IconCard key={card.title} card={card} style={riseDelay(index, 500)} tone="blue" /> : null,
        )}
      </div>
      {third && <IconCard card={third} style={riseDelay(2, 500)} tone="blue" />}
    </section>
  )
}

/** The escape hatch [8.22]: short, calm, step by step, with every address the call can take. */
function Withdraw({ desks }: { desks: readonly { name: string; address: string }[] }) {
  const w = howCopy.withdraw
  return (
    <section className="hiw-section" id={WITHDRAW_ANCHOR} aria-label={howCopy.sections.withdraw}>
      <h2 className="hiw-label">{howCopy.sections.withdraw}</h2>
      <div className="hiw-card hiw-card-wide hiw-card-mint hiw-rise" style={riseDelay(0, 550)}>
        <p className="hiw-body" style={{ marginBottom: 24 }}>
          {w.body}
        </p>
        <ol className="hiw-steps">
          {WITHDRAW_STEPS.map((step, index) => (
            <li key={step.label} className="contents">
              <div className="flex items-start gap-4">
                <span className="hiw-step-num" aria-hidden>
                  {index + 1}
                </span>
                <div>
                  <div className="hiw-step-label">{step.label}</div>
                  <div className="hiw-body">{step.desc}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {desks.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {desks.map((d) => (
              <li key={d.address}>
                <a
                  href={`${EXPLORER}/address/${d.address}?tab=write_proxy`}
                  className="inline-flex items-center gap-2 text-accent text-sm hover:underline"
                  rel="noreferrer noopener"
                  target="_blank"
                  data-cursor="hover"
                >
                  {w.yourDesk}: {d.name}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="hiw-foot">{w.foot}</p>
      </div>

      <div className="hiw-card hiw-card-wide hiw-rise" style={{ ...riseDelay(1, 550), marginTop: 16 }}>
        <h3 className="hiw-fee-title">{w.tokensTitle}</h3>
        <dl className="hiw-params" style={{ marginTop: 16 }}>
          {TOKEN_ADDRESSES.map(([name, address]) => (
            <div key={address} className="min-w-0">
              <dt>{name}</dt>
              <dd className="break-all font-mono" style={{ display: 'block', marginTop: 2 }}>
                {address}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
