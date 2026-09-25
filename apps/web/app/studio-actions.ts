'use server'

import { randomBytes } from 'node:crypto'
import { APPROVED_TOKENS, deskFactoryAbi, isCloneOf, readDeskState } from '@desk/chain'
import {
  applyMandate,
  attachOwnerTelegram,
  deskById,
  disclosureAccepted,
  draftDeskOf,
  markDeskDeployed,
  nameDraftDesk,
  ownerIdOf,
  ownsDesk,
  readBackForOwner,
  registerDesk,
  skipTelegram,
  startDesk,
} from '@desk/db'
import { checkMandate, DISCLOSURE_VERSION, errorText, type Mandate, studioCopy } from '@desk/shared'
import { revalidatePath } from 'next/cache'
import { type Address, encodeFunctionData, type Hex } from 'viem'
import { mandateFromJson, mandateKey } from '@/features/strategies/draft'
import { currentDeployment } from '@/lib/chain'
import { feeSettings, pub } from '@/lib/chain-build.server'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

/**
 * Creating a desk from the studio, in two halves around the one wallet confirmation.
 *
 * `prepareDeskAction` writes the desk's row BEFORE the contract exists, with a salt of its own and the address the
 * factory will give it, so money can be sent there first when the owner has no ETH (design brief 8.4). It builds
 * the one transaction on the server, with the owner's per-action and daily limits written into the contract.
 *
 * `finishDeskAction` trusts nothing from the browser. It reads the chain: a clone of our own Desk at that address,
 * owned by the signed-in wallet, with our operator. Only then is the basket applied and the desk started, in
 * practice. The test read is kept as the mandate's `read_back` only when it read exactly this draft.
 */

const NAME_MAX = 40
const refused = studioCopy.refused

export type PreparedDesk =
  | {
      ok: true
      deskId: string
      address: Address
      to: Address
      data: Hex
      feeUsd: number | null
      /** What the wallet must hold, in wei (gas limit x max fee), so the page can tell whether it can pay. */
      feeWei: string | null
      /** The gas limit and max fee the page hands the wallet, as decimal strings; null lets the wallet choose. */
      gas: string | null
      maxFeePerGas: string | null
      /** Dollars per ETH, to show the wallet's ETH in dollars. */
      ethUsd: number | null
      /** True when the contract is already there: the owner signed before and the page was closed. */
      exists: boolean
    }
  | { ok: false; why: string }

function parseDraft(json: unknown): { ok: true; mandate: Mandate } | { ok: false; why: string } {
  let mandate: Mandate
  try {
    mandate = mandateFromJson(json)
  } catch {
    return { ok: false, why: 'Those settings are not complete.' }
  }
  const problems = checkMandate(mandate, APPROVED_TOKENS)
  if (mandate.dailyCapUsdg < mandate.perActionCapUsdg) problems.push(studioCopy.behaviour.dailyBelow)
  return problems.length > 0 ? { ok: false, why: `${problems.join('. ')}.` } : { ok: true, mandate }
}

export async function prepareDeskAction(input: { name: string; mandate: unknown }): Promise<PreparedDesk> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: refused.signIn }
    const ownerId = await ownerIdOf(db(), owner)
    if (!ownerId || !(await disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION))) {
      return { ok: false, why: refused.disclosure }
    }
    const draft = parseDraft(input.mandate)
    if (!draft.ok) return draft
    const name = input.name.trim().slice(0, NAME_MAX) || studioCopy.side.unnamed
    const deployment = currentDeployment()

    // One unfinished desk per owner and factory: resuming it means money already sent there is never stranded.
    let desk = await draftDeskOf(db(), owner, deployment.factory)
    if (desk) {
      await nameDraftDesk(db(), desk.id, name)
    } else {
      const salt = `0x${randomBytes(32).toString('hex')}` as Hex
      const address = (await pub().readContract({
        address: deployment.factory,
        abi: deskFactoryAbi,
        functionName: 'predictDesk',
        args: [owner as Address, salt],
      })) as Address
      desk = await registerDesk(db(), {
        ownerAddress: owner,
        deskAddress: address,
        factory: deployment.factory,
        salt,
        contractVersion: deployment.version,
        operator: deployment.operator,
        name,
      })
    }

    const data = encodeFunctionData({
      abi: deskFactoryAbi,
      functionName: 'createDesk',
      args: [
        {
          operator: deployment.operator,
          perActionCapUsdg: draft.mandate.perActionCapUsdg,
          dailyCapUsdg: draft.mandate.dailyCapUsdg,
          tokens: APPROVED_TOKENS.map((t) => t.address),
          fees: APPROVED_TOKENS.map((t) => t.pinnedFee),
          feeds: APPROVED_TOKENS.map((t) => t.feed),
        },
        desk.salt as Hex,
      ],
    })
    const code = await pub().getCode({ address: desk.address as Address })
    const exists = Boolean(code && code !== '0x')
    const fee = exists ? null : await feeSettings(owner as Address, { to: deployment.factory, data })
    return {
      ok: true,
      deskId: desk.id,
      address: desk.address as Address,
      to: deployment.factory,
      data,
      feeUsd: fee?.ok ? fee.usd : null,
      feeWei: fee?.ok ? fee.ceilingWei.toString() : null,
      gas: fee?.ok ? fee.gas.toString() : null,
      maxFeePerGas: fee?.ok ? fee.maxFeePerGas.toString() : null,
      ethUsd: fee?.ok ? fee.ethUsd : null,
      exists,
    }
  } catch (e) {
    console.error(`[studio] prepare: ${errorText(e)}`)
    return { ok: false, why: studioCopy.create.failed }
  }
}

