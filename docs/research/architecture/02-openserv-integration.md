# 02. OpenServ platform integration: what is real, what is not

Researched 2026-09-19. Every claim is labelled **VERIFIED** with a source, or **UNVERIFIED**.
Where the docs and the published package disagree, the package wins and the conflict is flagged.
MCP is out of scope and is not recommended anywhere in this document.

## Sources and how they were checked

| Source | Version or date | How it was used |
|---|---|---|
| `https://docs.openserv.ai/llms-full.txt` | fetched 2026-09-19, 366,756 bytes, 7,236 lines | grepped. Cited as `docs L<line>` |
| `@openserv-labs/sdk` | 2.4.1, published 2026-02-12 | `npm pack`, read `dist/*.d.ts` and `dist/*.js`. Cited as `sdk:<file>` |
| `@openserv-labs/client` | 2.5.3, published 2026-03-12 | same. Cited as `client:<file>` |
| GitHub `openserv-labs/sdk`, `/client`, `/skills` | HEAD on 2026-09-19 | cloned, read source and READMEs |
| GitHub `openserv-labs/simple-telegram-openserv-bot` | last push 2025-06-17 | OpenServ's own Telegram example |
| Context7 `/openserv-labs/openserv-docs` | 250 snippets | searched for Telegram call shapes |
| `https://core.telegram.org/bots/api` | fetched 2026-09-19 | Telegram side rules |
| Platform basics video transcript | recorded 2025-11-11, about 10 months old | only source for some UI defaults. Treated as dated |
| Real TypeScript compile | `tsc --strict`, TypeScript 5.9.3 | the recipe in section 5 compiles with exit code 0 |

Two maturity signals worth knowing. The SDK has had no npm release for 7 months. The client repo
HEAD is ahead of npm: a fix merged on 2026-09-09 is not published (see section 3).

---

## 1. Bottom line

1. **Run the Telegram bot ourselves with grammY. Do not connect the bot token to OpenServ.**
   Nothing in the docs, either package, the skills repo, or Context7 shows how to call Telegram
   through `callIntegration`. Not one Bot API method name appears in 366 KB of docs. Telegram
   allows one update consumer per bot token, and the platform trigger is a consumer. OpenServ's
   own official Telegram example does the same thing: it holds the token and polls by itself.
2. **Self host the agent with `DISABLE_TUNNEL=true` and a public `endpointUrl`.** The tunnel gives
   up for good after about 2.5 minutes of failed reconnects and the process keeps running while
   deaf. Managed cloud has no secret store and the published CLI does not upload `.env`.
3. **Override `doTask` so our code runs directly.** By default every task goes through the
   platform's LLM, which picks a capability and invents the `args`. That costs platform credits
   and is not deterministic. The override is an officially documented pattern.
4. **Do not use `requestHumanAssistance` for approvals.** There is no API to answer one. Owners are
   not OpenServ users. Approvals live in our Postgres.
5. **Keep a fallback scheduler.** Cron failure behaviour is undocumented. A small internal timer
   that checks "has this hour's review run" makes the platform cron a nice-to-have, not a
   single point of failure.
6. **`provision()` is free and gasless**, but its idempotency depends on a local file. Lose
   `.openserv.json` and the next boot registers a duplicate agent.

---

## 2. Answers to the eleven questions

### Q1. Telegram integration call shape

- **VERIFIED.** The real method is `agent.callIntegration({ workspaceId, integrationId, details })`.
  It does one thing: `POST /workspaces/{workspaceId}/integration/{integrationId}/proxy` with
  `details` as the body. Source: `sdk:dist/agent.js` line 998.
- **VERIFIED.** `details` is typed as `ProxyConfiguration`: `endpoint` (required), `method`,
  `data`, `headers`, `params`, `retries`, `baseUrlOverride`, `responseType`, `retryOn`,
  `providerConfigKey`, `connectionId`, `decompress`. Source: `sdk:dist/types.d.ts`. This is the
  shape of a Nango proxy request.
- **VERIFIED.** The only worked examples anywhere are `twitter-v2` (`endpoint: '/2/tweets'`) and
  `github`. Both are OAuth proxy integrations. Sources: `sdk:README.md` L762, Context7.
- **VERIFIED.** Telegram is a different kind of integration. `listConnections()` reports it as
  `integrationType: "custom"`, not `"nango"`. Source: docs L5975 to L5982.
- **UNVERIFIED.** Whether the proxy is a raw Bot API passthrough for Telegram. Whether
  `endpoint: '/sendMessage'` works. Whether `reply_markup`, `editMessageText`, `pinChatMessage`,
  `answerCallbackQuery` or `setMyCommands` are reachable. **There is no evidence either way.**
  The word "telegram" appears zero times in the SDK, the client, and the skills repo. The strings
  `sendMessage`, `chat_id`, `reply_markup`, `callback_query` and `editMessageText` appear zero
  times in the docs.
- **VERIFIED.** What the docs do describe is an LLM driven path: attach the connection to a task
  node and it "Lets the agent read/send Telegram messages" (docs L5990). That means the platform's
  own model decides when and what to send. It is not a deterministic API for us to call.

The exact call shape, for the record, is this. Only the outer structure is verified. The
`endpoint` value for Telegram is a guess and must not be relied on.

