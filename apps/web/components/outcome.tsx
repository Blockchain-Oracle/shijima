import type { PublicDecision } from '@desk/db'

/** The nine outcomes of the record, in the owner's words. One place, so a colour and a word never disagree. */
const OUTCOMES = {
  acted: { label: 'Acted', tone: 'acted' },
  acted_in_part: { label: 'Acted in part', tone: 'acted' },
  waited: { label: 'Waited', tone: 'waited' },
  declined: { label: 'Declined', tone: 'waited' },
  nothing_to_do: { label: 'Nothing to do', tone: 'quiet' },
  blocked_by_limit: { label: 'Blocked by a limit', tone: 'blocked' },
  asked: { label: 'Asked you', tone: 'waited' },
  failed: { label: 'Failed', tone: 'blocked' },
  would_have_acted: { label: 'Would have acted', tone: 'acted' },
  not_executed: { label: 'Not carried out', tone: 'blocked' },
} as const satisfies Record<PublicDecision['outcome'], { label: string; tone: string }>

const TONES: Record<string, string> = {
  acted: 'text-acted',
  waited: 'text-waited',
  blocked: 'text-blocked',
  quiet: 'text-quiet',
}

export function outcomeLabel(outcome: PublicDecision['outcome']): string {
  return OUTCOMES[outcome].label
}

export function Outcome({ outcome, shadow }: { outcome: PublicDecision['outcome']; shadow?: boolean }) {
  const { label, tone } = OUTCOMES[outcome]
  return (
    <span className={`font-medium text-sm ${TONES[tone]}`}>
      {label}
      {shadow && outcome !== 'would_have_acted' ? (
        <span className="ml-1.5 text-ink-faint text-xs">practice</span>
      ) : null}
    </span>
  )
}
