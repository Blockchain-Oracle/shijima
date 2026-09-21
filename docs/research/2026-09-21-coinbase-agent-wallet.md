# Coinbase's agent wallet tooling: should Shijima use it?

21 Sep 2026. Abu asked whether Coinbase's agent tooling should be part of Shijima. The rule was to adopt it only
if it adds real value without breaking the money path that already works. Every claim below cites a doc page, npm
data, source code or a command that was run. Raw material is saved in `.firecrawl/coinbase/` (gitignored). The
CDP docs serve plain markdown, so they were read with `curl` and no Firecrawl credits were used.

## Bottom line

**Not now.** Only one Coinbase feature reaches Robinhood Chain: signing a raw transaction. Everything that makes
the tooling convenient runs only on Base, Ethereum, Arbitrum and similar chains. That covers sending, swaps,
balances, gas sponsorship, spend permissions and the hosted x402 service. The one piece that does fit is a CDP
server wallet holding the operator key. It passes a compile check and keeps the caps and the decision hash
intact. But the contract already limits what a stolen key can do, so the gain is small. It would also add a
vendor to the money path seven days before the deadline. Park it for after the deadline, and try one operator
key per desk first.

---

## 1. What each piece is

| Piece | What it is for | Current version |
|---|---|---|
| **AgentKit** | A toolkit that gives an AI model a wallet plus ready-made "actions" (transfer, swap, ERC-20, Pyth, Morpho and about 50 more). It plugs into LangChain, the Vercel AI SDK and MCP. | `@coinbase/agentkit` 0.10.4, published 2025-12-19. Last nightly 2026-02-01. (npm) |
| **CDP Server Wallets v2** ("API key wallets") | Keys your server controls through an API key and a "Wallet Secret". The private key lives in Coinbase's Trusted Execution Environment (AWS Nitro Enclaves) and can be exported. | `@coinbase/cdp-sdk` 1.56.0, published 2026-09-14. (npm) |
| **Policy engine** | Rules checked before CDP signs: allowed `to` addresses, ETH value, which contract function and arguments (`evmData`), net USD change. | Part of the CDP SDK. |
| **Smart Accounts** (CDP) and **Base Account** (formerly Coinbase Smart Wallet) | ERC-4337 contract wallets with batching and gas sponsorship. Base Account is the consumer version, renamed when the Coinbase Wallet app became the Base app. | `@base-org/account` |
| **Spend Permissions** | A smart account lets a "spender" pull up to N tokens per period. `spend()` moves tokens **from the account to the spender**. | Contract `SpendPermissionManager` |
| **Embedded Wallets** ("user wallets") | The user signs in with email, SMS or a social account, and gets a wallet with no seed phrase. The user controls it and can export the key. An optional "Delegated Signing" lets your backend sign for the user for a set time. | `@coinbase/cdp-core`, `cdp-react`, `cdp-hooks`, `cdp-wagmi` 0.0.126, 2026-09-18 |
| **x402** | HTTP 402 payments. A paid endpoint answers "402, pay X", the client signs a USDC transfer authorisation, and a "facilitator" settles it on-chain. | `@x402/core`, `@x402/evm`, `@x402/next` 2.26.0, 2026-09-15 |
| New since AgentKit: **Wallet MCP** (`mcp.base.org`) | An MCP server that gives a chat assistant the user's own Coinbase or Base wallet. Its partner plugins are almost all Base-only. | docs `coinbase-for-agents/wallet-mcp/skill.md` |

