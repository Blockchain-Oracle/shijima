'use client'

import {
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  LineSeries,
  LineStyle,
  LineType,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { DeskMark, Point } from '@/lib/markets.server'
import { cn } from '@/lib/utils'

/**
 * Agari's hero chart (`features/markets/hero/PriceChart.client.tsx`): one ink line on a transparent ground,
 * hairline rows, no crosshair. Two things are ours. The reference is a dashed STEPPED line, because a new
 * reference is set at every close and a flat line would lie about the older part of the chart. And the
 * markers are what shared desks did; clicking one opens that decision's reasons.
 *
 * Colours and the font come from the chart's own container at mount, and it redraws when the theme flips.
 */
export function PriceChart({
  points,
  marks = [],
  referenceLabel,
  ariaLabel,
  decimals = 2,
  className,
}: {
  points: Point[]
  marks?: DeskMark[]
  referenceLabel: string
  ariaLabel: string
  decimals?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const el = box.current
    if (!el || points.length < 2) return
    let chart: IChartApi | undefined
    const draw = () => {
      chart?.remove()
      const css = getComputedStyle(el)
      const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
      chart = createChart(el, {
        autoSize: true,
        layout: {
          background: { color: 'transparent' },
          textColor: v('--color-ink-muted', '#737373'),
          fontFamily: v('--font-data', 'monospace'),
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: v('--color-hairline', 'rgba(128,128,128,0.15)') },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        crosshair: { mode: CrosshairMode.Hidden },
        handleScroll: false,
        handleScale: false,
      })
      const priceFormat = { type: 'price' as const, precision: decimals, minMove: 1 / 10 ** decimals }
      const reference = chart.addSeries(LineSeries, {
        color: v('--color-ink-muted', '#737373'),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lineType: LineType.WithSteps,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        title: referenceLabel,
        priceFormat,
      })
      reference.setData(
        points.flatMap((p) =>
          p.reference === null ? [] : [{ time: p.time as UTCTimestamp, value: p.reference }],
        ),
      )
      const line = chart.addSeries(LineSeries, {
        color: v('--color-ink', '#f5f5f5'),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat,
      })
      line.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))

      if (marks.length > 0) {
        const acted = v('--vermilion', '#e04d26')
        const quiet = v('--gray-500', '#737373')
        createSeriesMarkers(
          line,
          [...marks]
            .sort((a, b) => a.time - b.time)
            .map(
              (m): SeriesMarker<Time> => ({
                id: m.id,
                time: m.time as UTCTimestamp,
                position: m.kind === 'acted' && m.side === 'buy' ? 'belowBar' : 'aboveBar',
                shape:
                  m.kind === 'acted'
                    ? m.side === 'buy'
                      ? 'arrowUp'
                      : 'arrowDown'
                    : m.kind === 'waited'
                      ? 'circle'
                      : 'square',
                color: m.kind === 'acted' ? acted : quiet,
                size: m.kind === 'acted' ? 1.2 : 0.8,
              }),
            ),
        )
        const byId = new Map(marks.map((m) => [m.id, m]))
        const hovered = (p: MouseEventParams<Time>) => {
          const id = p.hoveredInfo?.objectId ?? p.hoveredObjectId
          return typeof id === 'string' ? byId.get(id) : undefined
        }
        chart.subscribeClick((p) => {
          const mark = hovered(p)
          if (mark) router.push(mark.href as Route)
        })
        chart.subscribeCrosshairMove((p) => {
          el.style.cursor = hovered(p) ? 'pointer' : ''
        })
      }
      chart.timeScale().fitContent()
    }
    draw()
    const watch = new MutationObserver(draw)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      watch.disconnect()
      chart?.remove()
    }
  }, [points, marks, referenceLabel, decimals, router])

  return <div ref={box} role="img" aria-label={ariaLabel} className={cn('h-full w-full', className)} />
}
