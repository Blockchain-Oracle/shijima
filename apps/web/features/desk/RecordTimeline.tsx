'use client'

import type { PublicDecision } from '@desk/db'
import { deskCopy } from '@desk/shared'
import {
  ArrowLeftRight,
  ChevronRight,
  Clock,
  Eye,
  Info,
  type LucideIcon,
  MessageCircleQuestion,
  Moon,
  ShieldAlert,
  X,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Route } from 'next'
import Link from 'next/link'
import { outcomeLabel } from '@/components/outcome'
import { TokenLogo } from '@/components/ui/token-logo'
import { cn } from '@/lib/utils'

/**
 * The record as a day-by-day timeline, after 21st's Activity Timeline (28340). Each outcome has one icon and one
 * colour, the same everywhere; a decision about a stock carries its logo; quiet runs fold into one line.
 */
export type TimelineItem =
  | {
      kind: 'decision'
      at: number
      outcome: PublicDecision['outcome']
      shadow: boolean
      summary: string
      href?: string
      symbol?: string | undefined
    }
  | { kind: 'quiet'; at: number; count: number; label: string; children: TimelineItem[] }
  | { kind: 'note'; at: number; label: string; summary: string }

const LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  acted: { icon: ArrowLeftRight, tone: 'text-[var(--profit)] bg-[var(--color-profit-wash)]' },
  acted_in_part: { icon: ArrowLeftRight, tone: 'text-[var(--profit)] bg-[var(--color-profit-wash)]' },
  acted_by_override: { icon: ArrowLeftRight, tone: 'text-[var(--profit)] bg-[var(--color-profit-wash)]' },
  would_have_acted: { icon: Eye, tone: 'text-[var(--color-accent)] bg-[var(--color-accent-wash)]' },
  waited: {
    icon: Clock,
    tone: 'text-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)]',
  },
  declined: { icon: X, tone: 'text-ink-secondary bg-[var(--color-surface-3)]' },
  asked: {
    icon: MessageCircleQuestion,
    tone: 'text-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)]',
  },
  nothing_to_do: { icon: Moon, tone: 'text-ink-muted bg-[var(--color-surface-3)]' },
  blocked_by_limit: { icon: ShieldAlert, tone: 'text-[var(--loss)] bg-[var(--color-loss-wash)]' },
  failed: { icon: ShieldAlert, tone: 'text-[var(--loss)] bg-[var(--color-loss-wash)]' },
  not_executed: { icon: ShieldAlert, tone: 'text-[var(--loss)] bg-[var(--color-loss-wash)]' },
}
const NOTE = { icon: Info, tone: 'text-ink-secondary bg-[var(--color-surface-3)]' }
const QUIET = LOOK.nothing_to_do as { icon: LucideIcon; tone: string }

const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
function dayLabel(t: number, now: number) {
  const k = dayKey(t)
  if (k === dayKey(now)) return deskCopy.record.today
  if (k === dayKey(now - 86_400_000)) return deskCopy.record.yesterday
  return new Date(t).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}
const clock = (t: number) =>
  new Date(t).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

function Dot({ look }: { look: { icon: LucideIcon; tone: string } }) {
  const Icon = look.icon
  return (
    <span
      className={cn(
        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--color-surface-1)]',
        look.tone,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  )
}

function Row({ item, index }: { item: TimelineItem; index: number }) {
  const reduced = useReducedMotion()
  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-20px' },
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const, delay: Math.min(index, 8) * 0.04 },
      }

  if (item.kind === 'quiet') {
    return (
      <motion.li {...motionProps} className="relative flex gap-3">
        <Dot look={QUIET} />
        <details className="group min-w-0 flex-1 pt-1">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
            {item.label}
            <span className="ml-auto font-[family-name:var(--font-data)] text-[11px]">{clock(item.at)}</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {item.children.map((c, i) => (
              <Row key={`${c.at}-${i}`} item={c} index={i} />
            ))}
          </ul>
        </details>
      </motion.li>
    )
  }

  const look = item.kind === 'note' ? NOTE : (LOOK[item.outcome] ?? NOTE)
  const title = item.kind === 'note' ? item.label : outcomeLabel(item.outcome)
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        {item.kind === 'decision' && item.shadow && item.outcome !== 'would_have_acted' && (
          <span className="rounded-full border border-border px-1.5 text-[10px] text-ink-muted">
            {deskCopy.record.practice}
          </span>
        )}
        {item.kind === 'decision' && item.symbol && <TokenLogo symbol={item.symbol} size={16} />}
        <span className="ml-auto shrink-0 font-[family-name:var(--font-data)] text-[11px] text-ink-muted">
          {clock(item.at)}
        </span>
      </div>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-secondary">{item.summary}</p>
    </>
  )
  return (
    <motion.li {...motionProps} className="relative flex gap-3">
      <Dot look={look} />
      {item.kind === 'decision' && item.href ? (
        <Link
          href={item.href as Route}
          className="-m-1.5 min-w-0 flex-1 rounded-[var(--radius-md)] p-1.5 transition-colors hover:bg-[var(--color-surface-2)]"
          data-cursor="hover"
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
    </motion.li>
  )
}

function Days({ items }: { items: TimelineItem[] }) {
  const now = Date.now()
  const groups: { key: string; label: string; items: TimelineItem[] }[] = []
  for (const it of items) {
    const key = dayKey(it.at)
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(it)
    else groups.push({ key, label: dayLabel(it.at, now), items: [it] })
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="mb-3 flex items-center gap-3">
            <span className="font-[family-name:var(--font-data)] text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
              {g.label}
            </span>
            <span className="h-px flex-1 bg-[var(--color-hairline)]" />
          </div>
          <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-[var(--color-hairline)]">
            {g.items.map((it, i) => (
              <Row key={`${it.kind}-${it.at}-${i}`} item={it} index={i} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

export function RecordTimeline({
  items,
  empty,
  earlier,
}: {
  items: TimelineItem[]
  empty: string
  earlier: { label: string; explorer: string; explorerLabel: string; items: TimelineItem[] } | null
}) {
  if (items.length === 0 && !earlier) return <p className="type-body text-ink-secondary">{empty}</p>
  return (
    <div className="flex flex-col gap-5">
      {items.length > 0 && <Days items={items} />}
      {earlier && (
        <details className="group rounded-[var(--radius-md)] border border-dashed border-border p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-ink-secondary hover:text-ink">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
            {earlier.label}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <Days items={earlier.items.slice(0, 40)} />
            <a
              href={earlier.explorer}
              target="_blank"
              rel="noreferrer"
              className="type-caption text-accent hover:underline"
            >
              {earlier.explorerLabel} ↗
            </a>
          </div>
        </details>
      )}
    </div>
  )
}
