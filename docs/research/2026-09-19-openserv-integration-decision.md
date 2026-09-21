# How we integrate with OpenServ, and what the platform gives us for free

> **SUPERSEDED IN PART by `architecture/02-openserv-integration.md` (2026-09-19, checked against the
> real npm packages).** Do not build from this file. What changed:
> - `triggers.cron('0 * * * *')` below is broken. It must be `triggers.cron({ schedule: '0 * * * *' })`.
> - Telegram does NOT go through the OpenServ integration. We run our own bot. The platform exposes no
>   way to send, edit, or receive button presses, and it would block our own bot on the same token.
> - `requestHumanAssistance` cannot be used for owner approvals. Only we could answer it, in their UI.
> - Platform secrets are not where the desk's key lives. Use the host's secrets.
> - `run(agent)` with the tunnel is for development only. It goes deaf after about 2.5 minutes of failed
>   reconnects while the process keeps running. Production is self hosted with a public URL.
> - By default every task passes through the platform's own model, which invents the arguments. We
>   override `doTask` so our code runs directly.
> - The timeouts and retry counts quoted below come only from a ten month old video.
>
> Still true: the two-products framing, the decision to call SERV Reasoning directly with our own key,
> MCP out of scope, and the agent being a self hosted "external" agent woken by an OpenServ cron trigger.


Written 2026-09-19. Sources: the platform-basics transcript (2025-11-11, ~10 months old, so treat its
UI flows as dated), `https://docs.openserv.ai/llms-full.txt` (366 KB, fetched today), and
**direct inspection of the installed packages** `@openserv-labs/sdk@2.4.1` and
`@openserv-labs/client@2.5.3`. Where the docs and the package disagree, the package wins and the
disagreement is flagged.

---

## 1. Two products, one requirement

| | SERV Reasoning | The OpenServ platform |
|---|---|---|
| What it is | An inference API. OpenAI/Anthropic wire-compatible | Workflows, agents, triggers, integrations, MCPs, secrets, files |
| Where | `inference-api.openserv.ai` | `platform.openserv.ai` |
| Console | `console.openserv.ai` | `platform.openserv.ai` |
| Key | `SERV_API_KEY` | `WALLET_PRIVATE_KEY` (see §5) |
| Hackathon requirement | **Yes.** "leverages SERV Reasoning" | **No.** Never mentioned on the hackathon page |

**The decision: we do both, and the reasoning call must be direct.**

The platform's own LLM calls are documented as "Platform-managed (auto)" and
"platform-delegated ... using your OpenServ credits (no API key required)" (llms-full lines 5187,
5406). Nothing in the docs says those calls route through SERV Reasoning. So a runless capability or
`this.generate()` is **not** a safe way to satisfy "leverages SERV Reasoning".

Every decision the desk makes therefore goes through our own `SERV_API_KEY` against
`inference-api.openserv.ai`, with a strict JSON schema, `serv_prompt_guard`, and `serv_shadow_agent`.
`this.generate()` is reserved for cosmetic text only (phrasing a Telegram message), never for a
decision. That keeps the requirement unambiguous.

**Why integrate with the platform at all, when it is not required?** Because all four visible
competitors in this track skipped it. Alloc, Pond Agent, ThoughtProof and IntentLease are each a
custom app calling the inference API. If we are the one entry that is genuinely an agent living on
OpenServ's own rails, we look like the reference implementation for the thing they built, and the
platform hands us most of the add-ons for free. The judges are OpenServ.

---

## 2. What we build: an "external" agent

Confirmed in the package: `types.d.ts` declares `AgentKind = 'external' | 'eliza' | 'openserv'`.
"External" is the self-hosted, full-code-control agent the transcript describes at 7:00, and it is
what we want. The docs call it the **Runnable** pattern.

