/**
 * The desk's on-chain actions as a Coinbase AgentKit action provider, signed by AgentKit's ViemWalletProvider.
 *
 *   ViemWalletProvider   wraps the worker's own operator WalletClient: the same key, on Robinhood Chain (4663)
 *   DeskActionProvider   shijima_buy, _sell, _sweep_to_vault, _redeem_from_vault, _checkpoint, _pause
 *   deskAgentKit.send    how the review pass sends: it invokes the AgentKit action, which runs the sender
 *
 * Why the signing, and not the whole send, is AgentKit's. `ViemWalletProvider.sendTransaction` signs and broadcasts
 * in one call and picks its own nonce and fees. The desk's crash safety depends on saving the transaction's hash
 * and nonce BEFORE it is broadcast, and on pinning the nonce to the mined count so a stuck transaction is replaced,
 * never queued behind. So the write-ahead sender keeps simulate -> sign -> journal -> broadcast -> settle, and
 * AgentKit's wallet provider holds the pen: it signs the exact prepared transaction's hash with its account.
 * (Its own `signTransaction` drops the nonce and gas, so it cannot be used for a pinned-nonce transaction.)
 *
 * An AgentKit action can only carry out what the engine already decided and journaled: it takes an action id and
 * refuses unless that row is still `planned`, belongs to this operator, and matches the call's kind and desk.
 * The contract's caps still decide on-chain. Nothing here can invent a trade.
 *
 * AgentKit's telemetry (wallet address and action names, POSTed to Coinbase) is switched off: the desk's operator
 * address is ours to publish, and an un-awaited analytics request failing must never touch the worker.
 */
import type { ActionProvider as ActionProviderType, AgentKit, ViemWalletProvider } from '@coinbase/agentkit'
import type { DeskCall, DeskTxSigner } from '@desk/chain'
import { type ActionRow, actionById, deskById } from '@desk/db'
import {
  type Address,
  type Hex,
  keccak256,
  parseSignature,
  serializeTransaction,
  type TransactionSerializable,
  type WalletClient,
} from 'viem'
import { z } from 'zod/v3'
import { type SenderDeps, type SendResult, sendAction } from './sender'

export const ROBINHOOD_CHAIN_ID = 4663
const PROVIDER = 'shijima'

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const amount = z.string().regex(/^\d+$/, 'an integer amount in base units, as a string')
const base = { actionId: z.string().uuid(), desk: address, version: z.string().min(1) }
const trade = z.object({
  ...base,
  token: address,
  amountIn: amount,
  minOut: amount,
  deadline: z.number().int().positive(),
  decisionHash: hex32,
})
const vault = z.object({
  ...base,
  amountIn: amount,
  deadline: z.number().int().positive(),
  decisionHash: hex32,
})
const checkpoint = z.object({ ...base, decisionHash: hex32 })
const pause = z.object(base)

type Kind = DeskCall['kind']
const ACTIONS: Record<Kind, { name: string; description: string; schema: z.ZodTypeAny }> = {
  buy: {
    name: 'buy',
    description:
      'Buy a Stock Token with the desk’s USDG, inside the desk contract’s per-action and daily caps.',
    schema: trade,
  },
  sell: {
    name: 'sell',
    description: 'Sell a Stock Token for USDG, inside the desk contract’s caps.',
    schema: trade,
  },
  sweep: {
    name: 'sweep_to_vault',
    description: 'Move idle USDG into the desk’s savings vault.',
    schema: vault,
  },
  redeem: {
    name: 'redeem_from_vault',
    description: 'Take vault shares back out as USDG.',
    schema: vault,
  },
  checkpoint: {
    name: 'checkpoint',
    description:
      'Seal the desk’s record on-chain: the newest decision hash commits to every record before it.',
    schema: checkpoint,
  },
  pause: {
    name: 'pause',
    description: 'Pause the desk itself, after two checks in a row below the owner’s loss limit.',
    schema: pause,
  },
}

/** A DeskCall as the action's arguments: bigints as decimal strings, plus the journaled action it carries out. */
function toArgs(actionId: string, call: DeskCall): Record<string, unknown> {
  const common = { actionId, desk: call.desk, version: call.version }
  switch (call.kind) {
    case 'buy':
    case 'sell':
      return {
        ...common,
        token: call.token,
        amountIn: call.amountIn.toString(),
        minOut: call.minOut.toString(),
        deadline: call.deadline,
        decisionHash: call.decisionHash,
      }
    case 'sweep':
    case 'redeem':
      return {
        ...common,
        amountIn: call.amountIn.toString(),
        deadline: call.deadline,
        decisionHash: call.decisionHash,
      }
    case 'checkpoint':
      return { ...common, decisionHash: call.decisionHash }
    case 'pause':
      return common
  }
}

function toCall(kind: Kind, a: Record<string, unknown>): DeskCall {
  const desk = a.desk as Address
  const version = a.version as string
  switch (kind) {
    case 'buy':
    case 'sell':
      return {
        kind,
        desk,
        version,
        token: a.token as Address,
        amountIn: BigInt(a.amountIn as string),
        minOut: BigInt(a.minOut as string),
        deadline: a.deadline as number,
        decisionHash: a.decisionHash as Hex,
      }
    case 'sweep':
    case 'redeem':
      return {
        kind,
        desk,
        version,
        amountIn: BigInt(a.amountIn as string),
        deadline: a.deadline as number,
        decisionHash: a.decisionHash as Hex,
      }
    case 'checkpoint':
      return { kind, desk, version, decisionHash: a.decisionHash as Hex }
    case 'pause':
      return { kind, desk, version }
  }
}

