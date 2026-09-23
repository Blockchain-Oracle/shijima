# What only Abu can do

Short on purpose. Everything else, Claude does locally. We are not deploying yet, so no Neon, Railway or
Vercel is needed now.

## Done
- [x] Alchemy key, with Robinhood Chain Mainnet enabled
- [x] Finnhub key
- [x] SERV Reasoning key

## Needed now
- [x] ~~Top up SERV credit.~~ Done, confirmed with a live call 22 Sep.
- [x] ~~Say go for contract v1 on mainnet~~ Given 22 Sep with the $5 decision. (about $1 of gas). With it, Claude also publishes v1's source on
      Blockscout, so "Write proxy" appears for the withdraw-without-our-website steps.
- [x] ~~Fund the dev wallet for the first real trade.~~ Done 20 Sep.
- [ ] **Turn on data collection** at https://console.openserv.ai/settings/organization . This is a hackathon
      eligibility rule.
- [x] ~~Say when the worker may run again.~~ Running again since 22 Sep 19:03 UTC. It graded the backlog and sealed.
- [x] ~~Money for the demo desk.~~ Not needed: the dev desk's $5 is enough (Abu, 22 Sep).

- [ ] **Fund the gift wallet for the free $1** (Round 3, D3): send **20 USDG and 0.002 ETH** on Robinhood Chain to
      `0x5eD6613607AB34762fdEEFfdd2E86c297D00dE60`. That pays the first 20 people $1 each plus fee money.
- [ ] **Switch the showcase agent to live** (on its own) from its Settings with your wallet, so "live agents" are
      really live, and, if you like, turn on "Let others copy this agent" with a fee ($0 to $5).
- [ ] Optional: rename the showcase agent from "dev desk" to something people will copy.

## Hackathon admin, whenever you have five minutes
- [x] ~~Ask whether a build with no MCP qualifies.~~ **Answered 21 Sep:** the official page says the track is
      for agents that "act on Robinhood Chain **or** operate funds via Robinhood MCP". We qualify.
- [ ] **Publish Shijima on OpenServ before submitting.** 23 Sep: listing filled and ERC-8004 identity 95396 minted on Base; only "submit for review" is left, run with `pnpm openserv:listing --submit` once the app has a public URL. (found 23 Sep, `research/2026-09-23-openserv-publishing.md`).
      Claude does: fill the agent's listing (logo, categories, trading agent, usage, repo link) and register its
      ERC-8004 identity on Base (a few cents of gas), replacing a sample card the platform left there. Abu does,
      only if the API cannot: press "submit for review" on agent 4513 so it appears under Browse agents.
- [ ] **Submit on https://form.typeform.com/to/A475N331** ("SERV Hackathon #1 submission", open). GyPxGqRn is
      the old pre-registration form and is closed. The hackathon page's FAQ still links the closed one, so a
      one-line check in the OpenServ Telegram is worth it. Tick every track that applies: Mainnet & MCP, Open, and **AgentKit** (trades now sign through Coinbase AgentKit).
- [ ] **Register for the Arbitrum buildathon on HackQuest by 2 Oct**, submit by 3 Oct. We fit both prize pools,
      and each keeps a place for a Robinhood Chain project: https://openhouse.arbitrum.io
- [ ] Take `docs/DESIGN-BRIEF.md` to your designer.

## Later, only when we deploy
A Telegram bot token from @BotFather, a Reown project id, hosting accounts, the product's name.