```ts
await agent.callIntegration({
  workspaceId: action.workspace.id,
  integrationId: 'telegram-bot',        // identifier VERIFIED (docs L6096). Usable here: UNVERIFIED
  details: { endpoint: '/sendMessage', method: 'POST', data: { chat_id, text } } // UNVERIFIED
})
```

### Q2. Telegram trigger

- **VERIFIED.** Telegram is the only integration with its own trigger type, named `on-message`
  (docs L5946, L6096).
- **VERIFIED.** `provision()` cannot create it. The client maps exactly four trigger types to
  connections: `x402`, `webhook`, `cron`, `manual`. Source: `client:src/workflows-api.ts` L545 to
  L552. The docs agree (L4644).
- **VERIFIED.** Wiring takes five manual steps, one of them a raw REST call (docs L4644 to L4649):
  create the trigger with `trigger_name: 'on-message'` and `props: { regexMatch: '.*' }`, create a
  task, `POST /workspaces/{id}/tasks/{taskId}/integration-connections` with header
  `x-openserv-key`, `PUT /workspaces/{id}/sync` with hand built nodes and edges, then
  `setRunning`. The docs warn that `POST /edges` returns 404.
- **VERIFIED.** The connection must first be created by hand in the platform UI by pasting the
  BotFather token (docs L5952 to L5958).
- **UNVERIFIED. The payload.** The SDK types the event as `payload: { event: unknown; summary:
  string }[]` (`sdk:dist/types.d.ts`, `TriggerEvent`). `unknown` is the literal type. No sample
  payload exists in any source. Chat id, user id, text and message id are probably inside `event`,
  but nothing confirms it.
- **UNVERIFIED, and unlikely: callback_query delivery.** The trigger is named `on-message` and its
  one documented prop is a text `regexMatch`. A button press has no text to match. Telegram also
  lets a consumer restrict update types with `allowed_updates` (VERIFIED, Bot API `getUpdates`).
  If the platform asks only for `message`, button presses are never delivered to anyone.
- **Webhook or polling: UNVERIFIED which, but it does not matter.** The transcript says the
  trigger "keeps listening as long as it's enabled and in run mode" (21:02). Telegram states:
  "There are two mutually exclusive ways of receiving updates" and `getUpdates` "will not work if
  an outgoing webhook is set up" (VERIFIED, Bot API). Either way the platform is the single
  consumer, and **grammY on the same token would conflict with it.**
- **VERIFIED.** Each Telegram message becomes a platform task with its own session per user
  (transcript 16:26 and 21:02). For us that would mean `/pause` costs an LLM task run.
- **VERIFIED precedent.** `openserv-labs/simple-telegram-openserv-bot` ignores the platform
  integration. It depends on `node-telegram-bot-api`, constructs the bot with `{ polling: true }`
  from its own `TELEGRAM_BOT_TOKEN`, and uses the SDK only to create tasks and read results.
  Source: that repo, `src/index.ts` L32, `package.json`.

**Best approval path.** Own the bot. Then inline `callback_data` buttons simply work, because we
are the consumer. Add a URL button to the web app as a second route for owners who want detail
before approving. Reply text is the weakest option and is only needed if we were forced onto the
platform trigger.

### Q3. How `run()` receives trigger input

**VERIFIED** signature, from `sdk:dist/agent.d.ts`:

```ts
run(this: Agent, params: { args: z.infer<S>; action: ActionSchema }, messages: ChatCompletionMessageParam[]): string | Promise<string>
```

**VERIFIED** fields on the `do-task` action, from `sdk:dist/types.d.ts`:

| Field | Type | Meaning |
|---|---|---|
| `action.type` | `'do-task' \| 'respond-chat-message'` | narrow on this before touching `task` |
| `action.workspace.id` | `number \| string` | workspace id, same thing as workflow id |
| `action.task.id` | `number \| string` | task id |
| `action.task.input` | `string \| null` | task input |
| `action.explicitInput` | `unknown \| null` | |
| `action.task.triggerEvent` | `TriggerEvent \| null` | holds `trigger_name`, `integrationName`, `payload[].event` |
| `action.triggerEvents` | `TriggerEvent[]` | |
| `action.task.humanAssistanceRequests[]` | includes `humanResponse`, `status: 'pending' \| 'responded'` | |
| `action.workspaceExecutionId` | `number` | one per run |
| `action.me.id` | `number` | our agent id |

**VERIFIED, and important. `args` is not the trigger payload.** The default `doTask` posts the
task plus our capability schemas to `https://agents.openserv.ai/runtime/execute`. The platform's
model then chooses a capability and generates the arguments, and only then calls back to
`POST /tools/:toolName` on our server. Source: `sdk:dist/agent.js`, `doTask` and
`handleToolRoute`. The default model is `gpt-5-mini` (`client:dist/provision.d.ts`). So with a
cron trigger, which has no input, `args` is whatever the model makes up from the task
description.

**UNVERIFIED.** Which of `task.input`, `explicitInput` and `triggerEvent.payload[0].event` holds
the raw webhook JSON body. No source says. Log all three on the first live fire.

**VERIFIED way out.** Subclass `Agent` and override `protected doTask(action)`. The SDK comment
says it "can be overridden by extending classes to customize task handling", and the SDK README
shows the pattern at L989. Our code then runs directly with no platform model in between.
Note the README snippet is stale: it imports a `doTaskActionSchema` that does not exist in 2.4.1.
The `DoTaskActionSchema` type is also missing from the package index. Import it from
`@openserv-labs/sdk/dist/types.js`. This works because the package has no `exports` field, and it
is confirmed by the compile in section 5.

