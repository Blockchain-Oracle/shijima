'use client'

import { appCopy } from '@desk/shared'
import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { askTurnsAction } from '@/app/ask-actions'
import { DeskChat } from '@/features/desk/DeskChat'
import { ShijimaMark } from '../ShijimaMark'
import type { SidebarAgent } from './types'

type Chat = NonNullable<Awaited<ReturnType<typeof askTurnsAction>>>

/**
 * Ask Shijima from anywhere in the app: a floating launcher in the bottom-right corner, or ⌘J, opens a chat
 * window above it, the way a support chat sits on a page. It talks to the agent on screen when it is the owner's,
 * otherwise to their first agent. It explains and proposes; nothing changes until the owner confirms.
 */
export function AskDrawer({ agents }: { agents: SidebarAgent[] }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  useEffect(() => {
    if (open) setEverOpened(true)
  }, [open])
  const [mounted, setMounted] = useState(false)
  const [chat, setChat] = useState<Chat | null>(null)
  const c = appCopy.ask

  const onScreen = agents.find(
    (a) =>
      pathname === `/agents/${a.slug}` ||
      pathname?.startsWith(`/agents/${a.slug}/`) ||
      pathname === `/agents/${a.id}`,
  )
  const target = onScreen ?? agents[0]

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    if (!open || !target) return
    if (chat?.slug === target.slug) return
    setChat(null)
    askTurnsAction(target.slug)
      .then(setChat)
      .catch(() => setChat(null))
  }, [open, target, chat?.slug])

  if (!mounted) return null
  return createPortal(
    <div className="ask-float">
      {/* Mounted from the first opening and kept: closing only hides it, so the conversation is still there. */}
      {everOpened && (
        <motion.div
          key="panel"
          role="dialog"
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
          <header className="ask-panel-head">
            <span className="ask-panel-mark logo-mark" aria-hidden="true">
              <ShijimaMark />
            </span>
            <div className="ask-panel-titles">
              <strong>{c.button}</strong>
              <span>{target ? target.name : c.noAgent}</span>
            </div>
            <button
              type="button"
              className="ask-panel-close"
              aria-label={c.close}
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="ask-panel-body">
            {!target ? (
              <p className="ask-panel-empty">{c.noAgent}</p>
            ) : chat ? (
              <DeskChat key={chat.deskId} deskId={chat.deskId} slug={chat.slug} initial={chat.turns} />
            ) : (
              <div className="ask-panel-loading" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </motion.div>
      )}

      <button
        type="button"
        className="ask-launcher logo-mark"
        data-open={open ? '' : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
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
