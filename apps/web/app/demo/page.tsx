import type { Metadata } from 'next'
import Link from 'next/link'
import '@/styles/demo.css'

const title = 'Watch Shijima work'
const description =
  'The narrated walkthrough: a free dollar, your own agent, a real decision checked on Robinhood Chain, and how it all runs on OpenServ.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/demo' },
  openGraph: {
    title,
    description,
    images: [{ url: '/demo/cover.png', width: 1672, height: 941, alt: title }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/demo/cover.png'] },
}

/** The narrated film on YouTube. Played through the no-cookie player, so watching sets no tracking cookie. */
const FILM_ID = 'XLl5Exzo3KI'

const clips = [
  {
    name: 'sign-in',
    number: '01',
    title: 'Sign in with your wallet',
    description: 'Open the wallet picker and see the sign-in step. Signing in does not move money.',
    duration: '11 seconds',
  },
  {
    name: 'first-agent',
    number: '02',
    title: 'Set up your agent',
    description:
      'Move through Strategy, Amount, Limits and Review. The recording stops before creating or funding an agent.',
    duration: '8 seconds',
  },
] as const

export default function DemoPage() {
  return (
    <div className="sh-demo">
      <header className="sh-demo-hero">
        <p className="sh-demo-kicker">
          The Shijima demo <span>·</span> Robinhood Chain mainnet
        </p>
        <h1>Watch Shijima work.</h1>
        <p className="sh-demo-lead">
          The whole walkthrough, from a free dollar to a real trade you can check yourself. Then open the live
          decision below and verify its proof on chain.
        </p>
        <div className="sh-demo-film">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${FILM_ID}?rel=0`}
            title="Shijima: the demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <div className="sh-demo-hero-links">
          <a
            href={`https://www.youtube.com/watch?v=${FILM_ID}`}
            target="_blank"
            rel="noreferrer"
            className="sh-demo-primary"
          >
            Watch on YouTube <span aria-hidden>↗</span>
          </a>
          <a href="#proof" className="sh-demo-secondary">
            See the real proof <span aria-hidden>↘</span>
          </a>
        </div>
      </header>

      <section id="watch" className="sh-demo-section" aria-labelledby="sh-demo-watch-title">
        <div className="sh-demo-section-heading">
          <p className="sh-demo-kicker">01 / Screen recordings</p>
          <h2 id="sh-demo-watch-title">The first two steps, up close.</h2>
          <p>Two short clips from the film, for a closer look at signing in and setting up an agent.</p>
        </div>
        <div className="sh-demo-clips">
          {clips.map((clip) => (
            <figure className="sh-demo-clip" key={clip.name}>
              <video
                controls
                playsInline
                preload="metadata"
                poster={`/demo/${clip.name}-poster.png`}
                aria-label={clip.title}
              >
                <source src={`/demo/${clip.name}.webm`} type="video/webm" />
                <source src={`/demo/${clip.name}.mp4`} type="video/mp4" />
                Your browser cannot play this recording.
              </video>
              <figcaption>
                <span className="sh-demo-clip-number">{clip.number}</span>
                <div>
                  <h3>{clip.title}</h3>
                  <p>{clip.description}</p>
                </div>
                <span className="sh-demo-duration">{clip.duration}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="proof" className="sh-demo-section sh-demo-proof" aria-labelledby="sh-demo-proof-title">
        <div className="sh-demo-section-heading">
          <p className="sh-demo-kicker">02 / Follow a real decision</p>
          <h2 id="sh-demo-proof-title">The part you can check yourself.</h2>
          <p>
            Shijima records what it saw, why SERV chose the timing, and what actually happened on chain. These
            links use the public showcase agent.
          </p>
        </div>
        <div className="sh-demo-proof-grid">
          <Link href="/agents/showcase/decision/22" className="sh-demo-proof-card">
            <span>01 · Read the decision</span>
            <strong>Why it bought Nvidia</strong>
            <p>See the four timing choices, the reasons, the limits check and the Check it button.</p>
            <b>Open decision ↗</b>
          </Link>
          <a
            href="https://robinhoodchain.blockscout.com/tx/0x0384d7636143c86344217ac6d279b60e9d9418b5864052a1c3b605c591481e4b"
            target="_blank"
            rel="noreferrer"
            className="sh-demo-proof-card"
          >
            <span>02 · Check the chain</span>
            <strong>Find the confirmed trade</strong>
            <p>The decision hash and the trade appear in the same Robinhood Chain transaction.</p>
            <b>Open Blockscout ↗</b>
          </a>
          <Link href="/live" className="sh-demo-proof-card">
            <span>03 · Watch it run</span>
            <strong>See the live record</strong>
            <p>Open recent checks, trades, SERV calls and OpenServ runs as they are recorded.</p>
            <b>Open live page ↗</b>
          </Link>
        </div>
      </section>

      <div className="sh-demo-end">
        <p>Wall Street closes. Your agent doesn’t.</p>
        <Link href="/agents/new" className="sh-demo-primary">
          Create your agent <span aria-hidden>↗</span>
        </Link>
      </div>
    </div>
  )
}