Sources: `docs.cdp.coinbase.com/wallets/overview.md` (custody table, "keys in a TEE"), Context7
`/websites/cdp_coinbase` "Security Overview" ("AWS Nitro Enclaves ... even administrative users cannot access
the enclave"), `wallets/using-wallets/import-and-export` (`cdp.evm.exportAccount`), Context7 `/websites/base`
`spend-permissions` ("transferring them from the `account` to the `spender`"), Base migration guide (Smart Wallet
to Base Account).

---

## 2. Does any of it run on Robinhood Chain (4663)?

**This is the deciding fact. Only raw signing does.**

| Piece | On 4663? | Evidence |
|---|---|---|
| Server wallet: **sign a transaction** | **Yes on paper.** Not yet proven live, because that needs a CDP account. | Docs: "All EVM-compatible networks" (`wallets/overview.md`, Supported networks). SDK source: `signTransaction` runs viem's `serializeTransaction` locally and posts the bytes to CDP's sign endpoint, with no network check (`_esm/accounts/evm/toEvmServerAccount.js` lines 63-77). The chain id travels inside the signed bytes. |
| Server wallet: send, transfer, swap, balances, faucet | **No** | The SDK's capability table lists 13 networks: base, base-sepolia, ethereum, ethereum-sepolia, ethereum-hoodi, optimism, optimism-sepolia, arbitrum, arbitrum-sepolia, avalanche, binance, polygon, zora (`networkCapabilities.js`). `grep -ri 'robinhood\|4663'` over the SDK finds 0 files. |
| Policy engine | **Partly.** Signing rules work on any chain, but they cannot name the chain. | In the SDK's policy schema, the `evmNetwork` rule exists only for `sendEvmTransaction` and `prepareUserOperation`, not for `signEvmTransaction` (`_esm/policies/evmSchema.js`). |
| Smart Accounts, gas sponsorship | **No** | "Base, Arbitrum, Optimism, Zora, Polygon, BNB Chain, Avalanche, and Ethereum" (Context7 `wallets/using-wallets/smart-accounts`). |
| Spend Permissions | **No** | "Arbitrum, Avalanche, Base, Ethereum, Optimism, and Polygon" (`wallets/using-wallets/spend-permissions`). |
| Base Account | **No** | Full support on 8 chains, basic support on 7 more. Robinhood Chain is in neither list (`docs.base.org/base-account`). |
| Embedded wallet, plain account (EOA) | **Signing yes** | The docs sign for chain id 728126428 (Tron) and broadcast with viem, "for networks not natively supported by CDP APIs" (`cdp-hooks`, `cdp-core` `signEvmTransaction`). |
| x402, Coinbase's hosted facilitator | **No** | Its live list is eip155:8453, 84532, 137, 42161, 480 and Solana (`x402-facilitator/get-supported-payment-schemes-and-networks`). |
| x402, the protocol itself | **Possible with our own facilitator** | USDG on 4663 has the standard EIP-3009 typehash. `cast call ... TRANSFER_WITH_AUTHORIZATION_TYPEHASH()` returned `0x7c7c6cdb…2267`, equal to `cast keccak` of the EIP-3009 type string. Permit2 is deployed at its standard address (`cast codesize 0x000000000022D473030F116dDEE9F6B43aC78BA3` = 9152). Running a facilitator ourselves is an inference, not tested. |
| AgentKit | **Wallet yes, most actions no** | `ViemWalletProvider` accepts any viem chain (README). Action providers declare their own networks, and the DeFi ones are mostly Base. |

---

## 3. The four possible uses

| Use | Replaces | Adds | Costs | Verdict |
|---|---|---|---|---|
| **(a) Operator key in a CDP server wallet** | `OPERATOR_PRIVATE_KEY` + `privateKeyToAccount` (`apps/worker/src/cli/context.ts:34`) | Signing rules (desk addresses only, zero ETH out). One off switch for every desk. Signing logs. | A vendor on every trade and checkpoint. A CDP account and 3 secrets. +86 packages. Every owner has to call `setOperator`. | **Not now.** It fits cleanly, but the gain is small. Revisit after the deadline, after per-desk keys. |
| **(b) Email sign-in (embedded wallet)** | Injected wallet + SIWE | Email login with no extension needed | No wagmi 3 connector exists. It breaks the "withdraw without us" escape hatch. No gas sponsorship on 4663. | **No** for 28 Sep. Same answer as Privy in `FIDELITY.md` section 7. |
| **(c) AgentKit tools for the chat** | Our own typed tools sent to SERV | Generic wallet actions | 886 packages, 1.2 GB, three copies of viem, zod 3. Last stable release 9 months ago. It hands the model exactly the powers our rule forbids. | **No** |
| **(d) x402 for the paid question** | Nothing yet | Pay-per-question in USDC | The Coinbase facilitator is not on 4663. OpenServ already has x402 built in. | **Not now.** When it is built, use **OpenServ's own x402 trigger**, with no Coinbase package. |

### (a) Operator key custody, in detail

**Caps and decision hash stay intact.** `Desk.sol` checks that the caller is the operator, and our code builds
the calldata, decision hash included. CDP only signs the bytes we hand it. The write-ahead order survives too.
`signDeskCall` signs, then hashes the signed bytes itself before anything is broadcast
(`packages/chain/src/send.ts:133-148`), and CDP's `signTransaction` returns exactly those signed bytes.

**Compile check (passed).** In a throwaway folder with `@coinbase/cdp-sdk` 1.56.0, viem 2.56.8 and TypeScript
6.0.3, `createWalletClient({ account: toAccount(await cdp.evm.getOrCreateAccount({ name })), chain: robinhood })`
typechecks as our exact `OperatorWallet` type (`WalletClient<Transport, Chain, Account>`, `desk.ts:20`). So do
`prepareTransactionRequest`, `signTransaction` and a `createPolicy` call. The code change would be about three
lines in `context.ts` and `scripts/prove-limits.ts`.

**Security gain: small.**
- *Today:* a leaked key "can only make bad trades, costing at most 8% of your daily limit per day, until you remove
  it" (README, promise). It can also spend the operator's gas ETH.
- *With CDP:* the environment holds the CDP API key, its secret and the Wallet Secret instead. Anyone who reads
  the environment can still sign. They can also call `exportAccount` and take the raw key away, because no policy
  rule covers export: the policy schema lists 15 operations and export is not one of them (`evmSchema.js`). So the
  worst case does not move. It is already capped by the contract.
- *What it does add:* a rule that only desk addresses may be called with zero ETH, which protects the gas balance.
  It also gives **one off switch for every desk**: delete the API key in the portal and all signing stops at once.
  Today one operator key serves every desk (README, Honest limits), so a leak needs every owner to sign
  `revokeOperator`.

**Costs.**
- Every trade and daily checkpoint needs CDP to be up. If CDP is down the desk simply does not act, which is safe,
  and the owner can still withdraw.
- Abu has to create a CDP account, an API key and a Wallet Secret. That goes against "local first, no hosted
  services until deploy".
- +86 packages and about 70 MB. That includes 39 `@solana/*` packages and a nested TypeScript 5.9.3, all to use one
  method (scratch install: 103 packages against a baseline of 17).
- Usage telemetry is on by default and posts to `https://cca-lite.coinbase.com`. It stays on unless
  `DISABLE_CDP_USAGE_TRACKING=true` and `DISABLE_CDP_ERROR_REPORTING=true` are set (`_esm/analytics.js`).
- Price is trivial: $0.005 per operation. One signature plus one policy check is 2 operations. The first 5,000
  operations a month are free (`wallets/pricing.md`).
- Live 4663 signing stays unproven until a CDP account exists.

**A cheaper step with most of the gain:** one operator key per desk. The contract already supports it (README).
A leak then hurts one desk, and no vendor is involved.

### (b) Owner sign-in with an embedded wallet

- Signing on 4663 works for a plain account (see section 2). But smart accounts, and with them gas sponsorship, are
  not on 4663. The owner still needs ETH, so our `useOwnerGas` guard and the Relay flow stay.
- `@coinbase/cdp-wagmi` requires `wagmi ^2.16.0`. None of its 122 versions accepts wagmi 3, and a dry-run install
  with wagmi 3.7.7 fails with `ERESOLVE ... peer wagmi@"^2.16.0"`. We would have to write our own wagmi 3
  connector. OnchainKit 1.1.2 also requires wagmi `^2.16`.
- **It breaks the escape hatch.** `ARCHITECTURE.md` 1.1 promises: "If our website disappears, here is how to
  withdraw on Blockscout." An embedded wallet signs in only through our CDP project, and CDP lists "domain
  allowlisting" among its controls (`wallets/security-and-policies/overview.md`). If our site goes, the owner can
  reach the money only if they exported the key beforehand.
- Delegated Signing, which lets our backend sign as the owner, must never be used. It would put the owner-only
  functions (`withdraw`, `setLimits`, `setOperator`) behind our server.

### (c) AgentKit for the chat

- The chat's safety rule is that the model can only *propose* one of a fixed set of typed actions. The owner
  confirms each one, and it then runs through the existing guarded paths (`docs/research/2026-09-21-chat-actions.md`).
  AgentKit's value is the opposite: generic `transfer`, `swap` and `approve` tools that the model can call itself.
  For our actions we would write a custom `ActionProvider`, which is the same work as an OpenAI tool definition.
  We already build those with zod 4's `z.toJSONSchema`.
- It plugs into LangChain, the Vercel AI SDK (`peer ai ^4.1.16`) and MCP. None of these is the plain `openai`
  5.23.2 client we use for SERV.
- Weight (scratch install): 886 packages, 1.2 GB. It pins `viem 2.38.3` exactly, which gives three viem copies
  (2.23.2, 2.38.3, 2.56.8). It uses zod 3. Its 35 direct dependencies include ethers, `@solana/web3.js`,
  `opensea-js`, `twitter-api-v2`, `@privy-io/server-auth`, ZeroDev, and `canonicalize`, the package we dropped
  from the hashing path on 19 Sep.
- Wallet MCP is MCP (out of scope), it is the user's own Base wallet, and its plugins are Base-only.

### (d) x402 for the paid question endpoint

- OpenServ already supports it. `triggers.x402({ price })` is in `@openserv-labs/client` 2.5.3, which we pin
  (`dist/triggers-api.d.ts:42-60`, with `x402Pricing` and `x402WalletAddress`). Its payment client defaults to Base
  (`dist/payments-api.js:89-91`), and it ships its own x402 code with no Coinbase package. Our own research already
  lists `x402` as one of the platform's four trigger types (`research/architecture/02-openserv-integration.md`
  Q2). It is also an OpenServ feature, which suits the hackathon.
