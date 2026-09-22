/**
 * Proves price alerts end to end, on the REHEARSAL database only: an alert made through the chat's card, one made
 * through the stock page's checks, one refused, then a price slot where Nvidia sits 0.8% above its reference.
 * The logger's check must fire the reached alert once, with its message, and leave the other waiting.
 *
 *   pnpm rehearsal:reset first if the rehearsal database is stale. Never touches desk_dev.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import {
  checkPriceAlerts,
  checkProposal,
  confirmSigninProposal,
  loadAskContext,
  priceSlot,
  setPriceAlert,
} from '@desk/core'
import {
  createAnsweredRequest,
  createDb,
  deskIdBySlug,
  latestPricePoints,
  ownerAlerts,
  ownerInbox,
  savePricePoints,
  saveProposal,
} from '@desk/db'

const url = process.env.REHEARSAL_DATABASE_URL
if (!url?.includes('rehearsal')) throw new Error('this runs on the rehearsal database only')
const { db, close } = createDb(url, { max: 2 })
const owner = '0xb5d47f376c59c975f931000fadd787abaeb91cf6'
const show = (label: string, value: unknown) => console.log(`${label}:`, JSON.stringify(value))

try {
  const deskId = await deskIdBySlug(db, 'showcase')
  if (!deskId) throw new Error('no showcase desk in the rehearsal database')
  const now = new Date()

  // 1. The chat's way: the model's proposal is checked, saved as a card, and confirmed by the signed-in owner.
  const question = 'Tell me when Nvidia is half a percent from its reference'
  const context = await loadAskContext(db, {
    deskId,
    ownerAddress: owner,
    question,
    approved: APPROVED_TOKENS,
    now,
  })
  if ('refused' in context || !context.facts) throw new Error('no desk facts')
  const nulls = {
    presetId: null,
    targets: null,
    cashBps: null,
    notes: null,
    driftToleranceBps: null,
    maxPositionBps: null,
    lossStopBps: null,
    mode: null,
    approvalId: null,
    answer: null,
    decisionId: null,
    amountUsdg: null,
    withdrawAs: null,
    perActionCapUsdg: null,
    dailyCapUsdg: null,
    rules: null,
  }
  const check = checkProposal(
    { ...nulls, kind: 'price_alert', symbol: 'nvda', alertDirection: 'either', thresholdBps: 50 },
    context.facts,
    APPROVED_TOKENS,
  )
  if (!check.ok) throw new Error(check.why)
  show('chat card', check.proposal.card)
  const requestId = await createAnsweredRequest(db, {
    ownerAddress: owner,
    deskId,
    via: 'web',
    question,
    reply: {
      reply: 'Here it is.',
      cites: [],
      chart: null,
      proposalId: null,
      refused: null,
      promptVersion: null,
    },
  })
  const proposalId = await saveProposal(db, {
    requestId,
    deskId,
    ownerAddress: owner,
    kind: check.proposal.kind,
    args: check.proposal.args,
    deskView: { card: check.proposal.card, readBack: '', quote: null, source: 'proof' },
    path: check.proposal.path,
    expiresAt: new Date(now.getTime() + 10 * 60_000),
  })
  show(
    'confirm',
    await confirmSigninProposal(db, APPROVED_TOKENS, { proposalId, ownerAddress: owner, via: 'web' }),
  )
  show(
    'confirm again',
    await confirmSigninProposal(db, APPROVED_TOKENS, { proposalId, ownerAddress: owner, via: 'web' }),
  )

  // 2. The stock page's way, through the same checks: one far away, one refused.
  show(
    'form, Meta 10% above',
    await setPriceAlert(db, APPROVED_TOKENS, {
      ownerAddress: owner,
      deskId,
      symbol: 'META',
      direction: 'above',
      thresholdBps: 1000,
    }),
  )
  show(
    'form, 0.1%',
    await setPriceAlert(db, APPROVED_TOKENS, {
      ownerAddress: owner,
      deskId,
      symbol: 'META',
      direction: 'above',
      thresholdBps: 10,
    }),
  )
  show(
    'form, not a token',
    await setPriceAlert(db, APPROVED_TOKENS, {
      ownerAddress: owner,
      deskId,
      symbol: 'XYZ',
      direction: 'either',
      thresholdBps: 200,
    }),
  )

  // 3. A slot now: every token as it last was, and Nvidia 0.8% above its reference.
  const nvda = APPROVED_TOKENS.find((t) => t.symbol === 'NVDA')?.address.toLowerCase()
  const at = priceSlot(now)
  const rows = (await latestPricePoints(db)).map(({ id: _id, ...r }) => {
    if (r.token !== nvda || r.referenceE8 === null) return { ...r, at }
    return { ...r, at, gapBps: 80, poolMidE8: (r.referenceE8 * 10_080n) / 10_000n }
  })
  show('slot rows', await savePricePoints(db, rows))
  show('fired', await checkPriceAlerts(db, APPROVED_TOKENS, now))
  show('fired again', await checkPriceAlerts(db, APPROVED_TOKENS, now))
  const alerts = await ownerAlerts(db, owner)
  show(
    'alerts',
    alerts
      .slice(0, 3)
      .map((a) => ({ status: a.status, kind: a.kind, bps: a.thresholdBps, firedGapBps: a.firedGapBps })),
  )
  const inbox = (await ownerInbox(db, owner)).filter((n) => n.kind === 'price_alert')
  show(
    'bell',
    inbox.slice(0, 1).map((n) => n.payload),
  )
} finally {
  await close()
}
