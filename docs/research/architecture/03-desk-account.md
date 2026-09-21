# 03. The desk account: how the owner's money is held

Status: COMPLETE, written 2026-09-19 (a Saturday, which matters for the oracle readings).
All on-chain checks are read-only `cast` calls, raw `eth_call`s and one local `forge` fork test against
`https://rpc.mainnet.chain.robinhood.com` (chain id 4663). No transaction was sent and no private key
was used.

Labels: VERIFIED means an on-chain call or an authoritative source, cited. UNVERIFIED means I could
not confirm it and you should not build on it without a test. Section 9 collects the unverified items.

---

## 0. Recommendation

**Option A. A custom minimal `Desk.sol`, one EIP-1167 clone per owner, from a `DeskFactory`. The
operator is a plain EOA that pays gas.**

Every building block for B and C is deployed on 4663 (section 1), so this is not a question of what
exists. It is a question of which design makes the sentence "the agent cannot send your money anywhere
else" true and checkable.

1. **B and C cannot express the promise without custom Solidity anyway.** Neither can cap sells in
   USDG terms, neither can bound the price against an oracle, and neither forces the decision hash into
   the trade. In C it is worse: ERC-7562 forbids a session key policy from reading a Chainlink feed or
   a pool during validation. Once you are deploying an unaudited contract regardless, make it the whole
   system in 250 lines, not a plug-in inside a general purpose account.
2. **The one 4337 stack with first class support here cannot do it at all.** Alchemy's session key
   permissions stop at function selectors, so `recipient` on the router cannot be pinned. The stacks
   that can pin it (ZeroDev, Rhinestone) are second class on this chain. Zodiac's Roles app and SDK do
   not know chain 4663.
3. **A is the only one a non-expert can check.** One verified contract on Blockscout in which `transfer`
   appears in one function and the recipient is `owner`.
4. **A has one live dependency, the RPC.** C adds a bundler and a paymaster.
5. **A is already proven.** A fork test run today had a plain contract buy NVDA, sell it, deposit into
   the vault and redeem, with every output returning to itself (section 4).

What A costs: the owner needs a few cents of ETH, and the code is unaudited. Section 6 says how to
contain both.

**Three findings change the brief, whichever option is chosen:**

- **`getPool != 0` is not a safety check.** NVDA has a pool at all four fee tiers and the 1% pool is
  initialised and EMPTY. A stolen operator key could seed it at an absurd price and route the desk into
  it. The fee tier must be pinned by the owner per token, never passed by the operator, and the contract
  must compute its own price floor from the Chainlink feed (sections 3.2 and 5).
- **Count sells at the larger of USDG received and oracle value.** Counting only what came back makes
  the cap weakest in exactly the attack it exists for. The honest promise is then: "the agent cannot
  send your funds to anyone, and a stolen agent key can lose at most the band times the daily cap per
  day until you revoke it".
- **Gas is cents, not a fraction of a cent.** A vault deposit costs about 9 cents and a swap about 3.
  Sweeping a $20 balance into a 3.6% vault takes about three months to pay for itself. The gate needs a
  minimum sweep size.

---

## 1. What is deployed on chain 4663 (VERIFIED by `cast code`)

Method: `cast code <addr> --rpc-url https://rpc.mainnet.chain.robinhood.com`, byte length recorded,
and for the important ones the keccak of the runtime code compared with the same address on Arbitrum
One (`https://arb1.arbitrum.io/rpc`). Canonical addresses were taken from each project's own repo:
`safe-global/safe-deployments`, `zerodevapp/sdk` (`packages/core/constants.ts`,
`plugins/permission/constants.ts`, `plugins/ecdsa/constants.ts`),
`alchemyplatform/modular-account` (`deployments/v2/Deployments.md`), `rhinestonewtf/module-sdk` and
`rhinestonewtf/sdk` (`src/modules/validators/smart-sessions/policies/addresses.ts`).

### Shared infrastructure: all present

| Contract | Address | Bytes |
|---|---|---|
| Deterministic deployment proxy (Arachnid) | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | 69 |
| Safe singleton factory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` | 69 |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | 11,838 |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | 3,808 |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | 9,152 |
| EntryPoint v0.6 / v0.7 / v0.8 | `0x5FF1...2789` / `0x0000000071727De22E5E9d8BAf0edAc6f37da032` / `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` | 23,689 / 16,035 / 21,738 |

### Option B building blocks: all present, bytecode identical to Arbitrum One

| Contract | Address | Bytes |
|---|---|---|
| Safe 1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | 23,579 |
| SafeL2 1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | 24,421 |
| SafeProxyFactory 1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | 3,054 |
| MultiSend 1.4.1 | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` | 629 |
| MultiSendCallOnly 1.4.1 | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` | 410 |
| CompatibilityFallbackHandler 1.4.1 | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` | 5,637 |
| SignMessageLib / CreateCall / SimulateTxAccessor 1.4.1 | `0xd53c...12c9` / `0x9b35...1A52` / `0x3d4B...6199` | 966 / 1,099 / 850 |
| Safe 1.3.0, both canonical and eip155 variants | e.g. SafeL2 `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` | 23,800 |
| Safe 4337 Module v0.3.0 | `0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226` | 8,373 |
| SafeModuleSetup v0.3.0 | `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47` | 547 |
| Zodiac Roles v2 mastercopy | `0x9646fDAD06d3e24444381f44362a3B0eB343D337` | 24,401 |
| Zodiac ModuleProxyFactory | `0x000000000000aDdB49795b0f9bA5BC298cDda236` | 2,046 |
| Zodiac Roles Integrity / Packer libs | `0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049` / `0x61C5B1bE435391fDd7bc6703F3740C0d11728a8C` | 5,637 / 2,138 |

`safe-deployments` lists `"4663": "canonical"` for v1.4.1 (VERIFIED in the repo file
`src/assets/v1.4.1/safe_l2.json`).

### Option C building blocks: present, with two gaps

