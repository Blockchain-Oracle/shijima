/**
 * What the web app is allowed to know about the chain: which contracts are ours, and where to read.
 *
 * It reads. It holds no key and signs nothing. Every transaction that moves money is signed by the owner in
 * their own wallet, or by the worker's operator key, and both are bounded by the desk contract itself.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OFFICIAL_RPC } from '@desk/chain'
import type { Address } from 'viem'

export interface Deployment {
  version: string
  factory: Address
  implementation: Address
  operator: Address
}

let cached: Deployment | undefined

/** The contracts this site treats as its own. A desk that is not a clone of this implementation is refused. */
export function currentDeployment(): Deployment {
  if (cached) return cached
  const file = process.env.DEPLOYMENTS_FILE ?? resolve(process.cwd(), '../../packages/chain/deployments.json')
  const all = JSON.parse(readFileSync(file, 'utf8')) as Record<
    string,
    { factory: Address; implementation: Address } | string
  >
  const version = all.current as string
  const d = all[version]
  if (typeof d !== 'object') throw new Error(`deployments.json has no entry for "${version}"`)
  const operator = process.env.OPERATOR_ADDRESS as Address | undefined
  if (!operator)
    throw new Error('OPERATOR_ADDRESS is missing. The site needs to know which operator is ours.')
  cached = { version, factory: d.factory, implementation: d.implementation, operator }
  return cached
}

/** Reads only. An Alchemy key is not needed here, and deliberately not given to this process. */
export const rpcUrl = (): string => process.env.RPC_URL ?? OFFICIAL_RPC
