/**
 * One exchange in the chat, in the shape the browser draws. The server builds it from the saved request and its
 * proposal, for the history and for each poll, so the thread and a fresh answer can never disagree.
 */
export type ChatPath = 'signin' | 'session' | 'wallet'

export interface ChatCard {
  id: string
  kind: string
  path: ChatPath
  status: 'open' | 'confirmed' | 'done' | 'refused' | 'expired' | 'failed'
  title: string
  before: string[]
  after: string[]
  note: string | null
  expiresAt: string
  /** What happened when it was confirmed, in words. */
  result: string | null
  txHash: string | null
}

export interface ChatTurn {
  id: string
  question: string
  status: 'pending' | 'claimed' | 'answered' | 'failed'
  reply: string | null
  refused: string | null
  cites: string[]
  chart: { symbol: string; days: number } | null
  error: string | null
  card: ChatCard | null
  at: string
}

interface SavedProposal {
  id: string
  kind: string
  path: ChatPath
  status: ChatCard['status']
  deskView: Record<string, unknown>
  expiresAt: Date
  result: Record<string, unknown> | null
  txHash: string | null
}

interface SavedRequest {
  id: string
  question: string
  status: ChatTurn['status']
  reply: Record<string, unknown> | null
  error: string | null
  createdAt: Date
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function toChatTurn(request: SavedRequest, proposal: SavedProposal | null): ChatTurn {
  const reply = request.reply ?? {}
  const chart = reply.chart as { symbol?: unknown; days?: unknown } | null | undefined
  const card = (proposal?.deskView.card ?? {}) as Record<string, unknown>
  const result = proposal?.result ?? null
  return {
    id: request.id,
    question: request.question,
    status: request.status,
    reply: text(reply.reply),
    refused: text(reply.refused),
    cites: strings(reply.cites),
    chart:
      chart && typeof chart.symbol === 'string' && typeof chart.days === 'number'
        ? { symbol: chart.symbol, days: chart.days }
        : null,
    error: request.error,
    card: proposal
      ? {
          id: proposal.id,
          kind: proposal.kind,
          path: proposal.path,
          status: proposal.status,
          title: text(card.title) ?? proposal.kind,
          before: strings(card.before),
          after: strings(card.after),
          note: text(card.note),
          expiresAt: proposal.expiresAt.toISOString(),
          result: text(result?.text),
          txHash: proposal.txHash,
        }
      : null,
    at: request.createdAt.toISOString(),
  }
}
