'use client'

import { ago, inboxCopy } from '@desk/shared'
import { Bell } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { type InboxItem, inboxAction, markInboxReadAction } from '@/app/owner-actions'
import { useFloatingMenus } from './useFloatingMenus'

/**
 * The bell: what the desk told the owner, the same messages Telegram carries, for owners who are here instead.
 * The count comes with the page; the list is read when the bell opens.
 */
export function HeaderInbox({ unread }: { unread: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const refs = useRef([ref]).current
  useFloatingMenus(refs, close)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) setItems(await inboxAction().catch(() => []))
  }
  const readAll = async () => {
    await markInboxReadAction()
    setItems((all) => all?.map((i) => ({ ...i, read: true })) ?? null)
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inbox-bell"
        aria-label={inboxCopy.aria(unread)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => void toggle()}
        data-cursor="hover"
      >
        <Bell aria-hidden="true" />
        {unread > 0 && <span className="inbox-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="header-account-menu inbox-menu" role="menu">
          <div className="inbox-head">
            <span className="type-label-micro text-ink-muted">{inboxCopy.title}</span>
            {unread > 0 && (
              <button type="button" className="type-caption text-accent" onClick={() => void readAll()}>
                {inboxCopy.markRead}
              </button>
            )}
          </div>
          {items === null ? null : items.length === 0 ? (
            <p className="inbox-empty type-caption text-ink-muted">{inboxCopy.empty}</p>
          ) : (
            <ul className="inbox-list">
              {items.map((item) => {
                const href = (
                  item.symbol
                    ? `/stock/${item.symbol}`
                    : item.decisionSeq === null
                      ? `/agents/${item.deskId}`
                      : `/agents/${item.deskId}/decision/${item.decisionSeq}`
                ) as Route
                return (
                  <li key={item.id}>
                    <Link
                      href={href}
                      className={item.read ? 'inbox-item' : 'inbox-item is-unread'}
                      role="menuitem"
                      onClick={close}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="type-label-micro text-ink-muted">
                          {inboxCopy.kinds[item.kind as keyof typeof inboxCopy.kinds] ?? item.kind} ·{' '}
                          {item.deskName}
                        </span>
                        <span className="type-caption text-ink-muted">{ago(new Date(item.at))}</span>
                      </span>
                      <span className="type-caption text-ink-secondary">{item.text}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
