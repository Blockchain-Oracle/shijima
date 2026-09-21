/**
 * What the chat may propose, and the plain-code checks every proposal must pass before a card is shown.
 *
 * The model never acts. It may name one proposal from this fixed list, with plain fields. This file checks the
 * fields against the desk as it is right now, turns them into exact arguments, and says who must confirm:
 *
 *   signin   the owner's signed-in session confirms, and the server runs it through the same guarded query the
 *            website and Telegram use
 *   session  the owner's browser session key may sign it in one click, if a live grant covers it
 *   wallet   only the owner's wallet may sign it
 *
 * A proposal that fails a check is never shown as a card. The owner gets the reason in words instead.
 */
import { APPROVED_TOKENS, type ApprovedToken } from '@desk/chain'
import { GO_LIVE_CHECKS } from '@desk/db'
import { alertsCopy, checkMandate, Mandate, presetById } from '@desk/shared'
import { z } from 'zod'
import { checkAlertInput, pctText } from '../alerts'

export const PROPOSAL_KINDS = [
  'switch_strategy',
  'set_weights',
  'set_notes',
  'set_limits',
  'pause',
  'resume',
  'set_mode',
  'answer_approval',
  'check_now',
  'do_it_anyway',
  'withdraw',
  'sell_everything',
  'remove_assistant',
  'unpause',
  'add_money',
  'set_chain_limits',
  'close_desk',
  'price_alert',
] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

/**
 * The model's answer. Strict mode on SERV needs every field present, so absent values are null, and one flat
 * proposal carries every possible field. The kind decides which of them are read.
 */
export const AskReply = z.object({
  /** Plain words for the owner, at most a few sentences. */
  reply: z.string(),
  /** Ids of the records the reply relies on, like "d41". Only ids that were supplied. */
  cites: z.array(z.string()),
  /** A small chart to show beside the reply, or null. */
  chart: z.object({ symbol: z.string(), days: z.number().int() }).nullable(),
  proposal: z
    .object({
      kind: z.enum(PROPOSAL_KINDS),
      presetId: z.string().nullable(),
      targets: z.array(z.object({ symbol: z.string(), weightBps: z.number().int() })).nullable(),
      cashBps: z.number().int().nullable(),
      notes: z.string().nullable(),
      driftToleranceBps: z.number().int().nullable(),
      maxPositionBps: z.number().int().nullable(),
      lossStopBps: z.number().int().nullable(),
      mode: z.enum(['shadow', 'ask_first', 'on_its_own']).nullable(),
      approvalId: z.string().nullable(),
      answer: z.enum(['approve', 'reject']).nullable(),
      decisionId: z.string().nullable(),
      amountUsdg: z.string().nullable(),
      withdrawAs: z.enum(['usdg', 'stocks']).nullable(),
      /** The limits the desk's account itself enforces, in dollars, for set_chain_limits. Null keeps the current one. */
      perActionCapUsdg: z.string().nullable(),
      dailyCapUsdg: z.string().nullable(),
      /** A price alert, for price_alert: the stock, which way, and how far from its reference in basis points. */
      symbol: z.string().nullable(),
      alertDirection: z.enum(['above', 'below', 'either']).nullable(),
      thresholdBps: z.number().int().nullable(),
    })
    .nullable(),
})
export type AskReply = z.infer<typeof AskReply>

/** What the desk looks like to the checks. Built from the database, never from the browser. */
export interface DeskFacts {
  deskId: string
  mode: 'shadow' | 'ask_first' | 'on_its_own'
  state: string
  lifecycle: string
  mandate: Mandate
  /** The version the proposal was made against. Confirming refuses if the settings changed since. */
  mandateVersion: number
  shadowChecks: number
  reportOpened: boolean
  /** Short ids shown to the model, mapped to the real rows. */
  approvals: Map<string, { id: string; summary: string }>
  waits: Map<string, StandingWait>
}

/** A wait the desk is keeping, as "do it anyway" needs it: the record that started it and what it would do. */
export interface StandingWait {
  deferralId: string
  decisionId: string
  decisionSeq: number
  token: string
  side: 'buy' | 'sell'
  /** The candidate's size, as a decimal in its own unit: USDG for a buy, the token for a sell. */
  amountIn: string
  summary: string
}

export interface CheckedProposal {
  kind: ProposalKind
  path: 'signin' | 'session' | 'wallet'
  /** Exact arguments. The confirm step runs these and nothing else. JSON-safe: money is a decimal string. */
  args: Record<string, unknown>
  /** What the card shows: before and after, in plain words. */
  card: { title: string; before?: string[]; after?: string[]; note?: string }
}

