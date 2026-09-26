# Prompt: build the Shijima docs site

Paste everything below the line into a new Claude Code session opened in `/Users/abu/dev/hackathon/open-serv`.

---

Build a proper documentation site for **Shijima** (しじま): AI agents that keep a person's basket of US Stock Tokens on plan 24/7 on Robinhood Chain mainnet, running on OpenServ. The docs must read like a real product's docs, explain the architecture with diagrams, and be true to the code.

## Copy these two references, one of them closely
1. **Masayume docs**: `/Users/abu/dev/hackathon/masayume-docs` (Fumadocs 16 on Next 16). Copy its structure, navigation, page types, tone and components. Read `content/docs/` (start, explore, trading, agents, architecture, builders, help) and `app/`, `components/`, `lib/`.
2. **Sommina docs**: `/Users/abu/dev/hackathon/sommina-events/docs` for how architecture and implementation are explained.
3. **Agari docs site**: `/Users/abu/dev/hackathon/agari-wt/w1/docs-site` is the same stack, already deployed on Coolify as its own app (`base dir /docs-site`, Dockerfile inside). Reuse its Dockerfile and deploy setup.

## Where it goes
- A new folder `docs-site/` at the repo root: Fumadocs 16 + Next 16, pnpm, same versions as masayume-docs.
- Add it to `pnpm-workspace.yaml` only if needed; keep it buildable on its own like Agari's.
- It is its own Coolify app inside the existing Coolify project **shijima** (see memory `shijima-deployed-coolify` and `docs/BUILD-PLAN.md`'s 25 Sep entry). Deploy it only after Abu says go. Until Abu buys a domain it gets Coolify's sslip.io address with `https://`.
- Link to it from the app's footer and from the existing `/docs` page in `apps/web`.

## Source of truth
Read the code, not only the markdown. Start with `docs/BUILD-PLAN.md` (progress log), `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (latest decisions win, e.g. R8: agents start live and any mode is allowed any time), `docs/RECORD-SCHEMA.md`, `README.md`, then `apps/web`, `apps/worker`, `packages/core`, `packages/chain`, `packages/db`, `contracts/`. Every address, number and claim must match `packages/chain/deployments.json`, the contracts and the code. If something is unclear, write less, never guess.

## Pages (adapt Masayume's sections)
- **Start**: what Shijima is in one screen; sign in with any wallet (picker, WalletConnect); the free $1 for the first sign-ups (honestly scoped: it's capped); create your first agent in four steps (Strategy, Amount, Limits, Review); Live vs Practice; fund from Base/Arbitrum/Ethereum/BNB; withdraw.
- **Your agent**: modes (Practice, Ask me first, On its own); limits (per trade, per day, loss stop, largest holding); standing rules; how it decides (only WHEN: now, in part, wait for reopen, not at all); the record and "Check it" (decision fingerprint on chain in the same transaction as the trade); Telegram; Ask Shijima chat; copying another agent and the 80/20 fee split.
- **Money**: Wallet, Fund, Withdraw, Send, Bridge (In to your own wallet as USDG or ETH, Out, Get gas), who pays which fee.
- **OpenServ**: plain explanation of OpenServ (platform, agents, workspaces/projects, workflows); how Shijima uses it (agent #4513, the hourly "Hourly desk review" workflow that wakes it, SERV Reasoning for timing calls, the ERC-8004 identity #95396 on Base); linking your own workspace step by step (optional power feature).
- **Architecture**: system diagram (browser → Next.js web on Coolify → Postgres; worker on Coolify running the engine, OpenServ SDK agent, Telegram bot, gift sender; Robinhood Chain: DeskFactory, one Desk per owner, Uniswap v3, Chainlink feeds, Morpho vault; Relay for bridging; SERV Reasoning); the wake loop (sequence diagram: OpenServ trigger/5-min watch → reconcile → valuation → needs → gate → SERV call → decision → write-ahead send → receipt → record hash-chained → Telegram); the contract's guards; the record and hash chain; failure handling (write-ahead sender, leader lock, crash recovery).
- **Security and trust**: what the agent can and can never do; withdraw without our website (Blockscout Write proxy steps); the honest worst case.
- **Builders**: repo layout, running locally, the commands in `package.json`, deployment on Coolify.
- **Help**: FAQ, glossary (Stock Token, USDG, drift, practice), troubleshooting (wallet on the wrong network, not enough ETH for fees, a pending transaction stuck in the wallet).

## Diagrams
Use real diagrams, drawn as SVG or Mermaid rendered at build time, matching the site's light and dark themes. At least: the system diagram, the wake-loop sequence, the money flow (wallet → agent account → trades → only back to the owner), and the OpenServ relationship.

## Rules
- Plain, short sentences. No marketing fluff, no jargon without a one-line explanation. Abu reads fast and hates slop.
- Real logos for partners (OpenServ, Robinhood Chain, Telegram, WalletConnect, Uniswap, Chainlink, Relay); never stand-in icons. Brand files are in `apps/web/public/brand` and `apps/web/public/logos`.
- Shijima's colours and fonts (see `apps/web/styles/kit/tokens.css`): accent #CCFF00 dark / #4F7A00 light, Hanken Grotesk + IBM Plex Mono.
- Check every page renders in both themes and on a phone before calling it done. Do not deploy or push without Abu's go.
