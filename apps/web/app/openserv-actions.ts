'use server'

/**
 * The OpenServ part of Settings → Connections. Every action reads the SIGNED-IN wallet on the server and touches
 * only links on that owner's own desks; an id from the browser proves nothing.
 *
 * The webhook URL is checked with OpenServ's public, read-only preflight (GET) before it is saved, and is stored
 * only encrypted under OPENSERV_WEBHOOK_KEY. It is never sent back to the browser.
 */
import {
  openservLinksOfOwner,
  setOpenservAllowChecks,
  setOpenservWebhook,
  unlinkOpenservLink,
} from '@desk/db'
import { errorText, openservWebhookToken } from '@desk/shared'
import { sealWebhookUrl, webhookKeyReady } from '@desk/shared/webhook-box'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'

export type OpenservResult = { ok: true } | { ok: false; why: string }

export interface LinkedWorkspace {
  id: string
  deskId: string
  deskName: string | null
  /** What the workspace called itself when it linked. Null for links made before names were kept. */
  workspaceName: string | null
  createdAt: string
  linkedAt: string | null
  allowChecks: boolean
  hasWebhook: boolean
}

const SIGNED_OUT = 'Sign in first.'
const NOT_YOURS = 'That workspace is not linked to any of your desks.'
const PREFLIGHT_TIMEOUT_MS = 8_000

/** The workspaces linked to the signed-in owner's desks, newest first. */
export async function linkedWorkspacesAction(): Promise<LinkedWorkspace[]> {
  const owner = await signedInAddress()
  if (!owner) return []
  const rows = await openservLinksOfOwner(db(), owner)
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    linkedAt: r.linkedAt?.toISOString() ?? null,
  }))
}

/** Unlinks one workspace. Its chat and agents get "not linked" from then on, and its webhook is dropped. */
export async function unlinkWorkspaceAction(linkId: string): Promise<OpenservResult> {
  const owner = await signedInAddress()
  if (!owner) return { ok: false, why: SIGNED_OUT }
  if (!(await unlinkOpenservLink(db(), linkId, owner))) return { ok: false, why: NOT_YOURS }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * "Let my workspace trigger checks." On, a linked workspace may ask for a check at once; the agent's own rules
 * and the contract's caps still decide. It can never withdraw or raise a limit either way.
 */
export async function setAllowChecksAction(linkId: string, allow: boolean): Promise<OpenservResult> {
  const owner = await signedInAddress()
  if (!owner) return { ok: false, why: SIGNED_OUT }
  if (!(await setOpenservAllowChecks(db(), linkId, owner, allow))) return { ok: false, why: NOT_YOURS }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Saves an OpenServ webhook-trigger URL, after OpenServ confirms the trigger exists. The worker then POSTs each
 * decision there. Only `https://api.openserv.ai/webhooks/trigger/<token>` is accepted.
 */
export async function saveWebhookAction(linkId: string, url: string): Promise<OpenservResult> {
  try {
    const owner = await signedInAddress()
    if (!owner) return { ok: false, why: SIGNED_OUT }
    const token = openservWebhookToken(url)
    if (!token)
      return {
        ok: false,
        why: 'That is not an OpenServ webhook URL. It looks like https://api.openserv.ai/webhooks/trigger/…',
      }
    if (!webhookKeyReady())
      return { ok: false, why: 'Webhooks are not set up on this server yet (OPENSERV_WEBHOOK_KEY).' }
    // Read-only: OpenServ's public preflight answers 200 for a live trigger and 400 "Trigger not found" otherwise.
    const preflight = await fetch(`https://api.openserv.ai/webhooks/trigger/${token}`, {
      method: 'GET',
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    }).catch(() => undefined)
    if (!preflight)
      return { ok: false, why: 'OpenServ did not answer. Nothing was saved; try again in a minute.' }
    if (!preflight.ok)
      return {
        ok: false,
        why: 'OpenServ does not know that trigger. Copy the URL again from the webhook trigger in your workspace.',
      }
    const sealed = sealWebhookUrl(`https://api.openserv.ai/webhooks/trigger/${token}`)
    if (!(await setOpenservWebhook(db(), linkId, owner, sealed))) return { ok: false, why: NOT_YOURS }
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { ok: false, why: `Nothing was saved: ${errorText(e)}` }
  }
}

/** Stops sending decisions to that workspace. */
export async function removeWebhookAction(linkId: string): Promise<OpenservResult> {
  const owner = await signedInAddress()
  if (!owner) return { ok: false, why: SIGNED_OUT }
  if (!(await setOpenservWebhook(db(), linkId, owner, null))) return { ok: false, why: NOT_YOURS }
  revalidatePath('/', 'layout')
  return { ok: true }
}
