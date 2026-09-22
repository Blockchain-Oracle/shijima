'use client'

import { roomCopy } from '@desk/shared'
import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RoomSheet } from './RoomSheet'

/**
 * A Stock Token's standing Room, opened from its page: Agari's `TickerRoomButton`, the hero foot's `.mh-room`
 * control (mono caps, icon, "desk owners only" a step quieter), so it reads as the same door.
 */
export function RoomButton({ symbol, name }: { symbol: string; name: string }) {
  const [open, setOpen] = useState(false)
  // A take's "the Room" link lands here with #room, and the Room opens.
  useEffect(() => {
    if (window.location.hash === '#room') setOpen(true)
  }, [])
  return (
    <>
      <button type="button" className="mh-room" onClick={() => setOpen(true)} data-cursor="hover">
        <MessageCircle className="mh-room-icon" aria-hidden />
        {roomCopy.open(symbol)}
        <span className="mh-room-meta">{roomCopy.qualifier}</span>
      </button>
      {open && <RoomSheet symbol={symbol} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