- Payments for questions never touch an owner's desk, so settling in USDC on Base is fine.
- Settling in USDG on 4663 would mean running our own facilitator. The token supports it (section 2), but it is
  more work for no product gain.

---

## 4. Compatibility with our stack

| Package (latest) | What matters | Our stack | Result |
|---|---|---|---|
| `@coinbase/cdp-sdk` 1.56.0 | viem `^2.47.0`, zod `^3.25.76`, axios `^1.18.0`, no `engines` | viem 2.56.8, zod 4.6.5, Node 24, TS 6.0.3 | **Works.** Shares our viem. Adds a second zod. axios is already in our tree through the OpenServ client. Typecheck passed. |
| `@coinbase/agentkit` 0.10.4 | viem **pinned 2.38.3**, zod `^3.23.8`, 35 dependencies | viem 2.56.8 | Installs, but with three viem copies and 886 packages |
| `@coinbase/cdp-wagmi` 0.0.126 | peer **wagmi `^2.16.0`** | wagmi 3.7.7 | **Fails** (`ERESOLVE`) |
| `@coinbase/cdp-react` / `cdp-hooks` 0.0.126 | react `>=18.2.0` | React 19.3.0 | OK |
| `@coinbase/onchainkit` 1.1.2 | peer wagmi `^2.16`, react `^19` | wagmi 3.7.7 | **Fails** on wagmi |
| `@x402/core`, `@x402/evm`, `@x402/next` 2.26.0 | viem `^2.48.11`, next `>=16.2.6`, zod `^3.24.2` | next 16.3.5 | OK. Not needed if we use OpenServ's trigger. |
| `@coinbase/agentkit-vercel-ai-sdk` 0.1.0 | peer `ai ^4.1.16` | we do not use the AI SDK | Not applicable |
| `openai` 5.23.2 (pinned for OpenServ) | None of the Coinbase packages depend on `openai` | | No conflict, and no adapter either |
| wagmi 3's own connectors | `@wagmi/connectors` 8.2.0 already lists `@base-org/account` and `@coinbase/wallet-sdk` as optional peers (`pnpm-lock.yaml`) | | A Coinbase wallet button costs nothing. Base Account is not on 4663, and the Coinbase extension already works through `injected()`. |