### Q4. Cron semantics and multiple workflows

- **VERIFIED.** Signature is `triggers.cron({ schedule, timezone?, name?, description? })`.
  Five field cron. Timezone is an IANA name and defaults to `"UTC"`. Source:
  `client:dist/triggers-api.d.ts` and `.js`.
- **VERIFIED.** A 16:00 New York snapshot is `{ schedule: '0 16 * * 1-5', timezone:
  'America/New_York' }`. The IANA zone handles daylight saving.
- **UNVERIFIED. Everything about failure.** What happens when our endpoint is down at fire time,
  whether the fire is retried, queued or dropped, and what state the task lands in. No source
  covers it. The docs only say "Make sure the agent server is running" (L6086).
- **UNVERIFIED in current sources.** Workflow timeout 60 minutes, task timeout 10 minutes, max
  retries 3, concurrency 1 per session and 3 per workspace. These are UI defaults read aloud in
  the 2025-11-11 video (16:26). They are not in the docs or either package. What is VERIFIED is
  the webhook and x402 trigger `timeout`, default 600 seconds (`client:dist/triggers-api.js`).
  The cron config has no timeout field at all.
- **VERIFIED.** The `/health` route is registered before the auth middleware so that "the
  platform health cron can reach it" (`sdk:dist/agent.js`, comment in `start()`).
  `provision()` re-activates triggers on every boot because "A health check or other process may
  have disabled them" (`client:dist/provision.js`). **So the platform can switch our triggers off
  after failed health checks.** The threshold is UNVERIFIED.
- **VERIFIED.** One agent can serve several workflows. `provision()` takes exactly one workflow
  with one trigger per call, and stores state under `workflows[agentName][workflowName]`. Call it
  once per workflow with the same `agent.name` and a different `workflow.name`. Section 5 shows
  this compiled.
- **VERIFIED.** The lower level `client.workflows.create({ triggers: [...] })` accepts an array,
  so one workflow can hold several triggers. `provision()` does not expose that.
- **VERIFIED trap.** On every boot `provision()` calls `workflow.sync()`, which rebuilds the whole
  node and edge graph from its config (`client:src/workflows-api.ts`, `syncInternal`). A Telegram
  trigger hand wired into a provisioned workflow would be dropped from the graph on the next
  restart. Another reason to keep Telegram off the platform.

### Q5. Hosting

| | Tunnel, `run(agent)` | Self hosted, `DISABLE_TUNNEL=true` | Managed, `client deploy .` |
|---|---|---|---|
| Needs | nothing public | public HTTPS URL, passed as `endpointUrl` | `OPENSERV_USER_API_KEY`, entry file at `src/agent.ts` |
| Secrets | our own env | our own env | plaintext `.env` inside their container. No secret store |
| Persistence | ours | ours | container on Fly.io, `continuous` mode |
| Cost | free | our host, a few dollars a month | UNVERIFIED. No pricing in any source |
| Fit for 24/7 | **No** | **Yes** | risky |

- **Tunnel. VERIFIED not fit for 24/7.** It reconnects at most 10 times with backoff of 0, 1, 2,
  4, 8, 16, 30, 30, 30, 30 seconds, about 151 seconds in total. It then enters a terminal
  `failed` state. `run()` only logs the error. Nothing restarts the tunnel and nothing exits the
  process. Source: `sdk:dist/tunnel.js` L14, L58 to L68, L418 to L428, and `sdk:dist/run.js`.
  The result is a live process that the platform cannot reach, which a supervisor will not
  notice. The SDK README itself labels the tunnel "Development & testing".
- **Self hosted. VERIFIED and officially recommended.** "Deploy your custom agent to a VPS with
  `DISABLE_TUNNEL=true` and set the `endpointUrl` in `provision()`" (docs L4520). The platform
  calls `POST /` and `POST /tools/:name` on our URL. Requests are authenticated with a bcrypt
  check of header `x-openserv-auth-token` against `OPENSERV_AUTH_TOKEN`
  (`sdk:dist/agent.js`, `start()`). `AGENT_ENDPOINT_URL` also works as an env var
  (`client:dist/provision.js`). Default port is 7378.
- **Managed cloud. VERIFIED facts.** The orchestrator is `agent-orchestrator.openserv.ai`.
  Containers are Fly.io apps. The entrypoint is hard coded to `npx tsx src/agent.ts` with no
  override flag. `npm install` runs in the container with a 10 minute limit. Upload cap is 100 MB.
  There is no env or secrets API: the only way to get configuration in is to upload `.env`.
  Source: `client:dist/deploy/*.js` and the repo README.
- **Managed cloud, docs versus package conflict. Package wins.** See section 3, item 1. With npm
  2.5.3, a gitignored `.env` and `.openserv.json` are **not** uploaded.

**Recommendation.** Self host on one always-on container with a persistent volume, for example
Railway or Fly.io. One Node process runs three things: the OpenServ agent HTTP server, the grammY
bot, and the fallback timer. It needs the same Postgres as the web app. Do not put it on Vercel:
this is a long lived process and Vercel functions are not. For a desk that signs on-chain
transactions, a plaintext key file in a third party container with no secret store is not
acceptable, which rules out managed cloud on its own.

