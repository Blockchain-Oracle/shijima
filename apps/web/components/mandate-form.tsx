'use client'

import { percent } from '@desk/shared'
import { useState, useTransition } from 'react'
import { type ActionResult, applyMandateAction } from '@/app/actions'

interface Preset {
  id: string
  name: string
  description: string
  cashBps: number
  weights: Record<string, number>
}

/**
 * What the owner wants held, as a split that must add to 100%.
 *
 * Nobody faces an empty form: a preset fills it in and every number stays editable. The total is shown as it
 * is typed, because a mandate that does not add up is refused by the server and that should never be a surprise.
 */
export function MandateForm({
  deskId,
  presets,
  tokens,
}: {
  deskId: string
  presets: Preset[]
  tokens: { symbol: string; name: string }[]
}) {
  const [preset, setPreset] = useState<Preset | undefined>(presets[0])
  const [weights, setWeights] = useState<Record<string, number>>(presets[0]?.weights ?? {})
  const [cashBps, setCashBps] = useState(presets[0]?.cashBps ?? 10_000)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult>()

  const total = cashBps + Object.values(weights).reduce((a, b) => a + b, 0)
  const addsUp = total === 10_000

  const choose = (p: Preset) => {
    setPreset(p)
    setWeights(p.weights)
    setCashBps(p.cashBps)
  }

  const submit = (formData: FormData) => {
    formData.set('deskId', deskId)
    formData.set('weights', JSON.stringify(weights))
    formData.set('cashBps', String(cashBps))
    formData.set('preset', preset?.id ?? '')
    start(async () => setResult(await applyMandateAction(formData)))
  }

  if (result?.ok) return <p className="rounded-lg border border-acted p-4 text-acted">{result.message}</p>

  return (
    <form action={submit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-ink-faint text-xs">Start from one of these, then change anything</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                preset?.id === p.id ? 'border-accent text-accent' : 'border-line text-ink-soft'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {preset ? <p className="text-ink-soft text-sm">{preset.description}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-ink-soft text-sm uppercase tracking-wide">The split</span>
          <span className={`tabular text-sm ${addsUp ? 'text-ink-soft' : 'text-blocked'}`}>
            {percent(total)} of 100%
          </span>
        </div>
        <ul className="space-y-1">
          {tokens.map((t) => (
            <li key={t.symbol} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm">
                {t.name} <span className="text-ink-faint">{t.symbol}</span>
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={(weights[t.symbol] ?? 0) / 100}
                onChange={(e) =>
                  setWeights({ ...weights, [t.symbol]: Math.round(Number(e.target.value) * 100) })
                }
                className="tabular w-20 rounded-md border border-line bg-page px-2 py-1 text-right text-sm"
              />
              <span className="text-ink-faint text-sm">%</span>
            </li>
          ))}
          <li className="flex items-center gap-3 border-line border-t pt-2">
            <span className="w-40 shrink-0 text-sm">Kept as cash</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={cashBps / 100}
              onChange={(e) => setCashBps(Math.round(Number(e.target.value) * 100))}
              className="tabular w-20 rounded-md border border-line bg-page px-2 py-1 text-right text-sm"
            />
            <span className="text-ink-faint text-sm">%</span>
          </li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="driftToleranceBps" label="How far a holding may wander" value={300} suffix="bps" />
        <Field name="maxPositionBps" label="Largest any one holding may be" value={5000} suffix="bps" />
        <Field name="lossStopBps" label="Stop everything if it falls this far" value={1500} suffix="bps" />
        <Field name="perActionCap" label="Most it may spend in one action" value={5} suffix="USDG" />
        <Field name="dailyCap" label="Most it may spend in a day" value={15} suffix="USDG" />
        <Field name="largeAction" label="Ask me first above" value={100} suffix="USDG" />
      </div>

      <label className="block space-y-1">
        <span className="text-ink-faint text-xs">
          Anything else, in your own words. Recorded and shown to the assistant, never enforced on its own.
        </span>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-md border border-line bg-page px-2 py-1 text-sm"
          placeholder="Prefer waiting for Monday unless something is clearly wrong."
        />
      </label>

      <button
        type="submit"
        disabled={pending || !addsUp}
        className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent text-sm hover:bg-accent hover:text-surface disabled:opacity-50"
      >
        {pending ? 'Saving…' : addsUp ? 'Save and start in practice mode' : 'The split must add to 100%'}
      </button>
      {result && !result.ok ? <p className="text-blocked text-sm">{result.message}</p> : null}
    </form>
  )
}

function Field({
  name,
  label,
  value,
  suffix,
}: {
  name: string
  label: string
  value: number
  suffix: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-ink-faint text-xs">{label}</span>
      <span className="flex items-center gap-2">
        <input
          name={name}
          type="number"
          defaultValue={value}
          className="tabular w-24 rounded-md border border-line bg-page px-2 py-1 text-right text-sm"
        />
        <span className="text-ink-faint text-xs">{suffix}</span>
      </span>
    </label>
  )
}
