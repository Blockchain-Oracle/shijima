'use client'

import { appCopy } from '@desk/shared'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { askTurnsAction } from '@/app/ask-actions'
import { useSheetDrag } from '@/components/kit/gestures'
import { DeskChat } from '@/features/desk/DeskChat'
import { ShijimaMark } from '../ShijimaMark'
import type { SidebarAgent } from './types'

type Chat = NonNullable<Awaited<ReturnType<typeof askTurnsAction>>>

/**
 * Ask Shijima from anywhere in the app: a floating launcher in the bottom-right corner, or ⌘J, opens a chat
 * window above it, the way a support chat sits on a page. It talks to the agent on screen when it is the owner's,
 * otherwise to their first agent. It explains and proposes; nothing changes until the owner confirms.
 */
export function AskDrawer({
  agents,
  signedInAs,
}: {
  agents: SidebarAgent[]
  signedInAs?: string | undefined
}) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const drag = useSheetDrag(() => setOpen(false))
  const [everOpened, setEverOpened] = useState(false)
  useEffect(() => {
    if (open) setEverOpened(true)
  }, [open])
  const [mounted, setMounted] = useState(false)
  const [chat, setChat] = useState<Chat | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [problem, setProblem] = useState(false)
  const [retry, setRetry] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const [viewport, setViewport] = useState<{ height: number; keyboard: number; width: number } | null>(null)
  const mobile = viewport ? viewport.width <= 640 : false
  const c = appCopy.ask

  const onScreen = agents.find(
    (a) =>
      pathname === `/agents/${a.slug}` ||
      pathname?.startsWith(`/agents/${a.slug}/`) ||
      pathname === `/agents/${a.id}`,
  )
  const target =
    selected === 'explore' ? undefined : (agents.find((a) => a.slug === selected) ?? onScreen ?? agents[0])
  const targetSlug = target?.slug

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey)) {
        if (document.querySelector('[aria-modal="true"]')) return
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    if (!open) return
    const focus = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>('.ask-panel-close:not(.ask-sheet-expand)')?.focus(),
    )
    return () => {
      cancelAnimationFrame(focus)
      launcher.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || !mobile) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (event: KeyboardEvent) => {
      if (!panel.current?.contains(event.target as Node)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
      if (event.key === 'Tab') {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]',
        )
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key, true)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', key, true)
    }
  }, [open, mobile])

  useEffect(() => {
    const measure = () => {
      const v = window.visualViewport
      setViewport({
        height: v?.height ?? window.innerHeight,
        width: window.innerWidth,
        keyboard: v ? Math.max(0, window.innerHeight - v.height - v.offsetTop) : 0,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry intentionally reloads history
  useEffect(() => {
    if (!everOpened) return
    let cancelled = false
    setChat(null)
    setProblem(false)
    if (!signedInAs) return
    askTurnsAction(targetSlug)
      .then((next) => {
        if (!cancelled) {
          setChat(next)
          setProblem(!next)
        }
      })
      .catch(() => {
        if (!cancelled) setProblem(true)
      })
    return () => {
      cancelled = true
    }
  }, [everOpened, targetSlug, signedInAs, retry])

  if (!mounted) return null
  return createPortal(
    <div
      className="ask-float"
      data-open={open || undefined}
      data-expanded={expanded || undefined}
      data-keyboard={(viewport && viewport.keyboard > 80) || undefined}
      style={
        viewport
          ? ({
              '--ask-vh': `${viewport.height}px`,
              '--ask-keyboard': `${viewport.keyboard}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {open && mobile && (
        <button
          type="button"
          className="ask-backdrop"
          aria-label="Close Ask Shijima"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
      {/* Mounted from the first opening and kept: closing only hides it, so the conversation is still there. */}
      {everOpened && (
        <div
          className="ask-sheet-shell"
          data-open={open || undefined}
          style={mobile ? drag.sheetStyle : undefined}
        >
          <motion.div
            key="panel"
            ref={panel}
            id="shijima-assistant"
            role="dialog"
            aria-modal={mobile && open ? true : undefined}
            aria-label={target ? c.title(target.name) : c.button}
            className="ask-panel"
            aria-hidden={!open}
            inert={!open}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={
              open
                ? { opacity: 1, y: 0, scale: 1, visibility: 'visible' as const }
                : {
                    opacity: 0,
                    ...(reduce ? {} : { y: 12, scale: 0.97 }),
                    transitionEnd: { visibility: 'hidden' as const },
                  }
            }
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              className="ask-sheet-handle"
              aria-label="Resize Ask Shijima"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              {...drag.handlers}
            >
              <span aria-hidden="true" />
            </button>
            <header className="ask-panel-head">
              <span className="ask-panel-mark logo-mark" aria-hidden="true">
                <ShijimaMark />
              </span>
              <div className="ask-panel-titles">
                <strong>{c.button}</strong>
                <span>
                  {target
                    ? target.name
                    : signedInAs
                      ? 'Tokens, strategies & your first agent'
                      : 'Explore tokens · sign in for AI'}
                </span>
              </div>
              <button
                type="button"
                className="ask-sheet-expand ask-panel-close"
                aria-label={expanded ? 'Collapse conversation' : 'Expand conversation'}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <ChevronDown className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="size-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="ask-panel-close"
                aria-label={c.close}
                onClick={() => setOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>
            {agents.length > 0 && (
              <div className="ask-context">
                <label htmlFor="ask-context">Talking about</label>
                <select
                  id="ask-context"
                  value={targetSlug ?? 'explore'}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="explore">Explore Shijima</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="ask-panel-body">
              {!signedInAs ? (
                <DeskChat key="visitor" initial={[]} signedIn={false} />
              ) : chat ? (
                <DeskChat
                  key={`${signedInAs}:${targetSlug ?? 'explore'}`}
                  deskId={chat.deskId}
                  slug={chat.slug}
                  initial={chat.turns}
                />
              ) : problem ? (
                <div className="ask-panel-empty" role="alert">
                  <p>Couldn’t load your conversation.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setRetry((n) => n + 1)}>
                    Try again
                  </button>
                </div>
              ) : (
                <div className="ask-panel-loading" role="status" aria-label="Loading your conversation">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <button
        ref={launcher}
        type="button"
        className="ask-launcher logo-mark"
        data-open={open ? '' : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="shijima-assistant"
        aria-keyshortcuts="Meta+J"
        aria-label={open ? c.close : c.button}
        title={`${c.button} · ⌘J`}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <ShijimaMark />}
      </button>
    </div>,
    document.body,
  )
}
