# What only Abu can do

Short on purpose. Everything else, Claude does locally. We are not deploying yet, so no Neon, Railway or
Vercel is needed now.

## Done
- [x] Alchemy key, with Robinhood Chain Mainnet enabled
- [x] Finnhub key
- [x] SERV Reasoning key

## Needed now
- [x] ~~Top up SERV credit.~~ Done, confirmed with a live call 22 Sep.
- [ ] **Say go for contract v1 on mainnet** (about $1 of gas). With it, Claude also publishes v1's source on
      Blockscout, so "Write proxy" appears for the withdraw-without-our-website steps.
- [x] ~~Fund the dev wallet for the first real trade.~~ Done 20 Sep.
- [ ] **Turn on data collection** at https://console.openserv.ai/settings/organization . This is a hackathon
      eligibility rule.
- [x] ~~Say when the worker may run again.~~ Running again since 22 Sep 19:03 UTC. It graded the backlog and sealed.
- [ ] **$50 for the demo desk.** The $10 sent on 20 Sep is already on the dev desk (about $5.20 USDG and some NVDA);
      the dev wallet itself is empty. Send about $50 on Base to `0xB5D47f376c59c975F931000FAdD787abaEB91cf6` and
      Claude bridges it with `pnpm dev:funds bridge`.

## Hackathon admin, whenever you have five minutes
- [x] ~~Ask whether a build with no MCP qualifies.~~ **Answered 21 Sep:** the official page says the track is
      for agents that "act on Robinhood Chain **or** operate funds via Robinhood MCP". We qualify.
- [ ] **Submit on https://form.typeform.com/to/A475N331** ("SERV Hackathon #1 submission", open). GyPxGqRn is
      the old pre-registration form and is closed. The hackathon page's FAQ still links the closed one, so a
      one-line check in the OpenServ Telegram is worth it. Tick every track that applies: Mainnet & MCP and Open.
- [ ] **Register for the Arbitrum buildathon on HackQuest by 2 Oct**, submit by 3 Oct. We fit both prize pools,
      and each keeps a place for a Robinhood Chain project: https://openhouse.arbitrum.io
- [ ] Take `docs/DESIGN-BRIEF.md` to your designer.

## Later, only when we deploy
A Telegram bot token from @BotFather, a Reown project id, hosting accounts, the product's name.
