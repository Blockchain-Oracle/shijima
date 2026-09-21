/**
 * A price never renders without saying where it came from and how old it is. That is a product promise, so it
 * is enforced by the component taking those as required arguments rather than by anyone remembering.
 */
import { ago } from '@desk/shared'

export function Price({
  value,
  source,
  at,
  now,
}: {
  value: string
  source: string
  at: Date | string
  now?: Date
}) {
  const when = typeof at === 'string' ? new Date(at) : at
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="tabular font-medium">{value}</span>
      <span className="text-ink-faint text-xs">
        {source} · {ago(when, now)}
      </span>
    </span>
  )
}