const json = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))

/**
 * AgentKit's wallet provider as the desk's signer: the prepared transaction is serialized, its hash signed by the
 * provider's account, and the signature attached. Byte for byte what the wallet client would have produced.
 */
export function agentKitSigner(provider: ViemWalletProvider): DeskTxSigner {
  return async (tx) => {
    const unsigned: TransactionSerializable =
      tx.maxFeePerGas !== undefined
        ? {
            type: 'eip1559',
            chainId: tx.chainId,
            to: tx.to,
            data: tx.data,
            nonce: tx.nonce,
            gas: tx.gas,
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? 0n,
          }
        : {
            type: 'legacy',
            chainId: tx.chainId,
            to: tx.to,
            data: tx.data,
            nonce: tx.nonce,
            gas: tx.gas,
            gasPrice: tx.gasPrice ?? 0n,
          }
    const signature = await provider.sign(keccak256(serializeTransaction(unsigned)))
    return serializeTransaction(unsigned, parseSignature(signature))
  }
}

export interface DeskAgentKit {
  agentKit: AgentKit
  walletProvider: ViemWalletProvider
  /** Sends one journaled action through its AgentKit action. Same result shape as `sendAction`. */
  send: (action: ActionRow, call: DeskCall) => Promise<SendResult>
}

/** Builds AgentKit around the worker's operator wallet. Loaded lazily: the package is large. */
export async function createDeskAgentKit(deps: SenderDeps, rpcUrl: string): Promise<DeskAgentKit> {
  const { ActionProvider, AgentKit, ViemWalletProvider } = await import('@coinbase/agentkit')
  // AgentKit pins its own viem, so its WalletClient type is a different (identical-shaped) declaration.
  const walletProvider = new ViemWalletProvider(deps.wallet as unknown as WalletClient as never, { rpcUrl })
  // Telemetry off. It is sent a tick after construction, from this method, so replacing it now is in time.
  Object.assign(walletProvider, { trackInitialization: () => undefined })
  const signer = agentKitSigner(walletProvider)
  const operator = deps.wallet.account.address.toLowerCase()

  class DeskActionProvider extends ActionProvider<ViemWalletProvider> {
    constructor() {
      super(PROVIDER, [])
    }

    /** Robinhood Chain only, which is also what a local fork of it reports. */
    supportsNetwork = (network: { protocolFamily: string; chainId?: string }) =>
      network.protocolFamily === 'evm' && network.chainId === String(ROBINHOOD_CHAIN_ID)

    // Built directly rather than with @CreateAction: the decorator also sends an analytics event per call.
    override getActions(provider: ViemWalletProvider) {
      const signWith = provider === walletProvider ? signer : agentKitSigner(provider)
      return (Object.keys(ACTIONS) as Kind[]).map((kind) => {
        const spec = ACTIONS[kind]
        return {
          name: `${PROVIDER}_${spec.name}`,
          description: spec.description,
          schema: spec.schema,
          invoke: async (raw: unknown) => {
            const args = spec.schema.parse(raw) as Record<string, unknown>
            const row = await actionById(deps.db, args.actionId as string)
            const refuse = (why: string) =>
              json({ status: 'refused', code: 'refused:agentkit_guard', detail: why } satisfies SendResult)
            if (!row) return refuse('no journaled action with that id')
            if (row.status !== 'planned') return refuse(`the action is ${row.status}, not planned`)
            if (row.kind !== kind) return refuse(`the action is a ${row.kind}, not a ${kind}`)
            if (row.operator !== operator) return refuse('the action belongs to another operator')
            const call = toCall(kind, args)
            const desk = await deskById(deps.db, row.deskId)
            if (desk?.address.toLowerCase() !== call.desk.toLowerCase())
              return refuse('the action is for another desk')
            const result = await sendAction({ ...deps, signer: signWith }, row, call)
            return json(result)
          },
        }
      }) as unknown as ReturnType<ActionProviderType<ViemWalletProvider>['getActions']>
    }
  }

  const agentKit = await AgentKit.from({ walletProvider, actionProviders: [new DeskActionProvider()] })
  const actions = new Map(agentKit.getActions().map((a) => [a.name, a]))
  if (actions.size !== Object.keys(ACTIONS).length) {
    throw new Error(
      `AgentKit exposed ${actions.size} desk actions; the network ${JSON.stringify(walletProvider.getNetwork())} may not be Robinhood Chain`,
    )
  }

  return {
    agentKit,
    walletProvider,
    send: async (action, call) => {
      const invoke = actions.get(`${PROVIDER}_${ACTIONS[call.kind].name}`)
      if (!invoke) throw new Error(`no AgentKit action for ${call.kind}`)
      const out = JSON.parse(await invoke.invoke(toArgs(action.id, call))) as Record<string, unknown>
      return revive(out) as SendResult
    },
  }
}

/** The JSON result back into bigints where the sender's outcome has them. */
function revive(out: Record<string, unknown>): unknown {
  const outcome = out.outcome as Record<string, unknown> | undefined
  if (!outcome) return out
  const big = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : v)
  const fields = ['blockNumber', 'gasUsed', 'effectiveGasPrice', 'chainSeq', 'amountOut', 'feedPrice']
  return {
    ...out,
    outcome: Object.fromEntries(
      Object.entries(outcome).map(([k, v]) => [k, fields.includes(k) ? big(v) : v]),
    ),
  }
}
