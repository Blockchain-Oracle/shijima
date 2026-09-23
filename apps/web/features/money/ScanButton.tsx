'use client'

import { moneyCopy } from '@desk/shared'
import { ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '@/components/kit/sheet'

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector
  }
}

const ADDRESS = /0x[0-9a-fA-F]{40}/

/**
 * Scan an address QR code, as the reference phone app's Scan to pay (apps/mobile/src/MobileScan.tsx): the rear
 * camera in a sheet, frames never leave the device, and the first Robinhood Chain address it sees fills the field.
 * Where the browser has no QR reader, the sheet says so and the address can be pasted instead.
 */
export function ScanButton({ onAddress }: { onAddress: (address: string) => void }) {
  const c = moneyCopy.scan
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'ready' | 'blocked'>('idle')
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const start = async () => {
      if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
        setState('blocked')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const el = video.current
        if (!el || stopped) return
        el.srcObject = stream
        await el.play()
        setState('ready')
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stopped || !video.current) return
          const found = await detector.detect(video.current).catch(() => [])
          const hit = found.map((f) => f.rawValue.match(ADDRESS)?.[0]).find(Boolean)
          if (hit) {
            onAddress(hit)
            setOpen(false)
            return
          }
          frame = requestAnimationFrame(() => void tick())
        }
        void tick()
      } catch {
        setState('blocked')
      }
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      for (const t of stream?.getTracks() ?? []) t.stop()
    }
  }, [open, onAddress])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setState('idle')
          setOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: 999,
          border: '1px solid var(--bd)',
          background: 'var(--card)',
          color: 'var(--tx2)',
          fontSize: 10.5,
          fontFamily: 'var(--fm)',
          letterSpacing: '.06em',
          cursor: 'pointer',
        }}
      >
        <ScanLine aria-hidden="true" size={12} /> {c.button}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} label={c.title}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong style={{ fontSize: 17 }}>{c.title}</strong>
          <div
            style={{
              position: 'relative',
              minHeight: 285,
              borderRadius: 22,
              overflow: 'hidden',
              background: 'radial-gradient(125% 95% at 50% 38%, #181a20, #090a0d 72%)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <video
              ref={video}
              muted
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'relative',
                width: 184,
                height: 184,
                borderRadius: 14,
                border: '2.5px solid var(--ac2)',
                boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.35)',
              }}
            />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: state === 'blocked' ? 'var(--warn)' : 'var(--tx3)',
              lineHeight: 1.5,
            }}
          >
            {state === 'blocked' ? c.blocked : state === 'ready' ? c.ready : c.idle}
          </p>
        </div>
      </BottomSheet>
    </>
  )
}