Versions and peers: `curl https://registry.npmjs.org/<pkg>/latest` (saved as `.firecrawl/coinbase/npm-*.json`,
with full histories in `full-*.json`).

---

## 5. What would force a compromise

- **A different chain.** Every managed Coinbase feature is on Base, Ethereum, Arbitrum and similar chains. Stock
  Tokens live on 4663. Not an option.
- **Giving up on-chain caps.** Spend Permissions and Smart Accounts would replace `Desk.sol` with an allowance that
  a spender *pulls*. `spend()` sends tokens to the spender. That breaks "money can go nowhere but the owner".
  Never.
- **Owner custody moving to Coinbase.** An embedded wallet keeps the owner's key in Coinbase's enclave, behind our
  project. Delegated Signing hands our server the owner's signature. The first breaks the escape hatch. The second
  breaks the limits.
- **Keys.** Server wallet keys *can* be exported (good for leaving CDP). But no policy can stop a leaked secret from
  exporting them.
- **Heavy dependencies.** AgentKit is 886 packages. The CDP SDK is +86, mostly Solana code we would never call.
- **The calendar.** SERV closes 28 Sep. Any change to the money path means rerunning `pnpm dev:prove-limits --send`
  and the canary desk.

---

## 6. Recommendation

**Not now.**

