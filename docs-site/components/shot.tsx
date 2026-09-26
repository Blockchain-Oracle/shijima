'use client';

import { useEffect, useRef, useState } from 'react';

type GuidePoint = { x: number; y: number; label: string };
type TimedPoint = GuidePoint & { at: number };
type ShotProps = { name: string; alt: string; caption: string; lightOnly?: boolean };
type ClipProps = { name: string; caption: string };

// Coordinates point to controls in the captured UI, as percentages of each image.
const shotGuides: Record<string, GuidePoint[]> = {
  'start/sign-in-picker': [
    { x: 39, y: 49, label: 'Check which browser wallets were found.' },
    { x: 40, y: 63, label: 'Use WalletConnect for a phone wallet.' },
  ],
  'start/first-agent-strategy': [
    { x: 39, y: 48, label: 'Search or filter the strategies.' },
    { x: 45, y: 56, label: 'Select a basket and read its preview.' },
    { x: 67, y: 92, label: 'Continue to Amount.' },
  ],
  'start/first-agent-amount': [
    { x: 31, y: 14, label: 'Enter or pick an amount.' },
    { x: 49, y: 30, label: 'Check what that amount buys.' },
    { x: 28, y: 36, label: 'Choose Practice to start with no money.' },
  ],
  'start/first-agent-limits': [
    { x: 31, y: 26, label: 'Set the maximum per trade.' },
    { x: 55, y: 26, label: 'Set the maximum per day.' },
    { x: 49, y: 43, label: 'Open More options for the agent rules.' },
  ],
  'start/first-agent-review-unsigned': [
    { x: 44, y: 32, label: 'Review the strategy, amount and limits.' },
    { x: 48, y: 48, label: 'Connect your wallet before creation.' },
  ],
  'start/live-or-practice-practice': [
    { x: 28, y: 46, label: 'The starting amount becomes zero.' },
    { x: 28, y: 58, label: 'Select Practice with no money.' },
    { x: 80, y: 45, label: 'The preview confirms Practice.' },
  ],
  'money/wallet-overview': [
    { x: 32, y: 67, label: 'See what your agents hold.' },
    { x: 73, y: 62, label: 'See tokens in your own wallet.' },
    { x: 88, y: 73, label: 'Use the money actions below.' },
  ],
  'agent/limits-in-use': [
    { x: 76, y: 34, label: 'Compare recent spending with the daily cap.' },
    { x: 76, y: 40, label: 'Check room before the loss stop.' },
    { x: 76, y: 51, label: 'Read All limits for the full mandate.' },
  ],
  'agent/record-list': [
    { x: 42, y: 33, label: 'Filter by outcome.' },
    { x: 51, y: 38, label: 'Filter by Stock Token.' },
    { x: 39, y: 47, label: 'Choose Live or Practice records.' },
    { x: 46, y: 66, label: 'Open a decision to see its evidence.' },
  ],
  'agent/record-proof': [
    { x: 79, y: 37, label: 'See the public network transaction.' },
    { x: 35, y: 50, label: 'Press Check it in your browser.' },
    { x: 54, y: 57, label: 'Compare the matching fingerprints.' },
  ],
  'agent/copy-unavailable': [
    { x: 86, y: 19, label: 'Open Copy this agent.' },
    { x: 45, y: 55, label: 'Check whether the owner allows copying.' },
  ],
};

const clipGuides: Record<string, TimedPoint[]> = {
  'start/sign-in': [
    { at: 0, x: 50, y: 39, label: 'Press Connect wallet.' },
    { at: 4.7, x: 51, y: 55, label: 'The picker shows the available wallet paths.' },
  ],
  'start/first-agent': [
    { at: 0, x: 47, y: 22, label: 'Pick a strategy.' },
    { at: 1, x: 52, y: 16, label: 'Set the amount or choose Practice.' },
    { at: 3, x: 51, y: 23, label: 'Set the spending limits.' },
    { at: 6, x: 64, y: 25, label: 'Review before connecting a wallet.' },
  ],
};

function Pins({ points, active }: { points: GuidePoint[]; active?: number }) {
  if (points.length === 0) return null;

  return <div className="walkthrough-pins" aria-hidden="true">
    {points.map((point, index) => active === undefined || active === index ? (
      <span className="walkthrough-pin" style={{ left: `${point.x}%`, top: `${point.y}%` }} key={index}>
        <span>{index + 1}</span>
        <svg viewBox="0 0 40 40" focusable="false"><path d="M20 20 35 35m-7 0h7v-7" /></svg>
      </span>
    ) : null)}
  </div>;
}

function GuideLegend({ points, active }: { points: GuidePoint[]; active?: number }) {
  if (points.length === 0) return null;

  return <ol className="walkthrough-guide">
    {points.map((point, index) => (
      <li className={active === index ? 'walkthrough-guide-active' : undefined} aria-current={active === index ? 'step' : undefined} key={index}>
        <span aria-hidden="true">{index + 1}</span>{point.label}
      </li>
    ))}
  </ol>;
}

export function Shot({ name, alt, caption, lightOnly = false }: ShotProps) {
  const points = shotGuides[name] ?? [];

  return (
    <figure className="walkthrough-shot not-prose">
      <div className="walkthrough-media">
        <img className={lightOnly ? undefined : 'walkthrough-light'} src={`/walkthrough/${name}-light.png`} width={lightOnly ? 2624 : 1440} height={lightOnly ? 1200 : 900} alt={alt} loading="lazy" decoding="async" />
        {!lightOnly && <img className="walkthrough-dark" src={`/walkthrough/${name}-dark.png`} width={1440} height={900} alt={alt} loading="lazy" decoding="async" />}
        <Pins points={points} />
      </div>
      <GuideLegend points={points} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Clip({ name, caption }: ClipProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const points = clipGuides[name] ?? [];
  const active = Math.max(0, points.findLastIndex((point) => time >= point.at));

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (motion.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  return (
    <figure className="walkthrough-clip not-prose">
      <div className="walkthrough-media">
        <video ref={video} muted loop playsInline controls preload="metadata" width={1280} height={800} poster={`/walkthrough/${name}-poster.png`} aria-label={caption} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onSeeked={(event) => setTime(event.currentTarget.currentTime)}>
          <source src={`/walkthrough/${name}.webm`} type="video/webm" />
          <source src={`/walkthrough/${name}.mp4`} type="video/mp4" />
        </video>
        <Pins points={points} active={active} />
      </div>
      <GuideLegend points={points} active={active} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
