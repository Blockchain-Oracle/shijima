# What only Abu can do

Short on purpose. Everything else, Claude does locally. We are not deploying yet, so no Neon, Railway or
Vercel is needed now.

## Done
- [x] Alchemy key, with Robinhood Chain Mainnet enabled
- [x] Finnhub key
- [x] SERV Reasoning key

## Needed for the first real trade
- [ ] **Send about $5 of ETH and $25 of USDG on Robinhood Chain to the dev wallet:**
      `0xB5D47f376c59c975F931000FAdD787abaEB91cf6`
      Relay can send straight to it from Base or Arbitrum: https://relay.link/bridge/robinhood
      Claude moves part of the ETH to the agent's wallet and creates the test desk.
- [ ] **Turn on data collection** at https://console.openserv.ai/settings/organization . This is a hackathon
      eligibility rule.

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
