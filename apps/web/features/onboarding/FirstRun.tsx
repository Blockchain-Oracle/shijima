'use client'

import { firstRunCopy as C } from '@desk/shared'
import { Volume2, VolumeX } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Route } from 'next'
import Link from 'next/link'
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Button, buttonStyle } from '@/components/kit'
import { hapticTap } from '@/components/kit/gestures'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import './first-run.css'
import { useWelcomeSound } from './sound'
import { ConnectStep, CreateStep, GiftStep, HowStep, WelcomeStep } from './steps'
import { TOUR_EVENT } from './tour'

const SEEN = 'shijima.firstRun.v1'
const STEPS = ['welcome', 'how', 'connect', 'gift', 'create'] as const
const LAST = STEPS.length - 1
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The first-run tour, after the reference wallet's intro flow (packages/ui/src/onboarding.tsx): Continue-paced
 * steps that never move on by themselves, Skip on every one, swipe and the arrow keys to move, a haptic tick per
 * step, and a chime on the first press. It opens once per browser for someone with no agent yet, and again from
 * Settings. Escape closes it; focus stays inside while it is open and goes back where it was after.
 */
export function FirstRun({ signedInAs, hasAgents }: { signedInAs: string | undefined; hasAgents: boolean }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const panel = useRef<HTMLElement>(null)
  const startX = useRef<number | null>(null)
  const reduced = useReducedMotion()
  const sound = useWelcomeSound(open)

  // Nothing renders until storage is read, so a returning visitor never sees a frame of it; storage that throws
  // (a private window) just means the tour shows.
  useEffect(() => {
    let seen = false
    try {
      seen = window.localStorage.getItem(SEEN) !== null
    } catch {}
    if (!seen && !hasAgents) setOpen(true)
    const reopen = () => {
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(TOUR_EVENT, reopen)
    return () => window.removeEventListener(TOUR_EVENT, reopen)
  }, [hasAgents])

  const close = useCallback(() => {
    setOpen(false)
    try {
      window.localStorage.setItem(SEEN, String(Date.now()))
    } catch {}
  }, [])

  const go = useCallback((next: number) => {
    setIndex((current) => {
      const clamped = Math.max(0, Math.min(LAST, next))
      if (clamped !== current) {
        setDirection(clamped > current ? 1 : -1)
        hapticTap()
      }
      return clamped
    })
  }, [])

  // Focus moves in when it opens and back when it closes; the page behind stops scrolling.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'Tab') {
      const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    if (e.target !== panel.current) return
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
  }

  // A swipe moves a step, except on the gift's own slider, which is dragged the same way.
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const onSlider = (e.target as HTMLElement).closest('.gift-slider')
    startX.current = onSlider ? null : e.clientX
    if (!(e.target as HTMLElement).closest('[data-sound]')) sound.play()
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (dx < -45) go(index + 1)
    else if (dx > 45) go(index - 1)
  }

  if (!open || typeof document === 'undefined') return null

  const step = STEPS[index] ?? 'welcome'
  const body: Record<(typeof STEPS)[number], ReactNode> = {
    welcome: <WelcomeStep />,
    how: <HowStep />,
    connect: <ConnectStep signedInAs={signedInAs} />,
    gift: <GiftStep signedInAs={signedInAs} onFund={close} />,
    create: <CreateStep />,
  }
  const shift = reduced ? 0 : 28
  // While the step's own sign-in button is the thing to press, Continue steps back to secondary.
  const waiting = !signedInAs && (step === 'connect' || step === 'gift')

  return createPortal(
    <div className="first-run-layer">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={C.aria}
        tabIndex={-1}
        className="first-run"
        onKeyDown={onKeyDown}
        onKeyDownCapture={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (!(e.target as HTMLElement).closest('[data-sound]')) sound.play()
          }
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="first-run-grabber" aria-hidden="true" />
        <header className="first-run-head">
          <span className="first-run-brand">
            <span className="kit-brand-tile logo-mark">
              <ShijimaMark />
            </span>
            {C.brand}
          </span>
          <span className="first-run-count">{C.step(index + 1, STEPS.length)}</span>
          <span className="first-run-tools">
            <button
              type="button"
              data-sound
              className="first-run-icon"
              aria-pressed={!sound.muted}
              aria-label={sound.muted ? C.soundOff : C.soundOn}
              title={sound.muted ? C.soundOff : C.soundOn}
              onClick={sound.toggle}
            >
              {sound.muted ? <VolumeX /> : <Volume2 />}
            </button>
            <button type="button" className="first-run-skip" onClick={close}>
              {C.skip}
            </button>
          </span>
        </header>
        <div className="first-run-bar" aria-hidden="true">
          <span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="first-run-body" aria-live="polite">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              style={{ width: '100%', margin: 'auto 0' }}
              initial={{ opacity: 0, x: direction * shift }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -shift }}
              transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.2, 0.9, 0.24, 1] }}
            >
              {body[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="first-run-foot">
          <div className="first-run-dots" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} data-on={i === index || undefined} />
            ))}
          </div>
          {index === LAST ? (
            <div className="first-run-actions first-run-actions--stack">
              <Link href={'/agents/new' as Route} style={buttonStyle('primary', true)} onClick={close}>
                {C.create.cta}
              </Link>
              <Button variant="secondary" fullWidth onClick={close}>
                {C.create.later}
              </Button>
            </div>
          ) : (
            <div className="first-run-actions">
              {index > 0 ? (
                <Button variant="secondary" onClick={() => go(index - 1)}>
                  {C.back}
                </Button>
              ) : null}
              <Button fullWidth variant={waiting ? 'secondary' : 'primary'} onClick={() => go(index + 1)}>
                {index === 0 ? C.start : C.next}
              </Button>
            </div>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  )
}
