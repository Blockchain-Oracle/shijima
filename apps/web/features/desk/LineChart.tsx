'use client'

import {
  AreaSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  LineSeries,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

export interface ChartPoint {
  /** Seconds since 1970. */
  time: number
  value: number
}

export interface ChartMarker {
  time: number
  kind: 'acted' | 'waited'
  text?: string
}

/** Yosuku's ink and accent, read from the page so the chart follows the theme. */
function palette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    line: v('--vermilion', '#CCFF00'),
    text: v('--gray-500', '#737373'),
    grid: v('--ms-hairline', 'rgba(255,255,255,0.1)'),
    reference: v('--gray-500', '#737373'),
    acted: v('--profit', '#34D399'),
    waited: v('--color-info', '#60A5FA'),
  }
}

/**
 * One line, drawn with lightweight-charts as Masayume draws its prices: an area under the line, an optional
 * reference line, and markers where the desk acted or waited. It redraws itself when the theme flips.
 */
export function LineChart({
  points,
  reference,
  markers = [],
  height = 220,
  format = (v: number) => `$${v.toFixed(2)}`,
}: {
  points: ChartPoint[]
  reference?: number | null
  markers?: ChartMarker[]
  height?: number
  format?: (value: number) => string
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el || points.length === 0) return
    let chart: IChartApi | undefined
    const draw = () => {
      chart?.remove()
      const c = palette()
      chart = createChart(el, {
        height,
        autoSize: true,
        layout: {
          attributionLogo: false,
          background: { color: 'transparent' },
          textColor: c.text,
          fontFamily: 'var(--font-data)',
        },
        grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        crosshair: { horzLine: { labelVisible: true }, vertLine: { labelVisible: true } },
        localization: { priceFormatter: format },
        handleScroll: false,
        handleScale: false,
      })
      const series = chart.addSeries(AreaSeries, {
        lineColor: c.line,
        topColor: `${c.line}33`,
        bottomColor: `${c.line}00`,
        lineWidth: 2,
        priceLineVisible: false,
      })
      series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
      if (reference !== undefined && reference !== null) {
        const ref = chart.addSeries(LineSeries, {
          color: c.reference,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        const first = points[0]
        const last = points.at(-1)
        if (first && last) {
          ref.setData([
            { time: first.time as UTCTimestamp, value: reference },
            { time: last.time as UTCTimestamp, value: reference },
          ])
        }
      }
      if (markers.length > 0) {
        const first = points[0]?.time ?? 0
        createSeriesMarkers(
          series,
          markers
            .filter((m) => m.time >= first)
            .sort((a, b) => a.time - b.time)
            .map(
              (m): SeriesMarker<Time> => ({
                time: m.time as UTCTimestamp,
                position: 'aboveBar',
                shape: m.kind === 'acted' ? 'arrowDown' : 'circle',
                color: m.kind === 'acted' ? c.acted : c.waited,
                ...(m.text ? { text: m.text } : {}),
              }),
            ),
        )
      }
      chart.timeScale().fitContent()
    }
    draw()
    // The theme is an attribute on <html>; a flip repaints the chart in the other palette.
    const watch = new MutationObserver(draw)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      watch.disconnect()
      chart?.remove()
    }
  }, [points, reference, markers, height, format])

  return <div ref={box} style={{ height }} className="w-full" />
}