### Q6. Auth and cost of `provision()`

- **VERIFIED.** `WALLET_PRIVATE_KEY` is the only credential needed. If absent, `provision()`
  generates a key with viem and appends it to `.env`. It signs in with SIWE, receives a user API
  key, and caches it in `.openserv.json`. Source: `client:dist/provision.js` L190 to L240.
- **VERIFIED.** It can skip the wallet entirely with `provision({ userApiKey, ... })`.
- **VERIFIED. No on-chain transaction, no gas.** `provision.js` contains zero references to
  ERC-8004 or to any contract write. The SIWE signature is off-chain.
- **VERIFIED. ERC-8004 is optional and separate.** It is `client.erc8004.registerOnChain()`, run
  after `provision()`. It mints on Base mainnet and needs ETH in a wallet that "starts with an
  empty balance" (docs L4235). Skip it, or wrap it in try and catch as the docs advise.
- **VERIFIED. Files written.** `.openserv.json` in the working directory holds `userApiKey`,
  `agents[name] = { id, apiKey, authToken, endpointUrl }` and
  `workflows[agent][workflow] = { workspaceId, triggerId, triggerToken }`. `.env` gets
  `WALLET_PRIVATE_KEY`. **`.openserv.json` contains live secrets. Gitignore it.**
- **VERIFIED, with a catch. Idempotency is local, not server side.** The lookup is by name inside
  `.openserv.json`. With the file present, it updates. With the file missing, it creates a new
  agent and new workflows, even if identical ones already exist on the platform. A fresh
  container without the file means duplicates and orphaned cron triggers still firing at the old
  agent.
- **VERIFIED.** On update it preserves the endpoint in this order: `config.endpointUrl`, then
  `AGENT_ENDPOINT_URL`, then the current platform value, then the tunnel proxy.

### Q7. Webhook trigger from the Next.js backend

- **VERIFIED.** URL is `https://api.openserv.ai/webhooks/trigger/{triggerToken}`. Method POST,
  `Content-Type: application/json`, JSON body. No auth header. The token in the URL is the
  secret, so treat it as one. Sources: docs L4398, skills `openserv-client/reference.md` L295,
  `client:dist/triggers-api.js` L332.
- **VERIFIED.** `triggers.webhook({ waitForCompletion: true, timeout: 600, input: {...} })`. With
  `waitForCompletion` the call "blocks until done, can take up to 10 minutes" (docs L4420). The
  response is the workflow result.
- **VERIFIED.** `provision()` returns the token as `result.triggerToken`, and later
  `getProvisionedInfo(agentName, workflowName).triggerToken`.
- **Minor conflict, flagged.** `provision()` returns an `apiEndpoint` of the form
  `/workspaces/{id}/triggers/{triggerId}/fire`. Everything else, including the client's own
  `fireWebhook()`, uses `/webhooks/trigger/{token}`. Use the token URL.
- **VERIFIED.** A 404 means a wrong token or an inactive trigger. A timeout means the agent is
  down or slow (docs L4526 to L4528).
- **Practical limit.** A Vercel function cannot hold a request for 10 minutes. Use
  `waitForCompletion: false` and have the agent write its result to Postgres, or call our agent
  process directly. Since both are ours and share a database, the direct call is simpler. The
  webhook is worth keeping as the visible "on OpenServ rails" entry point.

### Q8. `requestHumanAssistance`

- **VERIFIED signature.** `requestHumanAssistance({ workspaceId, taskId, type: 'text' |
  'project-manager-plan-review', question: string | object, agentDump?: object })`. It posts to
  `/workspaces/{id}/tasks/{taskId}/human-assistance`. A string question is wrapped as
  `{ type: 'text', question }`, an object as `{ type: 'json', ...question }`.
- **VERIFIED.** Task status `human-assistance-required` exists. When the task is dispatched again
  the answer arrives at `action.task.humanAssistanceRequests[].humanResponse` with
  `status: 'responded'`.
- **VERIFIED. There is no way to answer one in code.** The client's task API has `create`, `get`,
  `list`, `update`, `delete` and nothing else. The phrases "human assist" and `humanResponse`
  appear nowhere in the client source or the skills repo, and once in the docs, as marketing copy
  (L6555). Whether a hidden REST endpoint exists is UNVERIFIED.
- **Verdict: platform UI only, not usable for our approvals.** Owners have no OpenServ account and
  cannot see our workspace. The task would also sit parked against an unverified timeout. Keep
  approvals in Postgres with their own expiry.

### Q9. Secrets and files

- **VERIFIED.** `getSecrets({ workspaceId })` returns `{ id: number; name: string }[]`.
  `getSecretValue({ workspaceId, secretId })` returns a `string`. Endpoints are
  `/workspaces/{id}/agent-secrets` and `/agent-secrets/{secretId}/value`.
- **VERIFIED limits of the design.** Read only: the SDK and client have no method to create a
  secret, so they are created by hand in the UI. They are scoped per workspace, and each of our
  workflows is its own workspace, so every secret would need entering once per workflow. Lookup
  is by numeric id, so code must list then match by name.
- **Verdict.** Not worth it when self hosting. Use the host's own env secrets. This corrects the
  earlier plan to keep the desk wallet key in platform secrets.
