'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { Address } from 'viem'
import { type DeskSession, useDeskSession } from './useDeskSession'

interface DeskSessionContext {
  owner: string
  desk: Address
  contractVersion: string
  session: DeskSession
}

const Context = createContext<DeskSessionContext | null>(null)

/** One read of the desk's session key, shared by the key panel and every chain card on the page. */
export function DeskSessionProvider({
  owner,
  desk,
  contractVersion,
  children,
}: {
  owner: string
  desk: Address
  contractVersion: string
  children: ReactNode
}) {
  const session = useDeskSession(owner, desk, contractVersion)
  return <Context.Provider value={{ owner, desk, contractVersion, session }}>{children}</Context.Provider>
}

export function useDeskSessionContext(): DeskSessionContext | null {
  return useContext(Context)
}
