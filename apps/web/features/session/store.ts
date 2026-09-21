'use client'

import { del, get, set } from 'idb-keyval'
import type { Address, Hex } from 'viem'

/**
 * The browser's session key, from Masayume (`features/session/store.ts`): one key per owner, kept in IndexedDB.
 * It survives a reload, and clearing the site's data deletes it, by design. The desk contract bounds what it can
 * do, and it expires within seven days whatever happens here.
 */
export interface StoredSessionKey {
  address: Address
  privateKey: Hex
  desk: Address
  createdAtMs: number
}

const KEY_PREFIX = 'shijima.sessionKey.'
const keyFor = (owner: string, desk: string) => `${KEY_PREFIX}${owner.toLowerCase()}.${desk.toLowerCase()}`

export async function loadSessionKey(owner: string, desk: string): Promise<StoredSessionKey | null> {
  try {
    return (await get<StoredSessionKey>(keyFor(owner, desk))) ?? null
  } catch {
    return null
  }
}

export async function saveSessionKey(owner: string, key: StoredSessionKey): Promise<boolean> {
  try {
    await set(keyFor(owner, key.desk), key)
    return true
  } catch {
    return false
  }
}

export async function forgetSessionKey(owner: string, desk: string): Promise<void> {
  try {
    await del(keyFor(owner, desk))
  } catch {
    // nothing to forget where storage never worked
  }
}