- **VERIFIED.** `uploadFile({ workspaceId, path, file: Buffer | string, taskIds?, skipSummarizer?
  })` returns `{ fileId, fullUrl, summary? }`. It is a multipart POST to
  `/workspaces/{id}/file`. `getFiles` returns `{ id, path, fullUrl, summary, size }[]`.
  `deleteFile({ workspaceId, fileId })`.
- **UNVERIFIED.** Any size limit, quota or retention. The only hard numbers in the code are our
  own server's 10 MB inbound JSON limit and the tunnel's 100 MB response cap. Files are also per
  workspace. Pass `skipSummarizer: true` for machine records to avoid an LLM summary per upload.

### Q10. Visibility to judges

- **VERIFIED.** Agents have a private or public toggle and a "Submit an agent for review to list
  it on the marketplace" step (docs L899, L900). The client type carries `approval_status:
  "approved" | "rejected" | "pending" | "in-development"` and `is_listed_on_marketplace`.
- **UNVERIFIED.** How long review takes, and whether a public but unlisted agent can be opened by
  someone outside our account. With submissions closing 2026-09-28, do not plan around a
  marketplace listing.
- **UNVERIFIED.** The "enable data collection" setting at
  `console.openserv.ai/settings/organization`. It is not in `llms-full.txt`. Our only source is
  the hackathon page, recorded in `docs/research/2026-09-19-hackathon-research.md`. Note that the
  console is the SERV Reasoning product, not the agent platform, so this rule concerns our
  inference traffic. Turn it on before the first real request.
- **Practical answer.** Judges will judge the web app, the Telegram bot, the video and the repo.
  Give them platform proof without needing access: screenshots of the agent page and task runs,
  the agent id, and a public X post. Treat a marketplace listing as a bonus.

### Q11. SERV Reasoning API

- **VERIFIED.** Base URL `https://inference-api.openserv.ai`. Bearer `SERV_API_KEY`. Endpoints
  `/v1/chat/completions` for every model, `/v1/responses` for OpenAI models only, `/v1/messages`
  in Anthropic format (docs L1510 to L1535). The OpenAI SDK base URL includes `/v1`. The Anthropic
  SDK base URL does not, and uses `authToken`.
- **VERIFIED. A system prompt is required.** Missing one returns 400 `invalid_request_error`
  (docs L1537, L1555).
- **VERIFIED. Cache.** Reasoning prompts are cached per organisation for 30 days. The key is the
  exact system prompt string plus the SERV transformation type and prompt versions. "The
  requested application model is not part of the cache key" (L3536). A hit skips the generation
  charge. It never caches the answer. Opt out with `metadata: { prompt_cache: "disabled" }` or
  header `X-OpenServ-Prompt-Cache: false`. `/v1/messages` ignores the opt-out (L3553).
  **Design rule: one identical system prompt for every owner. Per owner policy, balances and
  prices go in the user message.** Otherwise each owner is a cache miss and a separate charge.
- **VERIFIED tool shapes.** SERV detects any tool whose name starts with `serv_`, applies it, and
  strips it before the model runs. Options are read from JSON schema `default` values, not from
  call arguments (L2795 to L2808).
  ```ts
  { type: 'function', function: { name: 'serv_prompt_guard' } }   // no parameters
  { type: 'function', function: { name: 'serv_shadow_agent', description: 'Enable SERV shadow-agent validation.',
      parameters: { type: 'object', properties: {
        hint: { type: 'string', default: 'The decision must name one action and cite a number.' },
        max_iterations: { type: 'integer', default: 3 } } } } }     // range 1 to 10, default 3
  ```
  Anthropic format uses `{ name: 'serv_prompt_guard' }` and `input_schema`.
- **VERIFIED. Shadow agent works on non-streaming requests only** (L3654, L3752).
- **VERIFIED, and it matters for money. Both safety features can fail open.** If every shadow
  attempt fails, SERV "returns the latest revision and records an `exhausted` outcome" (L3629).
  The docs place that outcome in the console report. **No response field or header carrying it is
  documented, so treat it as invisible to our code.** If the guard's judge fails after arming,
  "the request continues without a verdict" (L3590). The docs themselves say "Validate structured
  data in your application as well" (L3662). Our policy engine is the real gate. A validator or
  regeneration abort returns 502. A guard that cannot arm returns 502.
- **VERIFIED. A content filter is always on.** It blocks outputs that would reveal the system
  prompt (L2906). A decision record that quotes its own policy rules could be a false positive.
  Refer to rules by id in the output. The off switch is the tool `serv_disable_content_filter`,
  on Chat Completions and Responses only.
- **VERIFIED.** Header `x-openserv-disable-braid: true` gives Raw mode and also bypasses every
  SERV tool (L3815). Useful for the side by side demo.
- **VERIFIED.** `reasoning_effort` accepts `none`, `low`, `medium`, `high`. `minimal` is no longer
  accepted (L262).
- **UNVERIFIED.** The claim that function tools on `gpt-5.4-mini` need `reasoning_effort: "none"`.
  The docs say nothing of the kind, and the tools tutorial shows function tools with no such
  setting (L3738 to L3815). Its origin is another team's source code. One test call settles it.