```ts
import { Agent, run } from '@openserv-labs/sdk'
import { provision, triggers } from '@openserv-labs/client'
import { z } from 'zod'

const agent = new Agent({ systemPrompt: '...' })

agent.addCapability({
  name: 'review_desk',
  description: 'Review the desk and decide whether to act',
  inputSchema: z.object({ deskId: z.string() }),
  async run({ args, action }) {
    // our code: read chain, call SERV directly, run the policy engine, execute
    return 'summary string'
  },
})

const result = await provision({
  agent: { instance: agent, name: 'desk', description: '...' },
  workflow: { name: '...', goal: '...', trigger: triggers.cron('0 * * * *'), task: { description: '...' } },
})
await run(agent) // local server + automatic tunnel, no ngrok
```

Runless capabilities (`{ name, description }` with no `run()`) are the no-code path. We do not use
them for decisions, per §1.

### Verified Agent API surface (from the installed package, not the docs)

`addCapability`, `addCapabilities`, `addMCPToolsAsCapabilities`, `initializeMCPClients`,
`callIntegration`, `generate`, `getSecrets`, `getSecretValue`, `uploadFile`, `getFiles`, `deleteFile`,
`requestHumanAssistance`, `sendChatMessage`, `getChatMessages`, `createTask`, `getTasks`,
`getTaskDetail`, `updateTaskStatus`, `addLogToTask`, `completeTask`, `markTaskAsErrored`,
`respondToChat`, `doTask`, `process`, `start`, `stop`, `getAgents`, `setCredentials`, `openai`,
`openAiTools`, `defineRoutes`.

Exports: `Agent`, `Capability`, `OpenServTunnel`, `run`.

Note `requestHumanAssistance` and `addMCPToolsAsCapabilities` exist in the package but appear
**nowhere** in `llms-full.txt`. They are real; the docs are incomplete.

---

## 3. MCP: out of scope

Decided by Abu on 2026-09-19. We are not building on, consuming, or publishing any MCP. Not the
Robinhood brokerage MCP, not a community Robinhood Chain MCP, not our own. The agent talks to
Robinhood Chain directly in its own code. Do not reintroduce MCP without Abu asking for it.

---

## 4. The add-on inventory: what the platform gives us without building it

This is the answer to "what cool stuff does OpenServ already contain". Each line is a feature we
would otherwise hand-build.

| Platform feature | What it becomes in our product |
|---|---|
| **Cron trigger** (`triggers.cron(schedule)`) | The desk wakes on a schedule. This *is* the after-hours desk: hourly while markets are closed. No scheduler to build, no VPS cron. |
| **Telegram integration + `on-message` trigger** | The notification and approval channel. The desk messages you when it wants to act; you reply to approve or reject. Telegram is the only integration with its own trigger, so a reply can drive the workflow. |
| **`requestHumanAssistance()` + task status `human-assistance-required`** | The approval ceremony as a first-class platform state, not something we invent. The task genuinely parks until a human answers. |
| **Secrets** (`getSecrets`, `getSecretValue`) | The desk's wallet key, stored by the platform rather than in our `.env`. Explicitly built for web3 keys (transcript 13:08). |
| **Webhook trigger** (`waitForCompletion`, `timeout: 600`) | How our own web UI asks for a fresh decision and blocks for the answer. |
| **Files + automatic RAG** (`uploadFile`, `getFiles`) | Every daily brief, decision record and receipt is indexed automatically. The user can then ask plain-language questions about their own history with no vector store to build (transcript 23:27). |
| **x402 trigger** (`triggers.x402({ price: '0.01' })`) | A paywalled endpoint that returns a `paywallUrl`. Other people's agents pay per call to ask our desk a question. Revenue without a token. |
| **Templates, token-gated via x402** | We publish the desk as a template. Other people clone it, we earn. Native platform monetization, directly answering the "revenue potential" criterion. |
| **ERC-8004 on-chain identity** (`client.erc8004.registerOnChain()`, Base mainnet) | The desk gets a discoverable on-chain identity with its paywall details attached. |
| **Marketplace agents** | Compose with what exists rather than build it: there is a Polymarket data-analysis agent and Hyperliquid chart/trading agents already on the platform (transcript 5:01), plus research and media agents. |
| **Twitter integration** (`twitter-v2`) | The desk can post its own weekly track record publicly. A social proof layer, and a submission asset. |
| **Sessions + concurrency + timeouts** | Multi-user isolation for free. A session per user, configurable concurrency, 60-minute workflow and 10-minute task timeouts, 3 retries. |

