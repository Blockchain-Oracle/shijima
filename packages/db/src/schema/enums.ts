/**
 * Every closed set in the data model. Postgres enums, so a typo is a type error in TypeScript and an error in
 * the database. Values are only ever ADDED. The wording the owner sees lives in `shared/copy`, never here.
 */
import { pgEnum } from 'drizzle-orm/pg-core'

// The desk. Design brief section 7: exactly one mode, and separately a state.
export const deskMode = pgEnum('desk_mode', ['shadow', 'ask_first', 'on_its_own'])
export const deskState = pgEnum('desk_state', [
  'active',
  'paused_by_owner',
  'stopped_by_loss_limit',
  'needs_attention',
])
export const deskLifecycle = pgEnum('desk_lifecycle', ['onboarding', 'running', 'closing', 'closed'])
export const mandateStatus = pgEnum('mandate_status', ['draft', 'applied', 'superseded'])

// The hourly check.
export const wakeTrigger = pgEnum('wake_trigger', ['cron', 'tick', 'manual', 'approval', 'skeleton'])
export const wakeStatus = pgEnum('wake_status', ['running', 'completed', 'failed', 'skipped'])

// The record. `decision` is what the desk decided. `execution` is the fresh record written when an approved
// request is carried out, holding `approvalOf` (architecture 1.4 step 9).
export const recordKind = pgEnum('record_kind', ['decision', 'execution'])

/**
 * The nine outcomes of design brief 8.10, plus `not_executed` for an execution record whose approval was
 * given but conditions had moved ("approved, conditions changed, not executed").
 * What happened to an `asked` request (approved, rejected, expired) lives on the approval row.
 */
export const decisionOutcome = pgEnum('decision_outcome', [
  'acted',
  'acted_in_part',
  'waited',
  'declined',
  'nothing_to_do',
  'blocked_by_limit',
  'asked',
  'failed',
  'would_have_acted',
  'not_executed',
  // The owner told the desk to act when it had chosen to wait. Every limit still held. Graded as the owner's call.
  'acted_by_override',
])
export const tradeSide = pgEnum('trade_side', ['buy', 'sell', 'sweep', 'redeem'])

// One on-chain transaction sent by the operator key.
export const actionKind = pgEnum('action_kind', ['buy', 'sell', 'sweep', 'redeem', 'checkpoint', 'pause'])
/**
 * planned      the record is committed, nothing is signed yet
 * prepared     signed. Hash and nonce are saved. NOT yet broadcast
 * sent         handed to the network
 * confirmed    receipt found, success
 * reverted     receipt found, failed on-chain
 * never_landed no receipt and it can no longer land
 */
export const actionStatus = pgEnum('action_status', [
  'planned',
  'prepared',
  'sent',
  'confirmed',
  'reverted',
  'never_landed',
])

export const deferralStatus = pgEnum('deferral_status', ['standing', 'broken', 'revisited', 'cancelled'])
export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled',
])
export const approvalReason = pgEnum('approval_reason', ['ask_first', 'large_action', 'owner_override'])
export const answerChannel = pgEnum('answer_channel', ['telegram', 'web', 'chat'])
export const gradeVerdict = pgEnum('grade_verdict', ['better', 'worse', 'no_real_difference', 'ungradable'])

// Money over time.
export const valueSnapshotKind = pgEnum('value_snapshot_kind', ['hourly', 'close', 'open', 'manual'])
export const cashFlowKind = pgEnum('cash_flow_kind', ['deposit', 'withdrawal', 'bridge_in_flight'])
export const cashFlowStatus = pgEnum('cash_flow_status', ['pending', 'confirmed', 'failed'])

// Market data.
export const referenceKind = pgEnum('reference_kind', ['close', 'open'])
export const multiplierEventKind = pgEnum('multiplier_event_kind', ['split', 'dividend', 'other'])
export const companyEventKind = pgEnum('company_event_kind', ['earnings', 'dividend', 'split', 'other'])
export const tokenFlag = pgEnum('token_flag', [
  'halted',
  'oracle_paused',
  'feed_unavailable',
  'beyond_band',
  'blocked',
  'company_event',
  'multiplier_changed',
  'better_tier_available',
])

// Plumbing.
export const deskEventKind = pgEnum('desk_event_kind', [
  'paused',
  'resumed',
  'mode_changed',
  'mandate_applied',
  'limits_changed',
  'operator_set',
  'operator_revoked',
  'loss_stop',
  'promoted',
  'demoted',
  'telegram_linked',
  'telegram_unlinked',
  'share_changed',
  'holdings_changed_outside',
  'closed',
  // The owner, or the owner's session key, made a recorded on-chain call: a sale, a vault move or a checkpoint.
  'owner_action',
  'session_granted',
  'session_revoked',
])
export const eventActor = pgEnum('event_actor', ['owner', 'desk', 'system'])
export const eventVia = pgEnum('event_via', ['web', 'telegram', 'chain', 'worker', 'chat'])
export const telegramLinkStatus = pgEnum('telegram_link_status', ['pending', 'linked', 'revoked'])
/** The message types of design brief section 9. Command replies are direct, so they are not in the outbox. */
export const notificationKind = pgEnum('notification_kind', [
  'status',
  'approval_request',
  'large_action_request',
  'acted',
  'would_have',
  'not_acted',
  'alert',
  'monday_report',
  'first_contact',
  'price_alert',
  // A request answered on the website or in the chat, or lapsed: the Telegram message is edited, never re-sent.
  'approval_answered',
])
export const notificationStatus = pgEnum('notification_status', ['pending', 'sent', 'failed', 'skipped'])
export const servMode = pgEnum('serv_mode', ['serv', 'raw'])

// The chat. The model only PROPOSES; the owner confirms; the saved proposal is what runs.
export const askRequestKind = pgEnum('ask_request_kind', ['ask', 'readback'])
export const askRequestStatus = pgEnum('ask_request_status', ['pending', 'claimed', 'answered', 'failed'])
/** Who confirms a proposal: the sign-in session, the owner's session key, or the owner's wallet. */
export const askPath = pgEnum('ask_path', ['signin', 'session', 'wallet'])
export const askProposalStatus = pgEnum('ask_proposal_status', [
  'open',
  'confirmed',
  'done',
  'refused',
  'expired',
  'failed',
])
export const checkRequestStatus = pgEnum('check_request_status', ['pending', 'done', 'refused'])
export const priceAlertKind = pgEnum('price_alert_kind', ['above_reference', 'below_reference', 'either_way'])
export const priceAlertStatus = pgEnum('price_alert_status', ['active', 'fired', 'cancelled'])
