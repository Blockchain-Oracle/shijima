# What only Abu can do

Short on purpose. Everything else, Claude does locally. We are not deploying yet, so no Neon, Railway or
Vercel is needed now.

## Done
- [x] Alchemy key, with Robinhood Chain Mainnet enabled
- [x] Finnhub key
- [x] SERV Reasoning key

## Needed now
- [ ] **Top up SERV credit** (it is $0.02). Every hourly check, the chat and the comparison page wait on it.
- [ ] **Say go for contract v1 on mainnet** (about $1 of gas). With it, Claude also publishes v1's source on
      Blockscout, so "Write proxy" appears for the withdraw-without-our-website steps.
- [x] ~~Fund the dev wallet for the first real trade.~~ Done 20 Sep.
- [ ] **Turn on data collection** at https://console.openserv.ai/settings/organization . This is a hackathon
      eligibility rule.
- [ ] **Say when the worker may run again** (`pnpm worker:start`). It has been off since Mon 09:00 UTC: the
      weekend of 19 to 20 Sep is ungraded, 40 records are unsealed, and the daily seal costs about 2 cents of the
      operator's ETH. Claude does not start it unasked.

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
