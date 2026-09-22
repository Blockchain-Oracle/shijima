'use client'

import { roomCopy } from '@desk/shared'
import { ArrowRightIcon, LoaderIcon, LockIcon, UnplugIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignInButton } from '@/components/shell/SignInButton'
import type { RoomGate } from '@/features/social/protocol'

/** The haloed mark that carries each onboarding state (Agari's `StateIcon`). */
function StateIcon({ children, tone = 'muted' }: { children: ReactNode; tone?: 'vermilion' | 'muted' }) {
  return (
    <div className="room-state-icon" data-tone={tone} aria-hidden>
      <span>{children}</span>
    </div>
  )
}

/** A locked speech bubble: "a private conversation" in one glyph (Agari's `RoomMark`). */
export function RoomMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.2 3.6h13.6A2.7 2.7 0 0 1 21.5 6.3v7A2.7 2.7 0 0 1 18.8 16H11l-4.3 3.5a.6.6 0 0 1-1-.47V16H5.2A2.7 2.7 0 0 1 2.5 13.3v-7A2.7 2.7 0 0 1 5.2 3.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="8.9" y="9.7" width="6.2" height="4.5" rx="1.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.4 9.7V8.4a1.6 1.6 0 0 1 3.2 0v1.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Everything before the thread: Agari's onboarding states. Each says what this is, why you cannot speak yet,
 * and what would change that. `null` is the first read, still on its way.
 */
export function RoomStates({
  gate,
  onSignedIn,
}: {
  gate: Exclude<RoomGate, 'joined'> | null
  onSignedIn: () => void
}) {
  if (gate === null) {
    return (
      <div className="room-state">
        <StateIcon>
          <LoaderIcon size={24} strokeWidth={1.8} className="animate-spin" />
        </StateIcon>
      </div>
    )
  }
  if (gate === 'unavailable') {
    return (
      <div className="room-state">
        <StateIcon>
          <UnplugIcon size={24} strokeWidth={1.8} />
        </StateIcon>
        <p className="room-state-title">{roomCopy.states.unavailable.title}</p>
        <p className="room-state-body">{roomCopy.states.unavailable.body}</p>
      </div>
    )
  }
  if (gate === 'connect') {
    return (
      <div className="room-state">
        <StateIcon>
          <RoomMark size={26} />
        </StateIcon>
        <p className="room-state-title">{roomCopy.states.connect.title}</p>
        <p className="room-state-body">{roomCopy.states.connect.body}</p>
        <SignInButton onSignedIn={onSignedIn} className="room-cta" />
      </div>
    )
  }
  return (
    <div className="room-state">
      <StateIcon>
        <LockIcon size={24} strokeWidth={1.8} />
      </StateIcon>
      <p className="room-state-title">{roomCopy.states.locked.title}</p>
      <p className="room-state-body">{roomCopy.states.locked.body}</p>
      <Link href="/strategies" className="room-cta" data-cursor="hover">
        {roomCopy.start} <ArrowRightIcon size={15} />
      </Link>
    </div>
  )
}