export type FinishedDesk = { ok: true; slug: string } | { ok: false; why: string }

export async function finishDeskAction(input: {
  deskId: string
  txHash: string | null
  mandate: unknown
  readRequestId: string | null
}): Promise<FinishedDesk> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: refused.signIn }
    if (!(await ownsDesk(db(), input.deskId, owner))) return { ok: false, why: refused.notYours }
    const desk = await deskById(db(), input.deskId)
    if (!desk) return { ok: false, why: refused.notYours }
    const slug = desk.shareSlug ?? desk.id
    if (desk.deployedAt && desk.lifecycle === 'running') return { ok: true, slug }

    const deployment = currentDeployment()
    const address = desk.address as Address
    if (desk.factory !== deployment.factory.toLowerCase()) return { ok: false, why: refused.notOurs }
    if (!(await isCloneOf(pub(), address, deployment.implementation)))
      return { ok: false, why: refused.notOurs }
    const state = await readDeskState(pub(), address)
    if (state.owner.toLowerCase() !== owner) return { ok: false, why: refused.wrongOwner }
    if (state.operator.toLowerCase() !== deployment.operator.toLowerCase()) {
      return { ok: false, why: refused.wrongOperator }
    }

    const draft = parseDraft(input.mandate)
    if (!draft.ok) return draft

    // The transaction is kept only when it really is this owner creating this desk through our factory.
    let deployTx: string | null = null
    if (input.txHash && /^0x[0-9a-fA-F]{64}$/.test(input.txHash)) {
      const receipt = await pub()
        .getTransactionReceipt({ hash: input.txHash as Hex })
        .catch(() => null)
      if (
        receipt?.status === 'success' &&
        receipt.from.toLowerCase() === owner &&
        receipt.to?.toLowerCase() === deployment.factory.toLowerCase()
      ) {
        deployTx = input.txHash
      }
    }

    // The read-back is the desk's own words, from the worker's row, and only for exactly this draft.
    let readBack: Record<string, unknown> | undefined
    if (input.readRequestId && /^[0-9a-f-]{36}$/i.test(input.readRequestId)) {
      const read = await readBackForOwner(db(), input.readRequestId, owner)
      const reply = read?.reply as { reply?: unknown; promptVersion?: unknown } | null | undefined
      let same = false
      try {
        same = mandateKey(mandateFromJson(read?.payload?.mandate)) === mandateKey(draft.mandate)
      } catch {
        same = false
      }
      if (read && same && typeof reply?.reply === 'string' && typeof reply.promptVersion === 'string') {
        readBack = {
          text: reply.reply,
          requestId: read.id,
          promptVersion: reply.promptVersion,
          at: read.answeredAt?.toISOString() ?? null,
          source: 'studio',
        }
      }
    }

    await markDeskDeployed(db(), desk.id, deployTx)
    await applyMandate(db(), desk.id, draft.mandate, { actor: 'owner', via: 'web' }, readBack)
    await startDesk(db(), desk.id)
    // The owner's Telegram hears about the new agent from its first minute (DECISIONS F6). Never fails a publish:
    // Telegram is not money, and the owner can reconnect from Settings.
    await attachOwnerTelegram(db(), desk.id, desk.ownerId).catch((e) =>
      console.error(`[studio] telegram attach: ${errorText(e)}`),
    )
    revalidatePath('/agents/new')
    revalidatePath('/agents')
    return { ok: true, slug }
  } catch (e) {
    console.error(`[studio] finish: ${errorText(e)}`)
    return { ok: false, why: studioCopy.create.failed }
  }
}

/** "Skip for now" on Connect Telegram, for the desk's own owner only. */
export async function skipTelegramAction(deskId: string): Promise<{ ok: boolean }> {
  const owner = await signedInAddress()
  if (!owner || !(await ownsDesk(db(), deskId, owner))) return { ok: false }
  await skipTelegram(db(), deskId)
  return { ok: true }
}
