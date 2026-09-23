'use client'

import { appCopy } from '@desk/shared'
import { Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { askTurnsAction } from '@/app/ask-actions'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DeskChat } from '@/features/desk/DeskChat'
import type { SidebarAgent } from './types'

type Chat = NonNullable<Awaited<ReturnType<typeof askTurnsAction>>>

/**
 * Ask Shijima from anywhere in the app: ✦ in the top bar, or ⌘J. It talks to the agent on screen when it is the
 * owner's, otherwise to their first agent. The same chat as on the agent's page: it explains and proposes, and
 * nothing changes until the owner confirms.
 */
export function AskDrawer({ agents }: { agents: SidebarAgent[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [chat, setChat] = useState<Chat | null>(null)
  const c = appCopy.ask

  const onScreen = agents.find(
    (a) =>
      pathname === `/agents/${a.slug}` ||
      pathname?.startsWith(`/agents/${a.slug}/`) ||
      pathname === `/agents/${a.id}`,
  )
  const target = onScreen ?? agents[0]

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" className="ask-trigger" onClick={() => setOpen(true)} aria-keyshortcuts="Meta+J">
        <Sparkles aria-hidden="true" className="size-4" />
        <span>{c.button}</span>
        <kbd>⌘J</kbd>
      </button>
      <SheetContent side="right" className="ask-sheet">
        <SheetHeader>
          <SheetTitle>{target ? c.title(target.name) : c.button}</SheetTitle>
          <SheetDescription className="sr-only">{c.note}</SheetDescription>
        </SheetHeader>
        <div className="ask-body">
          {!target ? (
            <p className="ov-muted">{c.noAgent}</p>
          ) : chat ? (
            <DeskChat key={chat.deskId} deskId={chat.deskId} slug={chat.slug} initial={chat.turns} />
          ) : (
            <p className="ov-muted">…</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
