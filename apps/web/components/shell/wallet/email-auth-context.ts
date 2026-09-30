'use client'

import type { ConnectedWallet } from '@privy-io/react-auth'
import { createContext, useContext } from 'react'

export type EmailAuth = {
  enabled: boolean
  ready: boolean
  authenticated: boolean
  email: string | undefined
  wallets: ConnectedWallet[]
  accounts: { address: string; embedded: boolean }[]
  sendCode: (email: string) => Promise<void>
  verifyCode: (code: string) => Promise<void>
  prepareWallet: () => Promise<void>
  prepareLink: (address: string) => Promise<void>
  finish: (address: string, link?: boolean) => Promise<void>
  logout: () => Promise<void>
}
const unavailable = async () => {
  throw new Error('Email sign-in is not configured yet. You can connect a wallet.')
}
export const EmailContext = createContext<EmailAuth>({
  enabled: false,
  ready: false,
  authenticated: false,
  email: undefined,
  wallets: [],
  accounts: [],
  sendCode: unavailable,
  verifyCode: unavailable,
  prepareWallet: unavailable,
  prepareLink: unavailable,
  finish: unavailable,
  logout: async () => {},
})
export const useEmailAuth = () => useContext(EmailContext)