| Contract | Address | Bytes |
|---|---|---|
| ZeroDev Kernel v3.1 implementation | `0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D` | 22,784 |
| ZeroDev KernelFactory v3.1 | `0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419` | 989 |
| ZeroDev meta factory (FactoryStaker) | `0xd703aaE79538628d27099B8c4f621bE4CCd142d5` | 1,871 |
| ZeroDev Kernel v3.3 impl / factory | `0xd6CEDDe84be40893d153Be9d467CD6aD37875b28` / `0x2577507b78c2008Ff367261CB6285d44ba5eF2E9` | 24,469 / 950 |
| ZeroDev ECDSA validator (Kernel 3.1+) | `0x845ADb2C711129d4f3966735eD98a9F09fC4cE57` | 1,819 |
| ZeroDev ECDSA signer for permissions | `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF` | 1,609 |
| ZeroDev call policy v0.0.4 / v0.0.5 | `0x9a52283276A0ec8740DF50bF01B28A80D880eaf2` / `0x85770b902D1e503D5f5141d9eaC16d0d08eEaDd2` | 6,539 / 11,455 |
| ZeroDev gas / rate limit / timestamp / sudo / signature policies | `0xaeFC...4b23` / `0xf63d...6873` / `0xB9f8...E20F` / `0x67b4...B9B7` / `0xF6A9...591d` | all present |
| Alchemy Modular Account v2 AccountFactory | `0x00000000000017c61b5bEe81050EC8eFc9c6fecd` | 6,661 |
| Alchemy ModularAccount / SemiModularAccountBytecode / SMA7702 | `0x0000...DD4f` / `0x0000...7383` / `0x69007702764179f14F51cdce752f4f775d74E139` | present |
| Alchemy SingleSignerValidationModule | `0x00000000000099DE0BF6fA90dEB851E2A2df7d83` | 3,976 |
| Alchemy AllowlistModule v2.0.1 | `0x00000000003e826473a313e600b5b9b791f5a59a` | 10,336 |
| Alchemy AllowlistModule v2.0.0 | `0x0000000000002311EEE9A2B887af1F144dbb4F6e` | **0, not deployed** (superseded by 2.0.1, harmless) |
| Alchemy TimeRange / NativeTokenLimit / PaymasterGuard modules | `0x0000...73eA` / `0x0000...be06` / `0x0000...42A1` | present |
| Rhinestone Registry | `0x000000000069E2a187AEFFb852bF3cCdC95151B2` | 18,522 |
| Rhinestone SmartSessions (current) | `0x00000000008bDABA73cD9815d79069c247Eb4bDA` | 23,608 |
| Rhinestone OwnableValidator (new) | `0x000000000013fdB5234E4E3162a810F54d9f7E98` | 12,702 |
| Rhinestone policies from the current `@rhinestone/sdk`: SpendingLimits `0x000000000033212E272655D8a22402Db819477A6`, UniversalAction `0x0000000000714Cf48FcF88A0bFBa70d313415032`, TimeFrame `0x0000000000D30f611fA3bf652ac6879428586930`, UsageLimit `0x00000000001d4479FA2A947026204d0283ceDe4B`, ValueLimit `0x000000000021dC45451291BCDfc9f0B46d6f0278`, Arg `0x0000000000167edE64D8751daACDdC0312565a73`, Sudo `0x0000000000FEEc8D74e3143fBaBbca515358d869` | | all present |
| Rhinestone policies at the OLDER `module-sdk` addresses (SpendingLimits `0x00000088D4...6343`, UniAction `0x0000006DDA...CF1F`, TimeFrame, UsageLimit, ValueLimit) | | **0 bytes on 4663**, although they exist on Arbitrum One |
| Safe7579 adapter `0x7579EE8307284F293B1927136486880611F20002` and launchpad `0x7579011aB74c46090561ea277Ba79D510c6C00ff` | | **0 bytes on 4663** |
| Rhinestone SmartSessions v1.0.0 `0x00000000002B0eCfbD0496EE71e01257dA0E37DE`, old OwnableValidator `0x2483DA33...Bf06`, Rhinestone attester `0x000000333034E9f539ce08819E12c1b8Cb29084d` | | **0 bytes on 4663** |

Code hashes match Arbitrum One for every contract compared (SafeL2, SafeProxyFactory, Roles v2,
ModuleProxyFactory, Safe 4337 module, KernelFactory 3.1, both call policies, Alchemy factory and
AllowlistModule, SmartSessions, OwnableValidator, UniversalActionPolicy). One expected exception: the
Kernel v3.1 implementation has the same length but a different hash, because Solady's EIP-712 caches
the chain id and domain separator as immutables.

**Bottom line for section 1: nothing is missing that would rule out B or C on contract grounds.** The
Rhinestone gap is only that the older `@rhinestone/module-sdk` addresses are dead here, so you must use
the current `@rhinestone/sdk`, and Safe-as-7579-account is not possible (no adapter).

---

## 2. Off-chain support for chain 4663 (providers, SDKs, UIs)

| Provider / tool | Status on 4663 | Evidence |
|---|---|---|
| Alchemy bundler, gas sponsorship, ERC-20 gas | VERIFIED supported | Alchemy "Wallet APIs supported chains" page lists Robinhood Mainnet and Testnet with all four ticks and says "Gas sponsorship on Robinhood Mainnet and Testnet is now live!". `aa-sdk/packages/common/src/chains.ts` exports `robinhoodMainnet` (id 4663). Robinhood's own Account Abstraction doc names Alchemy as the primary provider with `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`. |
| Alchemy session keys | VERIFIED available, **but too coarse for this product** | The Wallet APIs session key page lists the permission types: `native-token-transfer`, `erc20-token-transfer` (a cumulative allowance), `gas-limit`, `contract-access`, `account-functions`, `functions-on-all-contracts`, `functions-on-contract`, `root`. **There is no permission that constrains a function argument.** So you can allow `exactInputSingle` on the router, but you cannot force `recipient == the account`. The promise fails. |
| ZeroDev | PARTIAL | Robinhood's doc shows a ZeroDev example with `KERNEL_V3_1`. ZeroDev's own Supported Networks page does NOT list 4663 (it says the list may be incomplete and to check the dashboard, which I cannot see without an account, so UNVERIFIED whether a ZeroDev project can be created for 4663). ZeroDev documents using Pimlico as bundler and paymaster with the Kernel client, so the SDK does not need ZeroDev's own infrastructure. The call policy supports argument conditions. |
| Pimlico | VERIFIED supported | Pimlico supported chains page lists "Robinhood, Chain ID 4663, slug robinhood", EntryPoint v0.6, v0.7 and v0.8 with bundler and paymaster ticked, EIP-7702 ticked. Pricing page: the free plan covers testnets only. **Mainnet needs the pay-as-you-go plan, $0 per month but a card is required.** |
| Rhinestone | PARTIAL | The SDK changelog says `@rhinestone/shared-configs` 1.7.8 added Robinhood Chain 4663. SmartSessions and the current policy contracts are on chain (section 1). Safe7579 adapter is not, so the account would be a Nexus, Kernel or Startale account, not a Safe. The SDK is built around their orchestrator and needs an API key. Whether the orchestrator serves 4663 for plain same-chain user operations is UNVERIFIED (the docs table is filled at runtime from `https://v1.orchestrator.rhinestone.dev/chains`). |
| Safe{Wallet} web UI | **VERIFIED supported** | `https://safe-config.safe.global/api/v1/chains/4663/` returns chain "Robinhood Chain", short name `robinhood`, `l2: true`, recommended master copy 1.4.1, transaction service `https://api.safe.global/tx-service/robinhood`. That transaction service answers `/api/v1/about/` with version 6.10.1 and an indexer on chain 4663. So `app.safe.global` works on this chain. Note the config lists WalletConnect among disabled wallets. |
| Zodiac Roles app and SDK | **NOT supported** | `zodiac-modifier-roles/packages/sdk/src/main/chains.ts` and the app's `chains.ts` have no entry for 4663 (grep for 4663 and robinhood returns nothing in the repo). The mastercopy is on chain only because it is a deterministic deployment anyone can trigger. No subgraph, no Roles app, no `zodiac-roles-sdk` fetch or apply helpers for this chain. You would encode `scopeTarget`, `scopeFunction`, `setAllowance` and the condition trees by hand. |

