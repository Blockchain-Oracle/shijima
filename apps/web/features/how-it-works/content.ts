import { APPROVED_TOKENS, EXPLORER, USDG, VAULT } from '@desk/chain'
import { COST_MULTIPLE, MIN_TRADE_USDG } from '@desk/core'
import { GO_LIVE_CHECKS } from '@desk/db'
import { howCopy, type Session, usd, webCopy } from '@desk/shared'
import {
  Ban,
  CalendarClock,
  Clock,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Layers3,
  type LucideIcon,
  MessageSquare,
  Moon,
  OctagonPause,
  Shield,
  ShieldAlert,
  Sun,
  Target,
  Wallet,
} from 'lucide-react'
import { initialDraft } from '@/features/strategies/draft'

/**
 * The page's content as data, as Agari keeps it (`features/how-it-works/content.ts`), with its icons. The words
 * are in `howCopy`; every number the code decides is read here from the code that decides it.
 */

export type Tone = 'mint' | 'blue'
export interface Card {
  title: string
  body: string
  icon: LucideIcon
}
export interface Step extends Card {
  number: number
  tone: Tone
}
export interface OrderStep {
  label: string
  kind: string
  desc: string
}

const draft = initialDraft()
const dollars = (n: string) => `$${n}`

export const STEPS: readonly Step[] = [
  {
    number: 1,
    title: howCopy.steps.basket.title,
    body: howCopy.steps.basket.body(APPROVED_TOKENS.length),
    icon: Layers3,
    tone: 'mint',
  },
  {
    number: 2,
    title: howCopy.steps.limits.title,
    body: howCopy.steps.limits.body(dollars(draft.perAction), dollars(draft.daily)),
    icon: Shield,
    tone: 'blue',
  },
  { number: 3, ...howCopy.steps.create, icon: Wallet, tone: 'mint' },
  { number: 4, ...howCopy.steps.talk, icon: MessageSquare, tone: 'blue' },
]

export const LANES: readonly (Card & { clock: string })[] = [
  { title: howCopy.clock.lanes.open.name, ...howCopy.clock.lanes.open, icon: Sun },
  { title: howCopy.clock.lanes.edges.name, ...howCopy.clock.lanes.edges, icon: Clock },
  { title: howCopy.clock.lanes.shut.name, ...howCopy.clock.lanes.shut, icon: Moon },
]

/** The same five words the session chip uses, each with what it means. */
export const SESSION_WORDS: readonly [string, string][] = (
  ['regular', 'extended', 'overnight', 'weekend', 'holiday'] as const satisfies readonly Session[]
).map((s) => [webCopy.session.words[s], howCopy.clock.words[s]])

export const SPLIT: readonly Card[] = [
  { ...howCopy.split.basket, icon: Target },
  { ...howCopy.split.limits, icon: Shield },
  { ...howCopy.split.timing, icon: CalendarClock },
  { ...howCopy.split.record, icon: FileCheck2 },
]

export const MODES: readonly { title: string; body: string }[] = [
  { title: howCopy.modes.shadow.title, body: howCopy.modes.shadow.body(GO_LIVE_CHECKS) },
  howCopy.modes.askFirst,
  howCopy.modes.onItsOwn,
]

const k = howCopy.order.kinds
const o = howCopy.order.steps
export const ORDER: readonly OrderStep[] = [
  { ...o.read, kind: k.arithmetic },
  { ...o.value, kind: k.arithmetic },
  { label: o.drift.label, kind: k.arithmetic, desc: o.drift.desc(COST_MULTIPLE, usd(MIN_TRADE_USDG)) },
  { ...o.refuse, kind: k.rule },
  { ...o.ask, kind: k.judgment },
  { ...o.recheck, kind: k.arithmetic },
  { ...o.act, kind: k.mode },
  { ...o.write, kind: k.record },
]

export const REFUSES: readonly Card[] = [
  { ...howCopy.refuses.halted, icon: OctagonPause },
  { ...howCopy.refuses.band, icon: ShieldAlert },
  { ...howCopy.refuses.data, icon: DatabaseZap },
  { ...howCopy.refuses.never, icon: Ban },
]

export const CHAIN: readonly Card[] = [
  { ...howCopy.chain.own, icon: KeyRound },
  { ...howCopy.chain.limits, icon: Shield },
  { ...howCopy.chain.fingerprint, icon: Fingerprint },
]

const explorerHost = EXPLORER.replace(/^https:\/\//, '')
const w = howCopy.withdraw.steps
export const WITHDRAW_STEPS: readonly { label: string; desc: string }[] = [
  { label: w.open.label, desc: w.open.desc(explorerHost) },
  w.write,
  w.call,
  w.confirm,
]

/** Every address the withdraw call can take: the desk's cash first, then the Stock Tokens it may hold. */
export const TOKEN_ADDRESSES: readonly [string, string][] = [
  [howCopy.withdraw.usdg, USDG],
  [howCopy.withdraw.vault, VAULT],
  ...APPROVED_TOKENS.map((t): [string, string] => [`${t.symbol} · ${t.displayName}`, t.address]),
]

export const FEES: readonly { title: string; body: string }[] = [
  howCopy.fee.yearly,
  howCopy.fee.perTrade,
  howCopy.fee.network,
]

const f = howCopy.faq
export const FAQS: readonly { question: string; answer: string }[] = [
  f.predict,
  f.custody,
  f.gone,
  f.token,
  f.sees,
  f.awake,
  { q: f.practice.q, a: f.practice.a(GO_LIVE_CHECKS) },
  f.vault,
  f.override,
].map(({ q, a }) => ({ question: q, answer: a }))
