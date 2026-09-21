/**
 * The only door to SERV Reasoning. Every model call in the product goes through servJson.
 *
 * Verified live on 2026-09-20 with gpt-5.4-mini: a strict JSON schema, serv_prompt_guard, serv_shadow_agent
 * and reasoning_effort "low" all work together in one request. About 6 to 10 s with SERV reasoning, about 3 s
 * raw. The header x-openserv-disable-braid gives raw mode, used only by the comparison page.
 *
 * SERV's safety tools can FAIL OPEN with no signal in the response (their own docs say to validate in the
 * application as well). So nothing returned here is trusted until it has passed zod AND the caller's own
 * checks. A failure of any kind means "no decision", never a retry loop that ends in a trade.
 */
import { errorText, toWireSchema } from '@desk/shared'
import OpenAI from 'openai'
import type { z } from 'zod'

const BASE_URL = 'https://inference-api.openserv.ai/v1'
const MAX_REPLY_TOKENS = 2000

/** SERV detects tools by the serv_ name prefix, applies them, and strips them before the model runs. */
const PROMPT_GUARD = { type: 'function', function: { name: 'serv_prompt_guard' } } as const
const shadowAgent = (hint: string, maxIterations: number) =>
  ({
    type: 'function',
    function: {
      name: 'serv_shadow_agent',
      description: 'Enable SERV shadow-agent validation.',
      // SERV reads these options from the JSON schema DEFAULTS, not from call arguments.
      parameters: {
        type: 'object',
        properties: {
          hint: { type: 'string', default: hint },
          max_iterations: { type: 'integer', default: maxIterations },
        },
      },
    },
  }) as const

export interface ServCallMeta {
  purpose: string
  promptVersion: string
  model: string
  mode: 'serv' | 'raw'
  latencyMs: number
  totalTokens: number | null
  finishReason: string | null
}
export type ServResult<T> =
  | { ok: true; value: T; meta: ServCallMeta }
  | { ok: false; error: string; meta: ServCallMeta }

export interface ServRequest<S extends z.ZodType> {
  apiKey: string
  purpose: string
  promptVersion: string
  system: string
  user: string
  schema: S
  schemaName: string
  model?: string
  raw?: boolean
  shadowHint?: string
  timeoutMs?: number
}

export async function servJson<S extends z.ZodType>(req: ServRequest<S>): Promise<ServResult<z.infer<S>>> {
  const model = req.model ?? 'gpt-5.4-mini'
  const mode = req.raw ? 'raw' : 'serv'
  const client = new OpenAI({
    baseURL: BASE_URL,
    apiKey: req.apiKey,
    maxRetries: 2,
    timeout: req.timeoutMs ?? 60_000,
  })
  const started = Date.now()
  const meta = (finishReason: string | null, totalTokens: number | null): ServCallMeta => ({
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    model,
    mode,
    latencyMs: Date.now() - started,
    totalTokens,
    finishReason,
  })
  try {
    const res = await client.chat.completions.create(
      {
        model,
        reasoning_effort: 'low',
        // SERV reserves the MAXIMUM a call could cost before it runs, and refuses the call if the balance is
        // below that. With no cap it reserved $0.25 for a call that really costs about a cent. A timing answer
        // is about 700 tokens, so this leaves room and keeps the reserve honest.
        max_completion_tokens: MAX_REPLY_TOKENS,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: req.schemaName, strict: true, schema: toWireSchema(req.schema) },
        },
        // Raw mode bypasses every SERV tool anyway, so they are only sent in SERV mode.
        ...(req.raw
          ? {}
          : {
              tools: [
                PROMPT_GUARD,
                shadowAgent(
                  req.shadowHint ?? 'Name exactly one option and cite only ids that were supplied.',
                  2,
                ),
              ],
            }),
      },
      req.raw ? { headers: { 'x-openserv-disable-braid': 'true' } } : undefined,
    )
    const choice = res.choices[0]
    const m = meta(choice?.finish_reason ?? null, res.usage?.total_tokens ?? null)
    if (!choice) return { ok: false, error: 'SERV returned no choice', meta: m }
    if (choice.message.refusal)
      return { ok: false, error: `SERV refused: ${choice.message.refusal}`, meta: m }
    if (choice.finish_reason !== 'stop')
      return { ok: false, error: `SERV stopped early: ${choice.finish_reason}`, meta: m }
    let json: unknown
    try {
      json = JSON.parse(choice.message.content ?? '')
    } catch {
      return { ok: false, error: 'SERV reply was not JSON', meta: m }
    }
    const parsed = req.schema.safeParse(json)
    if (!parsed.success)
      return {
        ok: false,
        error: `SERV reply failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
        meta: m,
      }
    return { ok: true, value: parsed.data, meta: m }
  } catch (e) {
    return { ok: false, error: errorText(e), meta: meta(null, null) }
  }
}