**Reading of section 2:** the only option C stack with full first-party support on 4663 is Alchemy, and
Alchemy's session keys cannot express the core promise. The stack that CAN express it (ZeroDev call
policy, or Rhinestone UniversalActionPolicy) has second-class support on this chain. Option B has a real
Safe UI but no Roles tooling.

---

## 3. Facts the Desk contract is built on (VERIFIED on chain)

### 3.1 SwapRouter02 at `0xcaf681a66d020601342297493863e78c959e5cb2`

Blockscout's API sits behind a Cloudflare challenge for scripts, so I verified the interface from the
deployed bytecode instead (24,497 bytes), by searching for function selectors.

| Selector | Function | In bytecode |
|---|---|---|
| `0x04e45aaf` | `exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96))` | PRESENT |
| `0x414bf389` | the old SwapRouter v1 struct that includes `deadline` | **absent** |
| `0xb858183f` | `exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum))` | PRESENT |
| `0x5ae401dc` | `multicall(uint256 deadline, bytes[] data)` | PRESENT |
| `0x1f0464d1`, `0xac9650d8` | `multicall(bytes32,bytes[])`, `multicall(bytes[])` | PRESENT |
| `0xf2d5d56b`, `0xdf2ab5bb`, `0x49404b7c` | `pull`, `sweepToken`, `unwrapWETH9` | PRESENT |

- `factory()` returns `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`, the factory we expected.
- The Permit2 address does not appear anywhere in the router bytecode. The router pulls with a plain
  `transferFrom` on the caller, so the desk must `approve` the router. It is not Permit2 based.
- **Deadline.** The struct has none. Two ways to bound it. Either wrap the call in
  `multicall(deadline, [calldata])`, which reverts "Transaction too old" (confirmed live by the other
  research pass), or take a `deadline` argument on `Desk.buy`/`Desk.sell` and
  `require(block.timestamp <= deadline)`. **Use the second.** It is one line, it keeps the router call
  a single typed call with no nested `bytes`, and it also covers the vault functions.

### 3.2 `getPool != 0` is NOT enough. This is the most important finding for option A.

For USDG/NVDA the factory returns a pool at ALL FOUR fee tiers:

| Fee | Pool | USDG held | NVDA held | Active liquidity |
|---|---|---|---|---|
| 0.01% | `0xb75d2D02B0Ec3DE50d32e40A4F1A8DAE8acC4333` | 82.91 | 0.0030 | tiny |
| 0.05% | `0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3` | 3,817,442 | 10,908 | deep |
| 0.3% | `0xB944cec30Bd4175855215D767ADC81F39e5f7E2B` | 30,776 | 73 | thin |
| 1% | `0xc277560DF3689A401bA7deDd7626168b234Ceb5e` | 0 | 0 | **0. Initialised and empty.** |

An empty initialised pool is a loaded gun. Anyone, including whoever holds a stolen operator key, can
put a sliver of liquidity into the 1% pool at an absurd price, call `buy(NVDA, cap, minOut=1, fee=10000)`,
and the desk's USDG lands in their own liquidity position. The funds never "left the desk to a third
party" by a transfer, yet they are gone. **Every option (A, B and C) has this hole unless the fee tier
is pinned and the minimum output is bounded by something the operator does not control.**

So in the Desk contract the `fee` must NOT be a free operator argument. The owner's allowlist entry is
`token -> (pool fee, price feed, enabled)`, and the contract resolves the pool itself. `getPool` stays
as a sanity check at allowlist time, not at trade time.

### 3.3 Steakhouse USDG, Morpho Vault V2 `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`

- `asset()` is USDG. Share token has 18 decimals. `previewDeposit(100e6)` = 99.2615e18 shares.
  `previewRedeem(100e18)` = 100.743954 USDG.
- `maxDeposit`, `maxWithdraw`, `maxRedeem` all return **0**. Confirmed. Never branch on them.
- **Simulated redeem works.** `eth_call` of `redeem(shares, holder, holder)` from a real holder
  (`0x5c32fa74675ea254a2b3a3dca1b9392124c43982`, 99.26 shares from a 100 USDG deposit) returns
  100.000222 USDG. `previewRedeem` said 100.000221. The same call from a stranger with no allowance
  reverts with an arithmetic underflow, which is the share allowance check.
- Recent depositors include amounts of 0.43, 2, 100 and 105 USDG, so small desks are fine. Those
  depositors have 23 bytes of code, which is the EIP-7702 delegation marker, so accounts with code
  already hold shares without trouble.