- **VERIFIED.** Errors are 400, 401, 404, 429 and 5xx, with bodies in the upstream API's format
  (L1539 to L1549). **No rate limit numbers are published anywhere.**
- **VERIFIED prices, per million tokens, "include SERV Reasoning"** (L2238):

  | Model id | Input | Output | Context |
  |---|---|---|---|
  | `gpt-5.6-luna` | $0.25 | $1.50 | 1M |
  | `gpt-5.4-nano` | $0.25 | $1.60 | 128K |
  | `gemini-3.1-flash-lite` | $0.30 | $1.80 | 1M |
  | `gpt-5.4-mini` | $1.00 | $6.00 | 400K |
  | `claude-haiku-4.5` | $1.25 | $6.50 | 200K |
  | `gpt-5.6-terra` | $2.50 | $15.00 | 1M |
  | `claude-sonnet-5` | $2.60 | $13.00 | 1M |
  | `gpt-5.4` | $3.25 | $20.00 | 1M |
  | `claude-opus-5` | $6.00 | $30.00 | 1M |

  The full catalogue has 26 models (L2231 to L2287). `gpt-5.6-luna` is new since our earlier
  research and is the cheapest OpenAI option with a 1M context.
- **Note.** The SDK declares `openai ^5.0.1` as a peer dependency. Pin openai to v5 in the agent
  package to avoid a peer conflict. The compile in section 5 used openai 5.23.2.

---

## 3. Where docs and package disagree

1. **Managed deploy and `.env`. High impact.** The GitHub README says root `.env` and
   `.openserv.json` are "Always included, even when `.gitignore` covers them". That code,
   `FORCE_INCLUDE`, was merged on 2026-09-09 (PR 7, `deploy-env-upload`) and exists only at repo
   HEAD, which still says version 2.5.2. **npm `latest` is 2.5.3 from 2026-03-12 and its
   `dist/deploy/tar.js` has no such logic.** It applies `.gitignore` to everything. So
   `npx @openserv-labs/client deploy .` from npm, in a normal repo, ships no secrets and no
   identity. The container then generates a new wallet and registers a duplicate agent.
2. **SDK README `doTask` example.** It uses `z.infer<typeof doTaskActionSchema>`. That symbol does
   not exist in 2.4.1. Types are plain TypeScript and `DoTaskActionSchema` is not re-exported.
3. **"The ONLY key".** The docs say never to use `OPENSERV_USER_API_KEY` or `OPENSERV_API_KEY`
   (L4641). The packages read both. `OPENSERV_USER_API_KEY` seeds state and is mandatory for
   `deploy`. `OPENSERV_API_KEY` and `OPENSERV_AUTH_TOKEN` are read by `Agent.start()`. All three
   are real and useful. That docs line is a guardrail written for coding agents, not a fact.
4. **Webhook URL.** `provision()` returns a `/fire` URL. Everything else uses
   `/webhooks/trigger/{token}`.
5. **Integration id examples.** The SDK README offers `'github'` as an `integrationId`. The docs
   list of available integrations (L6090 to L6100) has no GitHub.

## 4. Corrections to `2026-09-19-openserv-integration-decision.md`

| That document says | Reality |
|---|---|
| `trigger: triggers.cron('0 * * * *')` | **Broken.** Executed against the real package, it returns `{"type":"cron","timezone":"UTC"}` with no schedule at all. TypeScript rejects it with TS2345. Use `triggers.cron({ schedule: '0 * * * *' })` |
| Telegram `on-message` trigger is the approval channel, "a reply can drive the workflow" | Possible only through five manual wiring steps, an LLM task per message, an untyped payload and no evidence of button support. It also blocks our own consumer. Own the bot instead |
| `requestHumanAssistance` is "the approval ceremony as a first-class platform state" | Nobody but us, in the platform UI, can answer it. No API. Not usable for owners |
| Secrets hold "the desk's wallet key, stored by the platform" | Read only from code, created by hand, per workspace, fetched by numeric id. Use host secrets |
| "60-minute workflow and 10-minute task timeouts, 3 retries" | Source is a 10 month old video only. Not in current docs or packages |
| "`provision()` needs gas" as an open question | Settled. It needs none. Only the optional ERC-8004 call does |
| Open question on auth model | Settled. `WALLET_PRIVATE_KEY` alone works, or pass `userApiKey` |

---

## 5. Verified integration recipe

This file was compiled with `tsc --strict` against `@openserv-labs/sdk@2.4.1`,
`@openserv-labs/client@2.5.3`, `openai@5.23.2` and `zod@3.25.67`. Exit code 0. As a control, the
string form `triggers.cron('0 * * * *')` was compiled the same way and failed, so the check is
real. "Compiles" means the call shapes match the package. It does not mean the platform behaves
as hoped at run time. Section 7 lists what still needs a live test.