The shape this implies: **cron wakes the desk, our code reads the chain, SERV decides, the policy
engine gates, Telegram asks the human, the chain executes, the receipt is filed as a workspace file,
and the whole thing is also reachable by webhook from our UI and by x402 from other agents.**

Notice how much of the "add-ons" conversation that answers. Notifications, scheduling, approvals,
key storage, history search, monetization and social proof are all platform primitives here.

---

## 5. What changed since the transcript (do not follow the video's flow)

The video is from 2025-11-11. Three things in it are stale:

1. **Hosting and tunnels.** The video says host it yourself, expose a public URL, paste it in, use an
   ngrok URL for local testing. Current SDK: `run(agent)` starts a local server and opens an
   automatic tunnel. No ngrok. For production, `DISABLE_TUNNEL=true` with a real `endpointUrl`, or
   `npx @openserv-labs/client deploy .` to OpenServ's managed cloud.
2. **Auth.** The video says create a secret key in the UI and paste it into your agent. Current docs
   say `WALLET_PRIVATE_KEY` is generated by `provision()` on first run and is "The ONLY key — do NOT
   invent `OPENSERV_USER_API_KEY`, `OPENSERV_API_KEY`, or any other". The SDK still has
   `setCredentials`, so the older path may still work. **Unresolved; settle on day one.**
3. **Registration.** The video walks through the UI (Add agent → paste endpoint → create secret).
   Current path is `provision()` in code, which registers agent, workflow and trigger in one
   idempotent call and writes `.openserv.json`.

Also note: the docs say MCP support is "SSE and HTTP classic, streaming support coming soon", but the
installed package already ships a Streamable HTTP transport. The docs lag the package.

---

## 6. Open questions to settle on day one

1. **Auth model.** `WALLET_PRIVATE_KEY` only, or does the UI secret-key path still work? (§5.2)
2. **`provision()` needs gas.** ERC-8004 registration is on Base mainnet and the docs warn to wrap it
   in try/catch "if you run out of gas". Confirm what `provision()` itself costs, if anything.
3. **Tools plus `reasoning_effort`.** Pond Agent's source implies function tools on `gpt-5.4-mini`
   only work with `reasoning_effort: 'none'`. One test call settles it.
4. **Does the cron trigger survive a local `run(agent)` going down?** If the agent is not running when
   cron fires, what happens? This decides whether we need a VPS for the demo period.
5. **Whether a platform-registered agent is visible to judges** without them having our account.

## 7. Still unverified from the earlier research pass (agent was interrupted)

These were being checked when the research run was cut off, and the product definition depends on
them:

- The Morpho USDG vault address on chain 4663, whether it is ERC-4626, and whether deposits are
  permissionless. This decides whether "idle cash earns yield" is real.
- Gas sponsorship support for chain 4663 (Alchemy Gas Manager, ZeroDev, Pimlico).
- Whether Uniswap and Morpho exist on testnet 46630 at all, which decides whether the mainnet/testnet
  toggle can offer the same features on both sides.
- How dividends are actually reflected in `uiMultiplier()`, and whether a multiplier change emits an
  event we can watch.

Verified independently today, for the record: NVDA, SPY and SPCX all respond on mainnet with
`uiMultiplier()` and `oraclePaused()`; Chainlink feeds were 12 to 23 hours stale on a Saturday as
expected; a $10K USDG buy moved the NVDA pool price by under 5 basis points; 98 of the 194 stock
tokens have a routable USDG pool, 96 of them on Uniswap v3.