- **How to read instantly available liquidity.** Two ways, and they agree to the dollar:

  On chain. `liquidityAdapter()` is `0x44ABc1d6cCFF2696d98890B92E2157AF242179c2`, a MorphoMarketV1
  adapter, and `liquidityData()` decodes to one Morpho Blue market (loan USDG, collateral USDe
  `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`, LLTV 91.5%, market id
  `0xc845da65a020ddca5f132efa8fea79676d8edfdea504226a4c01e7a9e34cddd6`). Morpho Blue is at
  `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` (read from `adapter.morpho()`).

  ```
  idle        = USDG.balanceOf(vault)                                    = 3,299,557
  marketFree  = market(id).totalSupplyAssets - totalBorrowAssets         = 34,039,819
  adapterPos  = position(id, adapter).supplyShares converted to assets   = 317,918,398
  available   = idle + min(adapterPos, marketFree)                       = 37,339,377 USDG
  ```

  From the API. This query works today and returns `liquidity: 37339376564493`, the same number:

  ```graphql
  query {
    vaultV2ByAddress(address: "0xBeEff033F34C046626B8D0A041844C5d1A5409dd", chainId: 4663) {
      totalAssets idleAssets liquidity liquidityUsd forceDeallocatableLiquidity netApy
      liquidityAdapter { address type }
    }
  }
  ```

  $37M of exit liquidity against desks of at most a few thousand dollars means this will not bind in
  practice. The contract should simply call `redeem` and let it revert. The agent checks the API first
  so the failure message can name the cause.

### 3.4 Stock Tokens (NVDA `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`)

- NVDA is a 283 byte **BeaconProxy**. The beacon is `0xe10b6f6B275de231345c20D14Ab812db62151b00` and the
  current implementation is `0xb35490d6f9163DE4F80d88dc75c3516eb64C5aE2` (11,614 bytes).
- That same beacon address is also what the token returns from `ACCESS_CONTROLLED_REGISTRY()`. It is
  one contract doing four jobs. Its selectors: `upgradeTo(address)`, `implementation()`,
  `blockAccounts(address[])`, `unblockAccounts(address[])`, `isBlocked(address)`, `pause()`,
  `unpause()`, `paused()`, plus OpenZeppelin AccessControl. **One admin action upgrades every Stock
  Token at once, and one action can pause them all.**
- Implementation selectors found: standard ERC-20 plus `permit`, `uiMultiplier()`,
  `newUIMultiplier()`, `effectiveAt()`, `updateMultiplier(uint256)` and `(uint256,uint256)`,
  `balanceOfUI(address)`, `totalSupplyUI()`, `oraclePaused()`, `pauseOracle()`, `unpauseOracle()`,
  `pause()`, `unpause()`, `paused()`, `tokenPaused()`, `mint`, `burn`, **`adminBurn(address,uint256)`**,
  `setMetadata`, `terms()`, `uid()`. Error selectors include `Blocked(address)`.
- Live values: `paused()` false, `tokenPaused()` false, `oraclePaused()` false, registry `paused()`
  false, `uiMultiplier()` 1.000775159e18, registry `isBlocked` false for the pool AND for a never used
  address. **So it is a denylist, not an allowlist. A brand new contract can receive, hold, approve
  and send Stock Tokens.** Simulated `transfer` of 1 wei from the pool to a fresh address and to a
  contract (Multicall3) both return true, and a contract calling `approve(router)` returns true.
- Contracts already hold them: the 0.05% pool holds 10,908 NVDA.
- What this means for a holding contract:
  1. Hold and account in RAW `balanceOf` units. Never use `balanceOfUI` in contract maths. The
     multiplier changes what a token is worth, not how many the desk has, and the Chainlink "RHNVDA /
     USD" feed already prices the raw token.
  2. The issuer can block the desk address, pause the token, or `adminBurn` its balance. No
     architecture protects against that, and the disclosures screen should say so.
  3. If the desk gets blocked, `sell` and `withdraw` of that token revert. Withdraw must therefore be
     per token, never an all-or-nothing loop, so one frozen token cannot trap the USDG.
  4. No fee on transfer logic was found, but measure balance deltas anyway. It costs nothing.

---

## 4. Foundry workflow on 4663

- **Fork testing works against the public RPC, at the latest block only.** VERIFIED by running a real
  fork test: `forge test --fork-url https://rpc.mainnet.chain.robinhood.com` with a test contract that
  stands in for a desk. It took 200 USDG from the pool with `vm.prank`, bought NVDA through
  SwapRouter02 with `recipient = address(this)`, sold it back, deposited 50 USDG into the vault and
  redeemed. Result: PASS in 30 seconds.

  | Step | Result | Gas |
  |---|---|---|
  | `approve` USDG to router | ok, and the allowance is exactly 0 after the swap | 31,880 |
  | buy 100 USDG of NVDA, fee 500 | 0.449244 NVDA, versus 0.449545 at the feed price (7 bps worse) | 114,319 |
  | sell it all back | 99.900025 USDG, so a 10 bps round trip, all of it pool fees | 55,202 |
  | vault `deposit(50e6)` | shares credited to the contract | 324,504 |
  | vault `redeem(all)` in the same block | 49.999999 USDG, a 1 wei rounding loss | 26,913 |

  The redeem was cheap only because the deposit had just left idle USDG in the vault. A real redeem
  that pulls from the Morpho market through the liquidity adapter will cost several times more gas.

  So a plain contract can do everything the desk needs. No allowlist, gate or hook got in the way.
- **The public RPC is NOT an archive node.** VERIFIED: `cast call --block` succeeds 5,000 blocks back
  and fails 10,000 blocks back with "historical state ... is not available". Blocks are 0.1 seconds, so
  the window is roughly 8 to 16 minutes. `cast logs` over a 20,000 block range does work. Consequence:
  `--fork-block-number` pinned tests break within minutes unless every slot is already in Foundry's
  local cache. Run fork tests unpinned, and make assertions relative (deltas and bounds), never
  absolute prices.
- **Use an Alchemy RPC for fork tests and for the agent.** Alchemy lists the chain and Robinhood's own
  docs point at `https://robinhood-mainnet.g.alchemy.com/v2/{KEY}`. It removes the 0.3 second pacing
  problem. Whether Alchemy serves archive state on this chain is UNVERIFIED (no key available here).
  Test it once with `cast call --block <head - 1000000>` before relying on a pinned block.
- **Chain facts that affect compilation.** Client is `nitro/v3.12.0-rc.2`. Cancun is live: raw
  `eth_call` probes of `TSTORE/TLOAD` and `MCOPY` both returned the expected value. So
  `evm_version = "cancun"` with solc 0.8.28 is safe, and OpenZeppelin's `ReentrancyGuardTransient`
  would work.
