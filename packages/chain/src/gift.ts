/**
 * The free $1's two transfers, from the gift wallet: USDG, then a pinch of ETH for gas. The same separate steps
 * as an operator call (send.ts), so the caller journals the hash BEFORE anything is broadcast:
 *
 *   signGiftTransfer   simulate, build and sign. Not sent. The nonce is the MINED count unless one is given
 *   broadcast          (send.ts) hand the signed bytes to the network
 *   giftReceipt        did this hash land, and did it succeed? undefined while there is no receipt
 */
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  keccak256,
  type PublicClient,
  TransactionReceiptNotFoundError,
} from 'viem'
import { USDG } from './addresses'
import type { OperatorWallet } from './desk'
import { OperatorLowGasError } from './send'

export interface GiftTransfer {
  leg: 'usdg' | 'eth'
  to: Address
  /** USDG raw units for the usdg leg, wei for the eth leg. */
  amount: bigint
  /** Re-sign on this nonce, so the new transfer REPLACES an earlier one that has not landed instead of adding to it. */
  nonce?: number
}

export interface SignedGiftTransfer {
  serialized: Hex
  txHash: Hex
  nonce: number
}

export async function signGiftTransfer(
  pub: PublicClient,
  wallet: OperatorWallet,
  t: GiftTransfer,
): Promise<SignedGiftTransfer> {
  const account = wallet.account
  let request: Awaited<ReturnType<OperatorWallet['prepareTransactionRequest']>>
  const nonce = t.nonce ?? (await pub.getTransactionCount({ address: account.address, blockTag: 'latest' }))
  if (t.leg === 'usdg') {
    // A refused transfer (the gift wallet is out of USDG) names itself here, before anything is signed.
    await pub.simulateContract({
      account,
      address: USDG,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [t.to, t.amount],
    })
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [t.to, t.amount] })
    request = await wallet.prepareTransactionRequest({ to: USDG, data, nonce })
  } else {
    request = await wallet.prepareTransactionRequest({ to: t.to, value: t.amount, nonce })
  }
  const gas = (request.gas * 12n) / 10n
  const needed = gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n) + (t.leg === 'eth' ? t.amount : 0n)
  const balance = await pub.getBalance({ address: account.address })
  if (balance < needed) throw new OperatorLowGasError(balance, needed)
  const serialized = await wallet.signTransaction({ ...request, gas })
  return { serialized, txHash: keccak256(serialized), nonce: request.nonce }
}

export async function giftReceipt(
  pub: PublicClient,
  txHash: Hex,
): Promise<{ status: 'confirmed' | 'reverted'; blockNumber: bigint } | undefined> {
  try {
    const receipt = await pub.getTransactionReceipt({ hash: txHash })
    return {
      status: receipt.status === 'success' ? 'confirmed' : 'reverted',
      blockNumber: receipt.blockNumber,
    }
  } catch (e) {
    if (e instanceof TransactionReceiptNotFoundError) return undefined
    throw e
  }
}