export type ProposalCheck = { ok: true; proposal: CheckedProposal } | { ok: false; why: string }

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`

function describeTargets(m: Mandate, approved: ApprovedToken[]): string[] {
  const name = (a: string) =>
    approved.find((t) => t.address.toLowerCase() === a.toLowerCase())?.displayName ?? a
  return [
    ...m.targets.tokens.map((t) => `${name(t.token)} ${pct(t.weightBps)}`),
    `Cash ${pct(m.targets.cashBps)}`,
  ]
}

/** The mandate as JSON-safe arguments: money as decimal strings, so the saved proposal hashes the same way twice. */
export function mandateArgs(m: Mandate): Record<string, unknown> {
  return {
    ...m,
    perActionCapUsdg: m.perActionCapUsdg.toString(),
    dailyCapUsdg: m.dailyCapUsdg.toString(),
    largeActionUsdg: m.largeActionUsdg.toString(),
  }
}

/** The saved arguments back into a mandate. Throws if they were tampered with: the schema is the last word. */
export function mandateFromArgs(args: Record<string, unknown>): Mandate {
  const m = (args.mandate ?? {}) as Record<string, unknown>
  const big = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : v)
  return Mandate.parse({
    ...m,
    perActionCapUsdg: big(m.perActionCapUsdg),
    dailyCapUsdg: big(m.dailyCapUsdg),
    largeActionUsdg: big(m.largeActionUsdg),
  })
}

function mandateProposal(
  kind: ProposalKind,
  next: Mandate,
  facts: DeskFacts,
  title: string,
  approved: ApprovedToken[],
): ProposalCheck {
  const problems = checkMandate(next, approved)
  if (problems.length > 0) return { ok: false, why: `That would not hold together: ${problems.join('; ')}.` }
  return {
    ok: true,
    proposal: {
      kind,
      path: 'signin',
      args: { mandate: mandateArgs(next), baseVersion: facts.mandateVersion },
      card: {
        title,
        before: describeTargets(facts.mandate, approved),
        after: describeTargets(next, approved),
        note: 'Your targets change when you confirm. The desk moves toward them at its next checks, inside your limits.',
      },
    },
  }
}

/** Checks one proposal against the desk as it is now. */
export function checkProposal(
  p: NonNullable<AskReply['proposal']>,
  facts: DeskFacts,
  approved: ApprovedToken[] = APPROVED_TOKENS,
): ProposalCheck {
  const m = facts.mandate
  switch (p.kind) {
    case 'switch_strategy': {
      const preset = p.presetId ? presetById(p.presetId) : undefined
      if (!preset) return { ok: false, why: 'I do not know that strategy.' }
      const tokens = Object.entries(preset.weights).map(([symbol, weightBps]) => {
        const token = approved.find((t) => t.symbol === symbol)
        return { token: token?.address ?? symbol, weightBps }
      })
      const next: Mandate = { ...m, preset: preset.id, targets: { cashBps: preset.cashBps, tokens } }
      return mandateProposal(p.kind, next, facts, `Move to ${preset.name}`, approved)
    }
    case 'set_weights': {
      if (!p.targets || p.cashBps === null)
        return { ok: false, why: 'I need every weight, and the cash share.' }
      const tokens = []
      for (const t of p.targets) {
        const token = approved.find((a) => a.symbol === t.symbol.toUpperCase())
        if (!token)
          return { ok: false, why: `${t.symbol} is not one of the Stock Tokens this desk can hold.` }
        tokens.push({ token: token.address, weightBps: t.weightBps })
      }
      const next: Mandate = { ...m, preset: null, targets: { cashBps: p.cashBps, tokens } }
      return mandateProposal(p.kind, next, facts, 'Change your weights', approved)
    }
    case 'set_notes': {
      if (p.notes === null) return { ok: false, why: 'I need the words of the note.' }
      if (p.notes.length > 2000) return { ok: false, why: 'Notes are limited to 2,000 characters.' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'signin',
          args: { mandate: mandateArgs({ ...m, notes: p.notes }), baseVersion: facts.mandateVersion },
          card: {
            title: 'Change your notes',
            before: m.notes ? m.notes.split('\n') : ['No notes'],
            after: p.notes ? p.notes.split('\n') : ['No notes'],
            note: 'The desk reads these at every check. They can shape when it acts, never how much.',
          },
        },
      }
    }
    case 'set_limits': {
      const next: Mandate = {
        ...m,
        driftToleranceBps: p.driftToleranceBps ?? m.driftToleranceBps,
        maxPositionBps: p.maxPositionBps ?? m.maxPositionBps,
        lossStopBps: p.lossStopBps ?? m.lossStopBps,
      }
      if (
        next.driftToleranceBps === m.driftToleranceBps &&
        next.maxPositionBps === m.maxPositionBps &&
        next.lossStopBps === m.lossStopBps
      ) {
        return { ok: false, why: 'Nothing in that changes your limits.' }
      }
      const check = mandateProposal(p.kind, next, facts, 'Change your limits', approved)
      if (check.ok) {
        check.proposal.card.before = [
          `May wander ${pct(m.driftToleranceBps)}`,
          `Largest holding ${pct(m.maxPositionBps)}`,
          `Stops after a ${pct(m.lossStopBps)} fall`,
        ]
        check.proposal.card.after = [
          `May wander ${pct(next.driftToleranceBps)}`,
          `Largest holding ${pct(next.maxPositionBps)}`,
          `Stops after a ${pct(next.lossStopBps)} fall`,
        ]
      }
      return check
    }
    case 'pause':
      if (facts.state !== 'active')
        return { ok: false, why: 'The desk is not active, so there is nothing to pause.' }
      return simple(
        p.kind,
        'signin',
        'Pause the desk',
        'Nothing is sold. It stops acting until you resume it.',
      )
    case 'resume':
      if (facts.state !== 'paused_by_owner') return { ok: false, why: 'The desk is not paused by you.' }
      return simple(p.kind, 'signin', 'Resume the desk', 'It carries on from its next check.')
    case 'set_mode': {
      if (!p.mode || p.mode === facts.mode) return { ok: false, why: 'The desk is already in that mode.' }
      if (facts.mode === 'shadow' && p.mode !== 'shadow') {
        if (facts.shadowChecks < GO_LIVE_CHECKS)
          return {
            ok: false,
            why: `Not yet. Going live needs ${GO_LIVE_CHECKS} practice checks, and this desk has done ${facts.shadowChecks}.`,
          }
        if (!facts.reportOpened)
          return { ok: false, why: 'Not yet. Going live needs you to read its practice report first.' }
      }
      const words = { shadow: 'Practice', ask_first: 'Ask me first', on_its_own: 'On its own' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'signin',
          args: { mode: p.mode },
          card: {
            title: `Switch to ${words[p.mode]}`,
            before: [words[facts.mode]],
            after: [words[p.mode]],
            note: 'Waiting requests and remembered waits from the old mode are cancelled.',
          },
        },
      }
    }
    case 'answer_approval': {
      const approval = p.approvalId ? facts.approvals.get(p.approvalId) : undefined
      if (!approval || !p.answer) return { ok: false, why: 'I cannot find that request.' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'signin',
          args: { approvalId: approval.id, answer: p.answer },
          card: {
            title: p.answer === 'approve' ? 'Approve this request' : 'Reject this request',
            after: [approval.summary],
            note: 'Answering moves nothing by itself. The desk re-checks the price before it acts.',
          },
        },
      }
    }
    case 'check_now':
      return simple(
        p.kind,
        'signin',
        'Check now',
        'The desk looks at everything now and decides as it always does.',
      )
    case 'do_it_anyway': {
      if (facts.mode === 'shadow')
        return { ok: false, why: 'In practice mode the desk spends nothing, even on your word.' }
      const wait = p.decisionId ? facts.waits.get(p.decisionId) : undefined
      if (!wait) return { ok: false, why: 'I cannot find a wait of the desk that is still standing.' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'signin',
          args: {
            deferralId: wait.deferralId,
            decisionId: wait.decisionId,
            decisionSeq: wait.decisionSeq,
            token: wait.token,
            side: wait.side,
            amountIn: wait.amountIn,
          },
          card: {
            title: 'Do it anyway, on your word',
            before: [wait.summary],
            note: 'The desk chose to wait. If you confirm, it acts now as your call, not its own. Every limit still holds, and the price is checked again first.',
          },
        },
      }
    }
    case 'withdraw': {
      const as = p.withdrawAs ?? 'usdg'
      // Whether the desk has that much is read from the chain when the transaction is built, before anything is
      // signed. The last hourly valuation is too old to refuse on: money may have arrived since.
      const amount = dollars(p.amountUsdg)
      if (typeof amount === 'string') return { ok: false, why: amount }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'session',
          args: { as, amountUsdg: amount?.toString() ?? null },
          card: {
            title: amount ? `Withdraw $${formatUsd(amount)}` : 'Withdraw everything',
            note: 'It goes to your own wallet, the owner of this desk, and nowhere else. The cost is shown before you sign.',
          },
        },
      }
    }
    case 'sell_everything':
      return simple(
        p.kind,
        'wallet',
        'Sell everything to cash',
        'Every holding becomes USDG in the desk. The cost is shown before you sign.',
      )
    case 'remove_assistant':
      return simple(
        p.kind,
        'session',
        'Remove the assistant',
        'It loses all access at once and the desk stops. Your money stays in your account.',
      )
    case 'unpause':
      return simple(
        p.kind,
        'wallet',
        'Restart the desk on-chain',
        'If you removed the assistant, this brings it back too. Only your wallet can do this.',
      )
    case 'add_money': {
      const amount = dollars(p.amountUsdg)
      if (typeof amount === 'string') return { ok: false, why: amount }
      if (amount === null) return { ok: false, why: 'How much? I need the amount in dollars.' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'wallet',
          args: { amountUsdg: amount.toString() },
          card: {
            title: `Add $${formatUsd(amount)}`,
            note: 'USDG moves from your wallet on Robinhood Chain into the desk. Only your wallet can send it.',
          },
        },
      }
    }
    case 'set_chain_limits': {
      const perAction = dollars(p.perActionCapUsdg)
      const daily = dollars(p.dailyCapUsdg)
      if (typeof perAction === 'string') return { ok: false, why: perAction }
      if (typeof daily === 'string') return { ok: false, why: daily }
      if (perAction === null && daily === null)
        return { ok: false, why: 'Nothing in that changes the limits on the chain.' }
      if (perAction !== null && daily !== null && perAction > daily)
        return { ok: false, why: 'The most per action cannot be more than the most per day.' }
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          // Lowering runs on the session key; raising needs the wallet. Which one is known only against the chain's
          // current limits, so the transaction built at confirm time decides, and the card says so before signing.
          path: 'session',
          args: { perActionCapUsdg: perAction?.toString() ?? null, dailyCapUsdg: daily?.toString() ?? null },
          // The before and after come from the chain itself when the card is shown, so they are not repeated here.
          card: {
            title: 'Change the limits on the chain',
            note: `Your account holds the assistant to these, whatever it decides. It also keeps to your settings' own $${formatUsd(m.perActionCapUsdg)} per action and $${formatUsd(m.dailyCapUsdg)} a day, whichever is lower.`,
          },
        },
      }
    }
    case 'price_alert': {
      const check = checkAlertInput(
        { symbol: p.symbol ?? '', direction: p.alertDirection ?? '', thresholdBps: p.thresholdBps ?? 0 },
        approved,
      )
      if (!check.ok) return check
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'signin',
          args: { symbol: check.token.symbol, direction: check.direction, thresholdBps: check.thresholdBps },
          card: {
            title: alertsCopy.card(check.token.displayName, pctText(check.thresholdBps), check.direction),
            note: alertsCopy.cardNote,
          },
        },
      }
    }
    case 'close_desk': {
      if (facts.lifecycle === 'closed') return { ok: false, why: 'This desk is already closed.' }
      const as = p.withdrawAs ?? 'usdg'
      return {
        ok: true,
        proposal: {
          kind: p.kind,
          path: 'wallet',
          args: { as },
          card: {
            title: 'Close the desk',
            after: [
              as === 'usdg' ? 'Every holding sold to USDG' : 'Every holding sent as it is',
              'Everything sent to your own wallet',
              'The assistant removed, and checks stop',
            ],
            note: 'One signature does all of it. The record stays readable afterwards. The cost is shown before you sign.',
          },
        },
      }
    }
  }
}

/** A dollar amount from the model or a form: "25", "12.50". Null when absent, a sentence when unusable. */
function dollars(value: string | null): bigint | null | string {
  if (value === null || value === '') return null
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return 'I need the amount in dollars, like 25 or 12.50.'
  const [whole, frac = ''] = value.split('.')
  const amount = BigInt(whole ?? '0') * 1_000_000n + BigInt(frac.padEnd(6, '0'))
  if (amount <= 0n) return 'The amount must be more than nothing.'
  return amount
}

function simple(
  kind: ProposalKind,
  path: CheckedProposal['path'],
  title: string,
  note: string,
): ProposalCheck {
  return { ok: true, proposal: { kind, path, args: {}, card: { title, note } } }
}

export function formatUsd(raw: bigint): string {
  const whole = raw / 1_000_000n
  const cents = (raw % 1_000_000n) / 10_000n
  return `${whole.toLocaleString('en-US')}.${cents.toString().padStart(2, '0')}`
}