- **Deploy and verify**, from `hummusonrails/robinhood-chain-dapp-example` (`scripts/deploy.sh`):

  ```bash
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --slow \
    --gas-estimate-multiplier 300 \
    --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
  ```

  `--slow` waits for each receipt. The 300% gas multiplier is there because Arbitrum stack estimates
  include an L1 data component that moves between estimate and execution. Verify the implementation
  AND the factory. Blockscout recognises EIP-1167 clones of a verified implementation, so each desk
  shows readable source and a working "Write contract" tab. That last point is UNVERIFIED on this
  particular Blockscout instance, so check it with the first clone.
- **Gas is cents, not a fraction of a cent. Correct the brief.** Gas price is 0.0675 gwei and ETH is
  $2,637 today. Two real vault deposits cost 509,206 and 509,254 gas, which is 0.0000344 ETH or about
  **9 cents each**. A swap from the desk will be roughly 190,000 gas, about 3 cents. This matters for a
  $20 desk: sweeping $20 into a 3.6% vault earns 0.2 cents a day, so a 9 cent sweep plus a later redeem
  takes about three months to pay for itself. **The gate needs a minimum sweep size.** A sensible rule
  is to sweep only when the idle amount times the expected idle days times 0.0001 exceeds about 20
  cents, which in practice means idle balances of a few hundred dollars or more.

---

## 5. How the caps should count, especially for sells

The cap exists for one scenario: the operator key is stolen, or our server is compromised. An honest
agent is already limited by the off-chain gate. So ask of every rule, "does it still hold when the
operator is the attacker?"

### The rule

| Action | What counts against the per-action and daily caps |
|---|---|
| `buy` | `usdgIn`. Exact, and the operator cannot fake it. |
| `sell` | **the larger of** the USDG actually received and the oracle value of the tokens sold (`amountIn * feedPrice / 1e20`). |
| `sweepToVault`, `redeemFromVault` | nothing. Value does not leave. The vault has zero fees, the shares or assets come back to the desk, and a round trip loses 1 wei. |
| `checkpoint`, `pause` | nothing. |

Why not simply "count USDG received" on sells. Because in the attack case the attacker arranges for
very little USDG to come back. Counting what came back makes the cap weakest exactly when it is
needed. The oracle value is the one number in the transaction the operator cannot move. Taking the
larger of the two keeps the rule conservative when the pool trades above the feed.

### The second rule matters more than the cap: bound the price inside the contract

`minOut` supplied by the operator protects against the market. It does nothing against the operator.
The contract must compute its own floor:

```
buy :  tokenOut >= usdgIn   * 1e20 / price * (10000 - bandBps) / 10000
sell:  usdgOut  >= amountIn * price / 1e20 * (10000 - bandBps) / 10000
```

`price` is `latestRoundData()` on the token's AggregatorV3 feed. VERIFIED for NVDA: 8 decimals,
description "RHNVDA / USD", so it prices the RAW token and already includes the multiplier. USDG is
treated as one dollar. The formula was checked in the fork test above: 100 USDG gives 0.449545 NVDA
at the feed and the pool delivered 0.449244.

With both rules, the honest statement of the promise becomes:

> The agent cannot send your funds to anyone. The worst a stolen agent key can do is make bad trades,
> and those can cost at most `bandBps` of `dailyCap` per day, plus pool fees, until you revoke it.

With a $500 daily cap and an 8% band that is $40 a day. Every trade also sends a Telegram message, so
the owner sees it. Say this sentence on the disclosures screen. It is stronger than a vague
"cannot steal" because it is true.

### What is safe on weekends

The feed is `us_equities_24/5`. Today, Saturday, it is 82,365 seconds old and still shows Friday
19:55 UTC. The pool was 0.02% above it when I checked. Your own measurements found up to 2.5% of
weekend drift on NVDA, and 3.8% by Monday's open.

- Do NOT use a short staleness limit on chain. It would block every weekend trade, which is the whole
  product. Use `maxFeedAge` of 4 days (345,600 seconds) only as a "the feed is dead" detector.
- Do use the band as the weekend guard. **Default `bandBps = 800`.** Reason: a protective sell such as
  "cut NVDA by half if it falls 3% on-chain" must still pass when the pool is 3 to 5% below Friday's
  close. A 3% band would block the very stop-loss the demo is about. The price of that choice is the
  $40 a day figure above. The owner can tighten it.
- Revert when `price <= 0`, when `updatedAt == 0`, when the feed is older than `maxFeedAge`, and when
  the token's `oraclePaused()` is true. Wrap `oraclePaused()` in `try/catch` and ignore a failure,
  because the token is upgradeable and a removed function must not brick the desk.
- Halts cannot be enforced on chain (no flag exists, as the other pass established). That stays in the
  off-chain gate.
- The owner is never subject to the band, the caps or the pause. Withdraw always works.

### The upgrade if there is time: use the pool's own TWAP on weekends

VERIFIED: the NVDA 0.05% pool has observation cardinality 6,000 and `observe([1800,0])` returns data,
so a 30 minute TWAP is readable on chain today (it gave tick 222,272, equal to the spot tick). A rule of
"execution within 1% of the 30 minute TWAP, AND within 8% of the feed" is far tighter than the feed
band alone and works all weekend. Moving a $3.8M pool's 30 minute average costs far more than a $500
daily cap can return. Cost: about 100 lines of well known tick maths (`TickMath.getSqrtRatioAtTick`
ported to 0.8) and a cardinality check per token when it is allowlisted. **Not for version one.**
Ship the feed band, then add this.

### The daily window

Fixed window: `if (block.timestamp >= windowStart + 1 days) { windowStart = now; spent = 0; }`. It is
ten lines and easy to audit. Known weakness: spending at the end of one window and the start of the
next gives up to twice the cap inside 24 hours. Accept it and say so. A rolling window is not worth
the code.

---

## 6. A versus B versus C, for this product and this week

### What the promise actually requires

Five things must be enforced on chain, not by our server:

1. Swap output, vault shares and redeemed USDG can only return to the desk.
2. Only allowlisted tokens, and (from finding 3.2) only the owner's chosen pool for each.
3. Per-action and daily caps in USDG, for buys AND sells.
4. A price floor the operator does not control.
5. The decision hash committed in the same transaction as the trade, every time.