1. **Do not adopt** AgentKit, Embedded Wallets, Smart Accounts, Spend Permissions or OnchainKit. Each either does
   not run on 4663, does not work with wagmi 3, or goes against the money rules.
2. **Operator key custody in a CDP server wallet.** It fits: it typechecks against our wallet type and leaves the
   caps and decision hash untouched. But the contract already caps a stolen key, so it adds little. Park it until
   after the October demos, *behind* one operator key per desk, which gives most of the gain with no vendor. If it
   is taken up later:
   - one CDP account per desk (`getOrCreateAccount({ name: deskId })`);
   - a policy that accepts `signEvmTransaction` only to that desk's address, with `ethValue == 0` and `evmData`
     limited to `buy`, `sell`, `checkpoint`, `sweepToVault`, `redeemFromVault` and `pause`;
   - telemetry switched off;
   - proven on a $20 canary desk with `dev:prove-limits`.
3. **x402**, when the paid question endpoint is built: start with OpenServ's own x402 trigger. No Coinbase package
   is needed.

## Commands run

- `curl https://registry.npmjs.org/<pkg>/latest` and `/<pkg>` for 20 packages (dist-tags, publish dates, peers).
- `curl https://docs.cdp.coinbase.com/<page>.md` for 10 pages, plus `llms.txt`.
- Context7: `/coinbase/cdp-sdk`, `/websites/cdp_coinbase`, `/coinbase/agentkit`, `/websites/base`.
- `cast chain-id`, `cast call` (USDG `name`, `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`, `authorizationState`,
  `DOMAIN_SEPARATOR`, `nonces`), `cast codesize` (Permit2), `cast keccak` against
  `https://rpc.mainnet.chain.robinhood.com`.
- Scratch installs with `--ignore-scripts`: the CDP SDK plus our viem and TypeScript, typechecked with `tsc`; a
  baseline of viem and TypeScript alone; AgentKit; and a dry run of `cdp-wagmi` with wagmi 3.7.7. All were deleted
  afterwards. Nothing was installed into the repo.
