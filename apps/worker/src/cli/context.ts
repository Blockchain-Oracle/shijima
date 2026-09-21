/** What every worker command needs: checked env, the right database, chain clients, and the dev desk. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type DeskState, makePublicClient, OFFICIAL_RPC, readDeskState } from '@desk/chain'
import { createDb, type DeskRow, databaseName, registerDesk } from '@desk/db'
import { hasSchema } from '@desk/db/admin'
import { type Address, createWalletClient, type Hex, http, zeroHash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { robinhood } from 'viem/chains'
import { loadEnv } from '../env'
import type { SenderDeps, Settlement } from '../sender'

export const ROOT = resolve(import.meta.dirname, '../../../..')
/** This package's own directory. The OpenServ client writes its state file relative to the working directory. */
export const WORKER_ROOT = resolve(import.meta.dirname, '../..')

export async function openCli() {
  const env = loadEnv()
  const where = env.isRehearsal ? `REHEARSAL on ${env.rpcUrl}` : 'LIVE on Robinhood Chain mainnet'
  console.log(`${where}, database ${databaseName(env.databaseUrl)}`)

  const handle = createDb(env.databaseUrl)
  if (!(await hasSchema(handle.db))) {
    await handle.close()
    throw new Error(
      env.isRehearsal
        ? 'The rehearsal database has no tables. Run: pnpm rehearsal:reset'
        : 'The database has no tables. Run: pnpm db:migrate',
    )
  }
  // Live reads fall back to the official RPC, because this network drops connections. A rehearsal talks to its
  // fork and to nothing else: a fallback there would quietly read the real chain.
  const pub = makePublicClient(env.isRehearsal ? [env.rpcUrl] : [env.rpcUrl, OFFICIAL_RPC])
  const account = privateKeyToAccount(env.OPERATOR_PRIVATE_KEY as Hex)
  const wallet = createWalletClient({ account, chain: robinhood, transport: http(env.rpcUrl) })
  // A fork mines a block only when it is sent a transaction, so between runs its clock stands still while
  // the wall clock moves on. One empty block brings it up to date. This request does not exist on mainnet.
  if (env.isRehearsal) await pub.request({ method: 'evm_mine' } as never)
  const deps: SenderDeps = { db: handle.db, pub, wallet }
  return { env, ...handle, pub, wallet, deps }
}

/** The Desk implementation behind every contract version ever deployed. A desk must be a clone of its own. */
export function implementationsByVersion(): Record<string, Address> {
  const file = process.env.DEPLOYMENTS_FILE ?? resolve(ROOT, 'packages/chain/deployments.json')
  const all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { implementation?: Address } | string>
  return Object.fromEntries(
    Object.entries(all).flatMap(([label, d]) =>
      typeof d === 'object' && d.implementation ? [[label, d.implementation] as const] : [],
    ),
  )
}

export interface Deployment {
  label: string
  factory: Address
  devDesk: Address
}

export function currentDeployment(): Deployment {
  const file = process.env.DEPLOYMENTS_FILE ?? resolve(ROOT, 'packages/chain/deployments.json')
  const all = JSON.parse(readFileSync(file, 'utf8'))
  const label = all.current as string
  const d = all[label]
  if (!d?.devDesk) throw new Error('No dev desk recorded. Run: pnpm dev:desk create')
  return { label, factory: d.factory, devDesk: d.devDesk }
}

/** The dev desk was created by scripts/dev-desk.ts with a zero salt. Registering it is idempotent. */
export function registerDevDesk(db: SenderDeps['db'], d: Deployment, state: DeskState): Promise<DeskRow> {
  return registerDesk(db, {
    ownerAddress: state.owner,
    deskAddress: d.devDesk,
    factory: d.factory,
    salt: zeroHash,
    contractVersion: d.label,
    operator: state.operator,
    name: 'dev desk',
  })
}

/**
 * The contract counts its own sealed actions. If that count and ours disagree, something happened that the
 * database does not know about, and the desk must not act until it does.
 *
 * `engineExplainsAhead`: the engine's own check can explain a chain that is AHEAD when every call in between
 * came from the owner or the owner's session key, and refuses otherwise. Commands that run the engine pass true
 * and let it decide. Commands that send on their own, like the skeleton, keep the strict rule.
 */
export function assertChainSeqAgrees(
  desk: DeskRow,
  state: DeskState,
  isRehearsal: boolean,
  engineExplainsAhead = false,
): void {
  const onChain = Number(state.seq)
  if (onChain === desk.chainSeq) return
  if (onChain > desk.chainSeq && engineExplainsAhead) return
  if (onChain > desk.chainSeq) {
    throw new Error(
      `The chain shows ${onChain} sealed actions for this desk, the database knows ${desk.chainSeq}. ` +
        'Import the missing ones first: pnpm records:import',
    )
  }
  throw new Error(
    isRehearsal
      ? `The database is ahead of this fork (${desk.chainSeq} against ${onChain}). A new fork needs a fresh database: pnpm rehearsal:reset`
      : `The database knows ${desk.chainSeq} sealed actions but the chain shows only ${onChain}. Stop and investigate.`,
  )
}

export async function readDevDesk(deps: SenderDeps) {
  const deployment = currentDeployment()
  const state = await readDeskState(deps.pub, deployment.devDesk)
  if (state.operator.toLowerCase() !== deps.wallet.account.address.toLowerCase()) {
    throw new Error('this key is not the desk operator')
  }
  return { deployment, state }
}

export function printSettlements(list: Settlement[]): void {
  if (list.length === 0) {
    console.log('nothing left unsettled from earlier runs')
    return
  }
  console.log(`settling ${list.length} action(s) left by an earlier run:`)
  for (const s of list) {
    console.log(`  record ${s.recordSeq} ${s.kind}: ${s.was} -> ${s.now.toUpperCase()}. ${s.why}`)
    if (s.txHash) console.log(`    tx ${s.txHash}`)
    if (s.hashMismatch) console.log('    WARNING: the on-chain decision hash does not match the record')
  }
}