| Requirement | A. Desk.sol | B. Safe + Roles v2 | C. 4337 session keys |
|---|---|---|---|
| 1. Output to desk only | By construction. `recipient` is hard coded to `address(this)`. | Yes. Roles has an `EqualToAvatar` condition on `recipient` and on the vault `receiver` and `owner`. | ZeroDev call policy or Rhinestone UniversalActionPolicy: yes, an `EQUAL` rule on the argument. **Alchemy: NO.** Its permissions stop at function selectors. |
| 2. Token and pool pinned | Yes. Owner's map `token -> fee, feed`. | Yes, as conditions on `tokenIn`, `tokenOut` and `fee`. | ZeroDev and Rhinestone yes. Alchemy no. |
| 3. USDG caps on buys | Yes. | Yes. `WithinAllowance` on `amountIn` with a daily refill, plus a `LessThan` for per-action. | Per action yes. Daily: ZeroDev has no cumulative amount policy (its rate limit counts operations, not dollars). Rhinestone's usage limits are cumulative for the life of the session with no daily reset. |
| 3. USDG caps on sells | Yes, by oracle value. | **No.** The input is a Stock Token amount. Roles can cap it in token units only, which drifts with price. | **No.** Same reason. |
| 4. Oracle price floor | Yes, about 20 lines. | **No**, not without writing a custom condition contract. | **No**, and worse: ERC-7562 rule STO-033 lets only a staked paymaster or factory read third party storage during validation. A session key policy cannot read a Chainlink feed or a pool. It would need a custom execution hook. |
| 5. Hash in the same tx, always | Yes. It is a required argument and part of the trade event. | Possible: a MultiSend of swap plus a call to a log contract you write (the 2.1.1 MultiSend unwrapper IS deployed at `0xB4Cd4bb764C089f20DA18700CE8bc5e49F369efD`, the legacy one is not). But nothing forces the agent to include the log call. | Possible as a batched user operation, with the same weakness: optional, not enforced. |
| Agent can pause | Yes. | No native concept. | No native concept. |

**B and C both still need custom Solidity** to meet requirements 3 (sells), 4 and 5. Once you are writing
and deploying an unaudited contract anyway, the question is whether it should be the whole system, in
250 lines, or a plug-in wedged into a general purpose account that you also have to configure
correctly. That is the core of the recommendation.

### The five criteria you asked for

| | A. Desk.sol clones | B. Safe + Zodiac Roles v2 | C. 4337 + session keys |
|---|---|---|---|
| **Build effort, solo** | About 2 days: 250 lines of contract, 40 of factory, 500 of tests. The fork test in section 4 already proves the hard calls work. | About 3 days. The Roles SDK and app do not know chain 4663, so targets, conditions and allowances are encoded by hand and cannot be inspected in the Roles app. Plus the custom condition and log contracts. Plus Safe SDK in the frontend. | About 3 days. Pick and learn one SDK, open a bundler account (Pimlico mainnet needs a card, ZeroDev does not list the chain), write the custom hook and log contract, and route every owner action through user operations. |
| **Can a non-expert check "the agent cannot send funds away"?** | **Best.** One verified contract on Blockscout. The word `transfer` appears in one function, `withdraw`, and the recipient is `owner`. Anyone can paste 250 lines into any AI and ask. | Poor. The rule lives as a packed condition tree in the Roles modifier's storage. The only tool that renders it readably does not support this chain. | Poor. The rule is an ABI encoded policy blob inside a modular account. No explorer decodes it. The claim rests on the account, the validator, the policy contracts and the EntryPoint all being right. |
| **Things that can fail in a live demo** | The RPC. That is all. The operator EOA sends a normal transaction. | The RPC. The agent calls `execTransactionWithRole` directly, so no relayer is needed. The Safe transaction service matters only if the owner uses the Safe UI. | The RPC, the bundler API, the paymaster API if sponsoring, and the SDK's gas estimation against a young chain. Three vendors' uptime instead of one. |
| **Owner experience** | Needs a little ETH: one transaction to create the desk with its limits, then fund it. Relay can deliver gas ETH with the bridge, and it can deliver USDG straight to the desk address. Withdraw is one ordinary transaction from any wallet. **If our site is down, the owner withdraws from Blockscout's Write tab.** | Owner must understand they now own a Safe. Create Safe, then one batched configuration transaction, then fund. Withdraw is a Safe transaction, from our UI or from app.safe.global, which does support this chain. Needs ETH. | **Best on paper.** No ETH needed if we sponsor. One off-chain signature enables the session. But withdrawals are user operations, so they depend on our frontend plus a bundler being alive. MetaMask cannot delegate to a third party 7702 implementation, so the desk is a new counterfactual account either way. |
| **Audit risk** | Custom code holding real money, unaudited. Mitigated by size, by having no `delegatecall` and no arbitrary `call`, by being non-upgradeable with no admin, and by small desks. | The base is heavily audited. The risk moves to configuration: one wrong condition is a hole, and there is no tool on this chain to review it. Plus the custom pieces. | The base is audited. Risk is configuration plus the custom hook, written for an execution environment with more footguns than a plain contract. |

### Why not C, in one paragraph

C wins only on "the owner needs no ETH". That is a convenience worth a few cents per owner. Against it:
the one provider with first class support on this chain (Alchemy) cannot express the core promise, the
stacks that can are second class here, the daily cap and the price floor cannot be done in a
validation-phase policy at all, and the live demo would depend on three services instead of one. Your
own decisions file already says gasless is "an architecture choice for later, not a feature to promise".

### Why not B, in one paragraph

B is the respectable answer on a chain where the Roles tooling exists. Here it does not. You would be
hand encoding condition trees nobody can display, and still writing custom contracts for the sell cap,
the price floor and the log. B's one real advantage, an independent UI for the owner, is matched in A by
Blockscout's Write tab.

### The honest weakness of A, and how to contain it

It is new code holding real money with no audit. Contain it like this:

- No upgrade path, no admin, no fee switch, no owner transfer. The factory owns nothing.
- Router, factory, vault and USDG addresses are constants in the implementation, so not even the owner
  can be phished into repointing them.
