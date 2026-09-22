'use client'

import { Dialog } from '@base-ui/react/dialog'
import { roomCopy } from '@desk/shared'
import { LockIcon, SendIcon, XIcon } from 'lucide-react'
import React, { type CSSProperties, useEffect, useRef, useState } from 'react'
import { ROOM_BODY_MAX, shortAddress, timeAgo } from '@/features/social/protocol'
import { addressHue } from '@/lib/address-hue'
import { RoomMark, RoomStates } from './RoomStates'
import { useRoom } from './useRoom'

const HOLDS_KEY = 'shijima.room.holds'

function readHolds(): boolean {
  try {
    return window.localStorage.getItem(HOLDS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A Stock Token's Room, from Agari (`CommentRoom.tsx` and `MarketRoom.tsx`), for desk owners instead of bettors.
 *
 * It keeps Agari's two honesty departures from Masayume: it follows the theme, and it does not claim encryption.
 * The words are stored in the clear by Shijima, and the composer says so, with the one promise that matters here:
 * the desk's assistant never reads the Room.
 *
 * "Show that my desk holds it" is opt-in, remembered in this browser, and checked by the server against the
 * desk's latest valuation, so the badge cannot be claimed.
 */
function RoomInner({ symbol, name, onClose }: { symbol: string; name: string; onClose: () => void }) {
  const room = useRoom(symbol, true)
  const [draft, setDraft] = useState('')
  const [holds, setHolds] = useState(false)
  const [nowMs, setNowMs] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHolds(readHolds())
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line is exactly when the thread scrolls to the end
  useEffect(() => {
    if (room.gate === 'joined' && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [room.lines.length, room.gate])

  const send = () => {
    const text = draft.replace(/\s+/g, ' ').trim().slice(0, ROOM_BODY_MAX)
    if (!text || room.busy) return
    void room.post(text, holds)
    setDraft('')
  }

  const remaining = ROOM_BODY_MAX - draft.length

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="room-scrim" />
        <Dialog.Popup ref={sheetRef} initialFocus={sheetRef} className="room-sheet">
          <div className="room-hairline" aria-hidden />

          <div className="room-head">
            <span className="room-mark" aria-hidden>
              <RoomMark size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="room-title">{roomCopy.title(name)}</Dialog.Title>
              <div className="room-head-row">
                <div className="room-badge">
                  <LockIcon size={9} strokeWidth={2.4} /> {roomCopy.qualifier}
                </div>
              </div>
            </div>
            <Dialog.Close className="room-close" aria-label={roomCopy.close} data-cursor="hover">
              <XIcon size={16} />
            </Dialog.Close>
          </div>

          {room.gate !== 'joined' ? (
            <RoomStates gate={room.gate} onSignedIn={() => void room.refresh()} />
          ) : (
            <>
              <div ref={listRef} className="room-thread">
                {room.lines.length === 0 && <p className="room-empty">{roomCopy.empty}</p>}
                {room.lines.map((line) => (
                  <div key={line.id} className="room-line" data-mine={line.mine}>
                    <span
                      className="room-avatar"
                      style={{ '--room-hue': addressHue(line.author) } as CSSProperties}
                      aria-hidden
                    >
                      {line.author.slice(2, 4)}
                    </span>
                    <div className="room-bubble">
                      <div className="room-meta">
                        <span className="room-author" title={line.author}>
                          {line.mine ? roomCopy.you : shortAddress(line.author)}
                        </span>
                        {line.holds && <span className="room-holds-badge">{roomCopy.holdsBadge}</span>}
                        <span>{nowMs > 0 ? timeAgo(line.createdAtMs, nowMs) : ''}</span>
                      </div>
                      <p className="room-body">{line.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {room.error && <p className="room-error">{room.error}</p>}

              <label className="room-holds-toggle">
                <input
                  type="checkbox"
                  checked={holds}
                  onChange={(event) => {
                    setHolds(event.target.checked)
                    try {
                      window.localStorage.setItem(HOLDS_KEY, event.target.checked ? '1' : '0')
                    } catch {
                      // storage refused: the choice still holds for this sheet
                    }
                  }}
                />
                {roomCopy.holds(symbol)}
              </label>

              <form
                className="room-compose"
                onSubmit={(event) => {
                  event.preventDefault()
                  send()
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, ROOM_BODY_MAX))}
                  placeholder={roomCopy.compose}
                  aria-label={roomCopy.compose}
                  maxLength={ROOM_BODY_MAX}
                />
                <span className="room-count" data-low={remaining <= 40} aria-hidden>
                  {remaining}
                </span>
                <button
                  type="submit"
                  className="room-send"
                  disabled={room.busy || draft.trim().length === 0}
                  aria-label={room.busy ? roomCopy.sending : roomCopy.send}
                >
                  <SendIcon size={15} />
                </button>
              </form>
              <p className="room-where">{roomCopy.where}</p>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** If anything in the Room throws, a contained note appears and the page keeps working (Agari's boundary). */
class RoomErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error) {
    console.error('[room] crashed:', error?.message)
  }
  override render() {
    if (!this.state.error) return this.props.children
    return (
      <Dialog.Root open onOpenChange={(next) => !next && this.props.onClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="room-scrim" />
          <Dialog.Popup className="room-sheet">
            <Dialog.Title className="sr-only">{roomCopy.states.unavailable.title}</Dialog.Title>
            <RoomStates gate="unavailable" onSignedIn={() => undefined} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }
}

export function RoomSheet(props: { symbol: string; name: string; onClose: () => void }) {
  return (
    <RoomErrorBoundary onClose={props.onClose}>
      <RoomInner {...props} />
    </RoomErrorBoundary>
  )
}
