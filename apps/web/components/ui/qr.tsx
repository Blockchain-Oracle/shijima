'use client'

import qrcode from 'qrcode-generator'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/** A QR code as plain SVG squares, so nothing is ever injected into the page as HTML. */
export function Qr({ text, label, className }: { text: string; label: string; className?: string }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    const dark: [number, number][] = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([c, r])
    return { n, dark }
  }, [text])
  return (
    <svg
      className={cn('settings-qr', className)}
      viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      {cells.dark.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#141210" />
      ))}
    </svg>
  )
}