- Exact approvals, reset to zero after every call. No standing allowance for anyone.
- `nonReentrant` on everything that moves value. Checks, then effects, then the external call.
- Fork tests for every path, plus an invariant test that throws random operator calls at it.
- Run `/security-review` and a second model over the contract before funding it.
- Keep Abu's first desk small for the first weekend.
- Put the true sentence from section 5 on the disclosures screen.

---

## 7. Interface sketch for option A

Two contracts. OpenZeppelin v5: `Clones`, `Initializable`, `ReentrancyGuard`, `SafeERC20`.

**Do not use OZ `Ownable`, `Ownable2Step` or `Pausable` here.** `Ownable`'s constructor never runs in
a clone, so the owner would be the zero address. More importantly, the design is safer with NO ownership
transfer at all: "funds can only ever go to `owner`, and `owner` never changes" is an invariant a reader
can check in seconds. Someone who wants a new wallet withdraws and opens a new desk. Pause is two
lines, so write it by hand and keep `unpause` owner only.

### DeskFactory.sol

```solidity
address public immutable implementation;           // Desk with _disableInitializers() in its constructor
mapping(address owner => address[] desks) public desksOf;

function createDesk(Desk.Config calldata cfg, bytes32 salt) external returns (address desk);
    // owner = msg.sender, always. Nobody can create a desk on someone else's behalf.
    // desk = Clones.cloneDeterministic(implementation, keccak256(abi.encode(msg.sender, salt)))
    // Desk(desk).initialize(msg.sender, cfg)
function predictDesk(address owner, bytes32 salt) external view returns (address);
    // lets the UI show the desk address before it exists, so Relay can bridge straight to it

event DeskCreated(address indexed owner, address indexed desk, address operator);
```

### Desk.sol

```solidity
// ---- constants baked into the implementation, identical for every clone ----
address constant USDG     = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
address constant ROUTER   = 0xCaf681a66D020601342297493863E78C959E5cb2;   // SwapRouter02
address constant V3FACTORY= 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
address constant VAULT    = 0xBeEff033F34C046626B8D0A041844C5d1A5409dd;   // Steakhouse USDG, ERC-4626

// ---- storage ----
address public owner;                 // set once in initialize, never changes
address public operator;              // address(0) means revoked
bool    public paused;
uint64  public seq;                   // increments on every recorded action, gap free
bytes32 public head;                  // head = keccak256(head, seq, decisionHash). A hash chain.

uint128 public perActionCapUsdg;      // 6 decimals
uint128 public dailyCapUsdg;
uint128 public spentInWindow;
uint40  public windowStart;
uint16  public bandBps;               // default 800
uint32  public maxFeedAge;            // default 345_600 (4 days)

struct TokenCfg { uint24 fee; address feed; uint8 feedDecimals; bool enabled; }
mapping(address token => TokenCfg) public tokenCfg;
address[] public tokens;              // capped at 16, only so the UI and exit() can enumerate

struct Config { address operator; uint128 perActionCapUsdg; uint128 dailyCapUsdg;
                uint16 bandBps; uint32 maxFeedAge; address[] tokens; uint24[] fees; address[] feeds; }

function initialize(address owner_, Config calldata cfg) external initializer;

// ---- operator OR owner. Caps, band and pause apply to the operator only. ----
function buy (address token, uint256 usdgIn,   uint256 minOut,     uint40 deadline, bytes32 decisionHash)
    external returns (uint256 tokenOut);
function sell(address token, uint256 amountIn, uint256 minUsdgOut, uint40 deadline, bytes32 decisionHash)
    external returns (uint256 usdgOut);
function sweepToVault   (uint256 usdgAmount, bytes32 decisionHash) external returns (uint256 shares);
function redeemFromVault(uint256 shares,     bytes32 decisionHash) external returns (uint256 usdgOut);
function checkpoint(bytes32 decisionHash) external;   // non-actions. One hash can be a day's Merkle root.
function pause() external;                            // operator or owner

// ---- owner only. Never blocked by pause, caps, band or a revoked operator. ----
function withdraw(address token, uint256 amount) external;   // ANY ERC-20, including vault shares. To owner only.
function unpause() external;
function setOperator(address newOperator) external;
function revokeOperator() external;                          // operator = 0 AND paused = true. One transaction.
function setLimits(uint128 perAction, uint128 daily, uint16 bandBps_, uint32 maxFeedAge_) external;
function allowToken(address token, uint24 fee, address feed) external;
    // requires IUniswapV3Factory(V3FACTORY).getPool(USDG, token, fee) != 0
    // requires the pool's liquidity() > 0 and the feed's latestRoundData() to be sane
function disallowToken(address token) external;              // blocks buys. Sells stay allowed so the desk can exit.
function exit() external;   // optional panic button: revoke, then best effort redeem and withdraw of everything,
                            // each step in try/catch so one frozen token or an illiquid vault cannot trap the rest

// ---- events ----
event Bought  (uint64 indexed seq, address indexed token, uint256 usdgIn,   uint256 tokenOut, int256 feedPrice, bytes32 indexed decisionHash);
event Sold    (uint64 indexed seq, address indexed token, uint256 amountIn, uint256 usdgOut,  int256 feedPrice, uint256 countedUsdg, bytes32 indexed decisionHash);
event Swept   (uint64 indexed seq, uint256 usdgIn, uint256 shares,  bytes32 indexed decisionHash);
event Redeemed(uint64 indexed seq, uint256 shares, uint256 usdgOut, bytes32 indexed decisionHash);
event Checkpoint(uint64 indexed seq, bytes32 indexed decisionHash);
event Paused(address indexed by);  event Unpaused();
event OperatorSet(address indexed operator);  event OperatorRevoked();
event LimitsSet(uint128 perAction, uint128 daily, uint16 bandBps, uint32 maxFeedAge);
event TokenAllowed(address indexed token, uint24 fee, address feed);  event TokenDisallowed(address indexed token);
event Withdrawn(address indexed token, uint256 amount);
```

### The body of `buy`, in order (sell is the mirror)

