# Publishing Shijima on OpenServ

23 Sep 2026. Sources: the platform-basics video (`2026-09-19-openserv-platform-basics-transcript.md`, 4:11 to
9:34 and 26:14), the `@openserv-labs/client` README, and a read of our live account.

## What "publish" means on OpenServ

There are three separate things, and none was on our submission list.

1. **Marketplace listing (Browse agents).** Agents are public or private. Community agents appear under
   Browse agents once OpenServ approves them (video 5:01). The API field is `approval_status`:
   `in-development`, `pending`, `approved`, `rejected`. Other people can then add Shijima to their workspace.
2. **ERC-8004 on-chain identity.** `client.erc8004.registerOnChain({ workflowId, privateKey, name,
   description })` builds an agent card (services, triggers, wallet), uploads it to IPFS and mints an identity on
   Base (default) or another listed chain. It then shows on 8004scan. Robinhood Chain (4663) is not in the list;
   Base is the default. It needs a little Base ETH for gas.
3. **Template.** "Save as template" then submit for review makes the workspace cloneable by others, later
   token-gated through x402 (video 4:11, 26:46). `PRODUCT-SCOPE.md` §5 parked this as LATER on purpose.

## What our account shows today

- Agent `4513` "shijima": external, healthy, `avatar_url` null, `categories` empty, `repository_url` null,
  `usage_instructions` null, `is_trading_agent` false. Approval status not yet requested.
- Workspace `13895` "Hourly desk review" already has a platform wallet on Base,
  `0xfec44b10A67d329b3d74c6d0216EEC8e46120d05`, made 21 Sep. Its ERC-8004 record reads `deployed: true` with
  the id `8453:999999918` and a **"Retro Sticker Designer" sample card, with no transaction hash**: placeholder
  data, not ours. A real `registerOnChain` replaces it.

## Why it matters beyond the checklist

The workspace wallet is OpenServ's own answer to "the agent has a wallet on SERV". That belongs to the
architecture conversation Abu asked for (agents on OpenServ that can trade, users who sign in to the web app),
not to this checklist. Noted here so that conversation starts from the fact.