```ts
// src/agent.ts
import { Agent, run } from '@openserv-labs/sdk'
import type { DoTaskActionSchema } from '@openserv-labs/sdk/dist/types.js' // not in the index
import { provision, triggers } from '@openserv-labs/client'
import { z } from 'zod'

// Override doTask so our code runs directly, with no platform model in between.
class DeskAgent extends Agent {
  protected async doTask(action: DoTaskActionSchema): Promise<void> {
    const workspaceId = action.workspace.id
    const taskId = action.task.id
    try {
      await this.updateTaskStatus({ workspaceId, taskId, status: 'in-progress' })
      // Which field carries the raw input is UNVERIFIED. Log all of them on the first live run.
      const raw = {
        input: action.task.input,
        explicitInput: action.explicitInput,
        triggerEvent: action.task.triggerEvent?.payload?.[0]?.event,
        triggerName: action.task.triggerEvent?.trigger_name
      }
      const output = await reviewAllDesks(raw) // chain reads, direct SERV call, policy engine
      await this.completeTask({ workspaceId, taskId, output })
    } catch (err) {
      await this.markTaskAsErrored({ workspaceId, taskId, error: String(err) })
    }
  }
}

const agent = new DeskAgent({ systemPrompt: 'Desk agent.' })

// Keep one runnable capability so the agent advertises what it does.
agent.addCapability({
  name: 'review_desks',
  description: 'Review every desk and act within policy',
  inputSchema: z.object({ reason: z.string().optional() }),
  async run({ args, action }) {
    if (action.type === 'do-task') return `task ${action.task.id} ${args.reason ?? ''}`
    return 'chat'
  }
})

async function main() {
  const base = {
    instance: agent,
    name: 'desk-agent',
    description: 'Manages owner desks on Robinhood Chain',
    endpointUrl: process.env.AGENT_ENDPOINT_URL // public HTTPS URL of this process
  }
  // One provision() call per workflow. Same agent name, different workflow name.
  await provision({ agent: base, workflow: {
    name: 'Desk Hourly Review',
    goal: 'Every hour review all desks on Robinhood Chain and act within each owner policy',
    trigger: triggers.cron({ schedule: '0 * * * *', timezone: 'UTC' }),
    task: { description: 'Run the hourly desk review' } } })

  await provision({ agent: base, workflow: {
    name: 'Desk Daily Snapshot',
    goal: 'At the US market close record a daily snapshot of every desk for reporting',
    trigger: triggers.cron({ schedule: '0 16 * * 1-5', timezone: 'America/New_York' }),
    task: { description: 'Record the daily snapshot' } } })

  const onDemand = await provision({ agent: base, workflow: {
    name: 'Desk On Demand',
    goal: 'Let the web app request an immediate review of one desk and wait for the result',
    trigger: triggers.webhook({ waitForCompletion: true, timeout: 600,
      input: { deskId: { type: 'string', title: 'Desk id' } } }),
    task: { description: 'Review the requested desk now' } } })
  console.log('webhook token, keep secret:', onDemand.triggerToken)

  await run(agent) // with DISABLE_TUNNEL=true this starts the HTTP server only
}
main()
```

Environment for production:

```env
DISABLE_TUNNEL=true
AGENT_ENDPOINT_URL=https://desk-agent.example.com
WALLET_PRIVATE_KEY=0x...        # OpenServ login identity only. Never the desk signer
SERV_API_KEY=...
TELEGRAM_BOT_TOKEN=...          # ours. Never pasted into OpenServ
DATABASE_URL=...
```

Goals must be full sentences. The skills repo warns that short goals make the API call fail.

Calling the webhook from the Next.js backend (VERIFIED shape):

```ts
const res = await fetch(`https://api.openserv.ai/webhooks/trigger/${process.env.OPENSERV_TRIGGER_TOKEN}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deskId })
})
const result = await res.json()
```

Direct SERV decision call (VERIFIED shapes, docs L2839 onward and L2997 onward):

```ts
import OpenAI from 'openai'
const serv = new OpenAI({ baseURL: 'https://inference-api.openserv.ai/v1', apiKey: process.env.SERV_API_KEY })

const completion = await serv.chat.completions.create({
  model: 'gpt-5.4-mini',
  reasoning_effort: 'low',
  messages: [
    { role: 'system', content: DESK_SYSTEM_PROMPT },          // one constant string for all owners
    { role: 'user', content: JSON.stringify({ policy, positions, prices }) } // everything that varies
  ],
  response_format: { type: 'json_schema', json_schema: { name: 'decision', strict: true, schema: DECISION_SCHEMA } },
  tools: [
    { type: 'function', function: { name: 'serv_prompt_guard' } },
    { type: 'function', function: { name: 'serv_shadow_agent', description: 'Enable SERV shadow-agent validation.',
        parameters: { type: 'object', properties: {
          hint: { type: 'string', default: 'The decision must name exactly one action and cite a number from the input.' },
          max_iterations: { type: 'integer', default: 3 } } } } }
  ]
  // no stream: shadow agent is non-streaming only
})
```

Telegram, owned by us. These are standard Bot API calls through grammY, outside OpenServ:

```ts
import { Bot, InlineKeyboard } from 'grammy'
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

bot.command('start', async ctx => { /* ctx.match is the deep link code. Link chat to owner */ })
bot.command('pause',  async ctx => { /* set paused in Postgres */ })
bot.command('resume', async ctx => { /* clear it */ })
bot.callbackQuery(/^(approve|reject):(.+)$/, async ctx => {
  await ctx.answerCallbackQuery()          // Telegram requires this or the button spins
  /* record the decision in Postgres, idempotently */
})

// (1) new message with buttons
await bot.api.sendMessage(chatId, text, { reply_markup: new InlineKeyboard()
  .text('Approve', `approve:${id}`).text('Reject', `reject:${id}`).row()
  .url('Details', `https://app.example.com/approvals/${id}`) })