1. `nonReentrant`. Caller is operator or owner. `decisionHash != 0`. `block.timestamp <= deadline`.
2. If the caller is the operator: not paused, `usdgIn <= perActionCap`, roll the window, `spent + usdgIn <= dailyCap`, then add it. For sells the amount to add is known only after step 6, so check and add it there.
3. `cfg = tokenCfg[token]`, must be enabled. **The fee comes from `cfg`, never from the caller.**
4. Read the feed. Revert on a non-positive price, a zero `updatedAt`, or age over `maxFeedAge`. `try token.oraclePaused()` and revert if it returns true.
5. `forceApprove(ROUTER, usdgIn)`, record both balances, call `exactInputSingle` with `recipient = address(this)` and `sqrtPriceLimitX96 = 0`, then `forceApprove(ROUTER, 0)`.
6. Measure the balance deltas. Require `usdgDelta == usdgIn`, `tokenDelta >= minOut`, and if the caller is the operator, `tokenDelta >= oracleFloor`.
7. `seq++`, `head = keccak256(abi.encode(head, seq, decisionHash))`, emit.

### Invariants, stated so they can be tested

- **I1.** No function sends any token to any address other than `owner`, except the two fixed
  counterparties: the router's pull inside a swap, and the vault's pull inside a deposit.
- **I2.** After every external call returns, `allowance(desk, ROUTER) == 0` and `allowance(desk, VAULT) == 0` for every token.
- **I3.** In any window, the counted operator spend is at most `dailyCap`. No single operator action exceeds `perActionCap`.
- **I4.** Every operator trade satisfies the oracle floor. So the desk's value at feed prices falls by at most `bandBps` of that trade's size.
- **I5.** `owner` never changes after `initialize`. `initialize` runs once. The implementation itself cannot be initialised.
- **I6.** `withdraw`, `unpause`, `revokeOperator`, `setLimits` and `exit` succeed for the owner in every state: paused, operator revoked, cap exhausted, feed dead.
- **I7.** `seq` rises by exactly one per recorded action and `head` is a pure function of the event history, so anyone can recompute it from logs and detect an omitted or altered record.
- **I8.** The desk cannot receive ETH. No `receive`, no `fallback`, nothing payable.

---

## 8. The test list

Fork tests run unpinned against an Alchemy RPC. Unit tests use mocks.

**Setup and access**
1. The implementation cannot be initialised. A clone cannot be initialised twice.
2. `createDesk` always sets `owner = msg.sender`. `predictDesk` matches the deployed address.
3. Every operator function reverts for a stranger. Every owner function reverts for the operator.

**Buy and sell, on a fork**
4. Happy path buy: NVDA lands in the desk, router allowance is 0 afterwards, `seq` and `head` advance, the event carries the hash.
5. Happy path sell: the mirror. The counted amount is the larger of received and oracle value.
6. Reverts: token not allowed, disabled token on buy (but sell still allowed), over per-action cap, over daily cap, deadline passed, paused, zero hash, `minOut` not met.
7. **Poisoned pool.** On the fork, add a sliver of liquidity to the empty NVDA 1% pool at an absurd price. Show the operator has no way to route there. Then have the owner wrongly allowlist fee 10000 and show the oracle floor still reverts the trade.
8. **Sandwich.** Prank a whale to push the 0.05% pool 10% away, then an operator buy reverts on the floor. Push it 5%, inside the band, and it passes, and the loss is within `bandBps`.
9. Feed failures with `vm.mockCall`: price 0, negative price, `updatedAt` 0, age over `maxFeedAge`, `oraclePaused()` true, and `oraclePaused()` reverting (must be ignored).
10. Weekend case: warp 60 hours past `updatedAt` and confirm trades still pass inside the band.
11. Window: fill the cap, confirm the revert, warp 24 hours, confirm it resets. One test that documents the twice-the-cap boundary behaviour.
12. The owner calling `sell` ignores caps, band and pause.

**Vault, on a fork**
13. Sweep then redeem returns at least the deposit minus 2 wei. Shares sit in the desk. Caps untouched.
14. Redeeming more shares than held reverts. Sweep and redeem revert for the operator while paused.
15. Vault allowance is 0 after sweep.

**Owner powers**
16. Withdraw USDG, a Stock Token, vault shares, and a random airdropped ERC-20. All go to `owner`.
17. Withdraw works while paused, with the operator revoked, and with the cap exhausted.
18. A mock token whose `transfer` reverts does not stop the withdrawal of other tokens, and `exit()` completes around it.
19. `revokeOperator` is one transaction, after which every operator call reverts and `paused` is true.
20. The operator can pause and cannot unpause.

**Adversarial**
21. Reentrancy: an allowlisted mock token that calls back into `buy`, `sell` and `withdraw` during transfer is stopped.
22. Sending ETH to the desk reverts.
23. **Invariant test.** A handler makes random operator calls with random arguments over many runs, with a few attacker addresses. Assert: attacker balances never rise, allowances are 0 after every call, counted spend never exceeds the cap, and desk value at feed prices never falls by more than `bandBps` of turnover plus pool fees.

---

## 9. What I could not verify, and the risks that remain

- UNVERIFIED: whether Alchemy serves archive state on 4663. Test before pinning fork blocks.
- UNVERIFIED: whether this Blockscout instance auto-detects EIP-1167 clones and shows the Write tab.
  If it does not, verify each clone, or add the owner actions to our UI and also document the raw
  `cast send` commands as the escape hatch.
- UNVERIFIED: the Stock Token source. Blockscout's API is behind a Cloudflare challenge for scripts, so
  everything in 3.4 comes from selectors in the deployed bytecode, resolved through the openchain
  signature database, plus live calls. Read the verified source in a browser once.
- UNVERIFIED: whether a ZeroDev project can be created for 4663 (their public list omits it) and
  whether Rhinestone's orchestrator serves 4663. Neither matters if you take option A.
- Context7 failed to connect in this session. I read the projects' own GitHub repos instead, which is
  the more authoritative source anyway.
- The Stock Token issuer can block the desk, pause the token, burn its balance, or upgrade all tokens
  at once through one beacon. No architecture changes that. Disclose it.
- USDG is treated as exactly one dollar in the floor maths. A depeg would make the floor wrong in the
  owner's favour on buys and against them on sells. Acceptable for version one.
- A multiplier change moves the raw token's fair value at `effectiveAt`. The feed already prices the raw
  token, but have the gate avoid trading a token within a few minutes of a pending `effectiveAt`.
- Only 37 Stock Tokens have a feed. With this design a token without a feed cannot be allowlisted.
  That is the right constraint, not a limitation to work around.
- One operator key serves every desk. If it leaks, every desk is exposed to the bounded loss in
  section 5 at once. Keep it in the host's secret store, alert on every trade, and consider one
  derived operator key per desk later. The contract already supports that since `operator` is per desk.
