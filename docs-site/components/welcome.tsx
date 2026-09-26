import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bot, ChevronRight, ShieldCheck, Wallet } from 'lucide-react';
import { Brand } from './brand';
import { Logo } from './logo';
import { appUrl } from '@/lib/site';
import mapStyles from './product-map.module.css';

/** A link into the app, opened in a new tab. */
export function AppLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={appUrl(href)} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} className="inline-icon" />
    </a>
  );
}

export function WelcomeActions() {
  return (
    <div className="welcome-actions not-prose">
      <Link href="/start/first-agent" className="primary-link">
        Create your first agent <ArrowRight size={17} />
      </Link>
      <Link href="/architecture/overview" className="secondary-link">
        How it is built
      </Link>
    </div>
  );
}

/** OpenServ's real mark, sized like the Lucide icons beside it. */
function OpenServMark({ size }: { size?: number | string; 'aria-hidden'?: 'true' }) {
  return <Logo name="openserv" size={Number(size ?? 22)} label />;
}

const journeys = [
  { title: 'Create your first agent', short: 'Start', description: 'Sign in, pick a strategy, set limits, go live or practise.', href: '/start/first-agent', icon: Bot },
  { title: 'Move money in and out', short: 'Money', description: 'Fund from any chain, withdraw to your wallet, get gas.', href: '/money/wallet', icon: Wallet },
  { title: 'Check what it can and cannot do', short: 'Safety', description: 'The limits the contract holds, and the honest worst case.', href: '/security/what-it-can-do', icon: ShieldCheck },
  { title: 'See how it runs on OpenServ', short: 'OpenServ', description: 'The hourly workflow, SERV Reasoning and your own workspace.', href: '/openserv/how-shijima-uses-it', icon: OpenServMark },
];

export function JourneyList() {
  return (
    <div className="journey-list not-prose">
      {journeys.map(({ icon: Icon, ...j }) => (
        <Link key={j.href} href={j.href} className="journey-row">
          <span className="journey-icon">
            <Icon size={22} />
          </span>
          <span>
            <strong>{j.title}</strong>
            <span className="journey-description">{j.description}</span>
          </span>
          <ChevronRight size={19} />
        </Link>
      ))}
    </div>
  );
}

export function ProductMap() {
  return (
    <div className={`product-map not-prose ${mapStyles.root}`}>
      <div className={`asset-brand ${mapStyles.brand}`}>
        <Brand small />
      </div>
      <nav className={`map-paths ${mapStyles.paths}`} aria-label="Explore Shijima">
        {journeys.map(({ icon: Icon, ...journey }) => (
          <Link href={journey.href} key={journey.href} className={mapStyles.journey}>
            <span className={`map-icon ${mapStyles.icon}`}>
              <Icon size={28} aria-hidden="true" />
            </span>
            <strong>{journey.short}</strong>
          </Link>
        ))}
      </nav>
      <div className={`map-connector ${mapStyles.connector}`} aria-hidden="true" />
      <Link className={`map-foundation ${mapStyles.foundation}`} href="/architecture/overview">
        <span className={mapStyles.foundationLabel}>Underneath all four</span>
        <span className={mapStyles.foundationParts}>
          <span>
            Your own account <b aria-hidden="true">·</b> Robinhood Chain
          </span>
          <span>A record anyone can check</span>
        </span>
        <ArrowRight size={18} className={mapStyles.foundationArrow} aria-hidden="true" />
      </Link>
    </div>
  );
}