// (2) the one status message, edited in place each wake-up
await bot.api.editMessageText(chatId, statusMessageId, 'Last check 03:00. Nothing to do. Next check 04:00')
```

Telegram facts that shape this, all VERIFIED on `core.telegram.org`: a deep link parameter is at
most 64 characters. Editing a bot's own message has no time limit (the 48 hour rule covers
business messages only). `pinChatMessage` works in private chats and pin notifications are always
off there, so pinning the status message is silent. Store `statusMessageId` per owner. If an edit
fails because the owner deleted the message, send a new one and store the new id.

---

## 6. Risks and fallbacks

**R1. Telegram edit or inline buttons through the platform.** Not a risk we take. We never route
Telegram through OpenServ, so edits, buttons, pinning and commands are plain Bot API calls. If a
judge asks why, the honest answer is strong: the platform exposes no documented call shape for
Telegram, a bot token allows one consumer, and OpenServ's own example does the same. If we were
ever forced onto the platform trigger, approvals would fall back to a URL button into the web app,
since a URL button needs no update delivery at all, and the status message would become a fresh
message each hour. Do not build that unless forced.

**R2. Cron is unreliable, or the platform disables our trigger.** The work function must not care
who calls it. Build `runHourlyReview(hourKey)` to be idempotent on a Postgres row keyed by the
hour. The OpenServ cron task calls it. An internal timer in the same process checks a few minutes
past each hour and runs it if the row is missing. Either the platform did the work, which is the
story we show, or we did it silently. Also call `provision()` on every boot, since it re-activates
triggers and sets the workflow running, and alert ourselves on Telegram if no platform task has
arrived for two hours.

**R3. Duplicate agents from a lost `.openserv.json`.** Mount it on a persistent volume. A stronger
option is to run `provision()` only from a laptop, then give production just `OPENSERV_API_KEY`
and `OPENSERV_AUTH_TOKEN` and call `run(agent)` alone. `Agent.start()` reads both from env. The
cost is losing the re-activation on boot, so pick one: volume plus provision on boot is the better
fit for R2.

**R4. Platform credits run out.** The SDK has an `insufficient-balance` human assistance type, so
tasks can park when the balance is empty. The `doTask` override avoids the platform model, which
should avoid the spend. Whether a task costs credits with no model call is UNVERIFIED.

**R5. Platform outage in the judging window.** With R2 in place the desk keeps working and only
the platform task log goes quiet. The web app and the bot never depend on OpenServ being up. SERV
Reasoning is a harder dependency: on 429 or 5xx, retry with backoff, then skip the hour and say
so in the status message. Never act without a decision.

**R6. SERV safety features fail open.** Covered in Q11. The policy engine validates every decision
by itself: schema, limits, allow list, size caps. Treat SERV output as a proposal.

**R7. Content filter false positives.** Have decisions cite rule ids, not rule text. Test with the
real prompt early.

**R8. Stale SDK.** Seven months without a release and a README that does not match the code. Pin
exact versions. Do not upgrade during the hackathon.

**R9. Secrets in `.openserv.json` and the webhook token in a URL.** Gitignore the file. Keep the
token server side only. Never give `NEXT_PUBLIC_` anything from OpenServ.

---

## 7. Things only a live test with an account can settle

Ordered by how much each one changes the build.

1. **Fire the cron with the agent stopped.** Stop the process across a scheduled minute, start it
   again, and read the task state in the UI. Shows whether fires are retried, queued, errored or
   dropped, and whether the trigger gets disabled. About 15 minutes.
2. **Does the `doTask` override run cleanly for a cron task**, and does `completeTask` close it.
   Log the whole `action` once. This also answers item 3.
3. **Where webhook JSON lands:** `task.input`, `explicitInput` or `triggerEvent.payload[0].event`.
4. **Does a task cost platform credits when no platform model is called.** Check the balance
   before and after ten fires. Also note the starting free balance.
5. **Read the authenticated API spec.** `GET https://api.openserv.ai/docs/json` returns 401
   without a key, so it exists. With header `x-openserv-key` it should list every endpoint. That
   one request would settle the Telegram proxy shape, any human assistance answer endpoint, and
   file limits. Worth doing even though we do not plan to use them.
6. **Real timeout and retry defaults** in workflow settings, to confirm or replace the video's
   60 minutes, 10 minutes and 3 retries.
7. **Can an outsider open a public agent page**, and how long marketplace review takes. Ask in the
   OpenServ Telegram group too.
8. **The data collection toggle** at `console.openserv.ai/settings/organization`: that it exists,
   and what it says it collects. Turn it on before the first real request.
9. **Function tools with `reasoning_effort`** on `gpt-5.4-mini`: one call with `low`, one with
   `none`.
10. **Is a shadow agent `exhausted` outcome visible in the response.** Force it with
    `max_iterations: 1` and an impossible `hint`, then inspect the full response and headers.
11. **Content filter against our real decision prompt**, with outputs that mention policy rules.
12. **SERV rate limits.** Fire 20 concurrent requests and see where 429 begins.
13. Only if we ever reconsider the platform Telegram path: connect a throwaway bot, then call
    `getWebhookInfo` with its token. A non-empty `url` means webhook, empty means polling, and
    `allowed_updates` in the reply shows whether button presses could ever arrive.
