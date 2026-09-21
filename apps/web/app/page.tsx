import { sharedDesks } from '@desk/db'
import { ago } from '@desk/shared'
import Link from 'next/link'
import { LegacyFrame } from '@/components/legacy-frame'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const desks = await sharedDesks(db())
  return (
    <LegacyFrame>
      <div className="space-y-10">
        <section className="space-y-4">
          <h1 className="font-semibold text-2xl tracking-tight">
            Own US stocks from your digital dollars, and let a desk watch them while the market sleeps.
          </h1>
          <p className="max-w-2xl text-ink-soft leading-relaxed">
            You decide what to hold and your limits. The desk checks every hour. Plain arithmetic works out
            what has drifted, an assistant decides only whether now is a good moment or whether to wait, and
            your limits are enforced by the network itself. Every decision is written down, including the
            times it did nothing, and each one is fingerprinted on the public network so it cannot be
            rewritten later.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-ink-soft text-sm uppercase tracking-wide">Watch a real desk</h2>
          {desks.length === 0 ? (
            <p className="text-ink-soft text-sm">No desk has been shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {desks.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/desk/${d.shareSlug}`}
                    className="block rounded-lg border border-line bg-surface p-4 hover:border-accent"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-medium">{d.name ?? 'A desk'}</span>
                      <span className="text-ink-faint text-xs">
                        {d.startedAt ? `running since ${ago(d.startedAt)}` : 'not started'}
                      </span>
                    </div>
                    <p className="mt-1 text-ink-soft text-sm">
                      {d.mode === 'shadow'
                        ? 'In practice mode: it decides for real and spends nothing.'
                        : d.mode === 'ask_first'
                          ? 'It asks before it acts.'
                          : 'It acts on its own, inside the limits.'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LegacyFrame>
  )
}
