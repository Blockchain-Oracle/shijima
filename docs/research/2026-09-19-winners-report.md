# Hackathon winners research: AI agents in crypto, Mar–Sep 2026

Research agent report, 2026-09-19. Every project has a URL. Gaps stated where sources ran out.

## 0. Scope and what could not be verified

Window is March–September 2026, with a few Jan–Feb 2026 events where they set the pattern.
- Colosseum Agent Hackathon (Feb 2–12, 2026, $100K, agents built autonomously): coverage names only categories ("automated DeFi strategies, on-chain data analysis agents, social-to-onchain"). No named winners found. https://www.kucoin.com/news/insight/SOL/69f552ab2f8d6c000731b37a
- OpenServ 2025 hackathon: 2nd (ASSUREFI) and 3rd (Portfolio Sentinel) confirmed; 1st place never surfaced.
- lablab AI Trading Agents (Kraken/Surge, Mar 30–Apr 12): only community-vote rankings public. Alpaca AI Trading Agents (Aug 28–Sep 4): judging pending.
- ETHGlobal sponsor-by-sponsor winners at Cannes/NYC/Lisbon: only what showcase prize icons and Arc's blog reveal.

## 1. Event map

| Event | Dates | Scale | Agent share |
|---|---|---|---|
| ETHGlobal Cannes 2026 | Apr 3–5 | 800+ builders, 59 countries, $150K+ | Arc: 98% of its 69 teams agentic; 40% used nanopayments |
| Chainlink Convergence | winners Apr 6 | 3,000+ participants, 554 submissions | dedicated "Autonomous Agents" and "CRE & AI" categories |
| Colosseum Frontier (Solana) | Apr 6–May 11, winners Jun 26 | 10,000+ builders, 2,857 submissions, 26 winners | AI agents + prediction markets as themes |
| Arbitrum Open House London (online) | May 25–Jun 14 | 782 builders, 278 submissions, $85K | Agentic category on Arbitrum + Robinhood Chain ($15K) |
| Arbitrum Founder House London | Jul 10–12 | 140 builders, 64 projects, $300K | Best Agentic ($20K) + Robinhood Chain awards ($90K) |
| ETHGlobal New York 2026 | Jun 12–14 | 500+ devs, $225K+ | 3 of 10 finalists agent-related; 5+ ERC-8004 explorers |
| BNB Hack: AI Trading Agent Edition | Jun 3–21 | 317 builds, 550 hackers, $36K | 100% trading agents |
| ETHGlobal Lisbon 2026 | Jul 24–26 | $100K | 2 of 10 finalists agent-related |
| lablab AI Trading Agents (ERC-8004/Kraken) | Mar 30–Apr 12 | 2,752 participants, 107 submissions, $55K | 100% |
| The Synthesis (AI-judged, Ethereum) | 10 days, Mar/Apr | 1,500+ builders, 685 projects, 28 AI judges | 100% |
| SERV Hackathon Edition 01 (OpenServ) | Sep 14–28 | $5K, 4 tracks | 100%; creativity, user-readiness, revenue potential |
| Arbitrum Open House Singapore (online) | Sep 14–Oct 4 | $115K; "Promising Products" $15K for AI agents; one podium spot reserved for Robinhood Chain | live now. https://blog.arbitrum.foundation/open-house-singapore-applications-are-now-open/ |

## 2. Notable winners

### 2A. Robinhood Chain / Arbitrum Open House (most relevant)

| Project | Event / prize | What it does | Why it won | Stack | Alive? | Link |
|---|---|---|---|---|---|---|
| AlphaGrid | Founder House London Best Agentic 1st ($10K); Open House London online Agentic 2nd ($5K) | Decentralized prop-trading protocol: agents pay an entry fee, trade tokenized AAPL/NVDA/TSLA/SPY on Robinhood Chain under hard drawdown/leverage caps, graduate Challenge to Funded to Prime, earn 70–80% profit share | Only project that made "agents compete for capital under transparent onchain risk rules" concrete on Robinhood Chain; clear revenue (entry fees + carry) | MCP + REST agent onboarding, RH Chain testnet + Arbitrum Sepolia, tracks with 5%/12%/25% drawdown caps | Genesis Season "live" on testnet but leaderboard shows 0 agents; capital providers "coming soon" | https://alphagrid.capital/ ; https://blog.arbitrum.foundation/top-founders-take-home-300k-at-london-founder-house/ |
| Tilt Protocol | Open House NYC 1st ($15K); NYC Founder House Founder-in-Residence ($100K) | AI asset-management layer on Robinhood L2: managers plug a strategy in via API/Claude MCP/OpenClaw skill; protocol handles capital formation, settlement, automated 2/20 fees | Replaces prime-broker plumbing with contracts; explicit 2/20 revenue | RH L2 contracts, OpenClaw skill, MCP | Docs + skill repo exist; mainnet status unclear | https://docs.tiltprotocol.com/concepts/robinhood-l2 ; https://github.com/rontoTech/tilt-protocol-openclaw |
| Bond.Credit | NYC Founder House, Robinhood Chain Innovation Award ($50K) | Aggregates high-performing agents and allocates capital via standardized underwriting; every trade/rebalance feeds a "Bond Score" (performance .30, risk .25, stability .20, sentiment .15, provenance .10) | "Credit rating for agents" as the missing primitive for agent capital allocation | Onchain credit engine, vaults | Site live, "agentic alpha" | https://www.bond.credit/ ; https://blog.arbitrum.foundation/nyc-founder-house-concludes-with-340k-in-awards-to-winning-teams/ |
| Agama Finance | Founder House London, Robinhood Chain Innovation ($30K) | Turns tokenized stocks into self-compounding collateral via automated lending strategies (agYLD/sagYLD) | Stock tokens as productive collateral, not just tradeable | RWA lending pool | Site live | https://agama.finance/ |
| ReineiraOS | Open House London online Agentic 1st ($7K); Founder House London Best Agentic 3rd ($4K) | Accountability layer: agents reserve capital before each run; breach of predefined limits pays the user out and is recorded in agent history | "Agents that back their commitments with capital" was the judges' favorite framing | Arbitrum, FHE via Fhenix CoFHE | Sandbox only, "preview software", 48 funded runs | https://www.reineira.xyz/ ; https://x.com/arbitrum/status/2069113415348744568 |
| Pact Network | Open House London online Agentic 3rd ($3K) | Refund/chargeback layer for x402: agents pay a small premium, get refunded on failed API calls, reliability scores | Cheap, obvious, revenue from day one | Solana live; Base/Arc/Arbitrum "soon" | Private beta | https://www.pactnetwork.io/ |
| EqualFi / EqualIndex | Open House NYC 3rd ($5K); NYC Founder House 3rd ($20K) | Permissionless fully-backed basket tokens; 9 indices (6 stock-based) live on Robinhood Chain testnet | First real "index product" on the chain | ERC-20 baskets | Testnet live | https://www.hackquest.io/projects/Arbitrum-Open-House-NYC-Founder-House-EqualFi-RobinHood |
| CanHav Research | Founder House London Best Agentic 2nd ($6K) | Agentic DeFi with agent identities + encryption for private trading workflows | Privacy-for-agents angle | not published | unknown | same Arbitrum post |

Robinhood context: MCP launched May 27 (equities/options), crypto added Jul 20, Chain mainnet Jul 1, 190+ stock tokens as plain ERC-20s with Chainlink feeds and an onchain `uiMultiplier()` (ERC-8056). Stock tokens barred to US persons; Coinfello publicly showed agents can route around the front-end geo-block (Aug 3). Austin Starks' Jul 8 MCP review: 44 tools, no paper trading, no multi-leg options, no backtesting, no scheduling, OAuth broke in production. Olas deployed agents on the chain Sep 15 (Morpho ~7% USDG, perps, swaps).
https://robinhood.com/us/en/newsroom/robinhood-is-now-open-to-agents/ ; https://docs.robinhood.com/chain/stock-tokens/ ; https://news.bitcoin.com/crypto-news/robinhood-chain-ai-agents-stock-token-compliance-gap/ ; https://nexustrade.io/blog/robinhood-agentic-trading-mcp-review-20260708 ; https://cryptobriefing.com/olas-defi-products-robinhood-chain/

### 2B. ETHGlobal 2026

| Project | Event / prize | What it does | Why it won | Stack | Alive? | Link |
|---|---|---|---|---|---|---|
| maki | Cannes finalist + sponsor prize | AI agent for onchain DeFi; keys locked in hardware, unreachable by the model | Security-first agent beat feature-rich agents | hardware-locked signing | unknown | https://ethglobal.com/showcase?events=cannes2026 |
| ENShell | Cannes finalist; ENS "Best ENS Integration for AI Agents" | Policy layer validating every agent tx against ENS-resolved rules before signing; blocks prompt-injection trades | Agent safety as product | ENS, tx simulation | unknown | https://crypto.news/ai-agents-privacy-and-prediction-markets-define-ethglobal-cannes-2026-finalists/ |
| DIVE | Cannes finalist | Multi-agent oracle swarm cross-verifying real-world truth before prediction-market settlement | Redundant-feed idea applied to LLM oracles | multi-agent consensus + settlement contract | unknown | same |
| Corpus | Cannes finalist | Any product becomes an "agent corp": GTM, treasury, trading bots sharing protocol wallets; 8+ agents making hundreds of gas-free x402 payments | Real autonomous economic activity, not a chat UI | x402, shared wallets | unknown | same |
| VEIL VPN | Cannes finalist; Arc "Best Agentic Economy with Nanopayments" | Pay-per-use VPN with hardware attestation of no-logs; agents pay via Circle Nanopayments | Privacy infra + machine payments | TEE, Arc | unknown | https://www.arc.io/blog/meet-the-arc-track-winners-from-ethglobal-cannes-hackathon-and-what-we-learned |
| PayMate / C.E.S.T.A / NanoCrawl | Arc Cannes track winners | Credit pool with 4 agents paying each other; voice-first pooled USDC treasury bridged to virtual cards; agents paying publishers sub-cent per page | Agent-to-agent money a person can see | Circle Wallets, Arc, Nanopayments | unknown | same |
| Polyledger (PoC Innovation) | Cannes submission (prize unconfirmed) | Bull/Bear/Quant agent council proposes Polymarket trades; Ledger device app clear-signs market/outcome/price | Human-approval-on-hardware pattern | Chainlink CRE, Polygon CLOB, Ledger BOLOS | repo only | https://github.com/PoCInnovation/ethglobal2026 |
| The Wallet Shift | NYC finalist | "DeFiLlama for the agent economy": live agent-callable ERC-8004 directory | Infra for discovering agents | ERC-8004 | unknown | https://x.com/ETHGlobal/status/2066247812787081221 |
| Canary / Cumulant / Immunity | NYC finalists | Parametric insurance priced by prediction markets; structured products (tranches, PPNs) on prediction markets; onchain "immune system" for agents | Prediction markets as building blocks, not bets | Arc/Uniswap etc. | unknown | same |
| Shade / Pagga | NYC showcase | Trading bots invisible onchain; agents run a startup's payroll/treasury/compliance | Privacy for bots; boring back-office automation | not published | unknown | https://ethglobal.com/showcase?events=newyork2026 |
| Ethui Agentic Wallet, Glassbox402 | Lisbon finalists (Glassbox402 took 2 prizes) | Agent developer wallet/toolkit; x402 payment analytics | Tooling beat "agent that trades" (Leg Agent, Scipio Agent Vaults, Crosscheck got no prize icons) | x402 | unknown | https://www.bitget.com/news/detail/12560605546777 ; https://ethglobal.com/showcase?events=lisbon2026 |
| Versus / ArcFlow (HackMoney, Jan 30–Feb 11) | Arc track winners | Agents create content, earn micropayments, trade revenue-backed creator tokens; self-paying treasury yielding idle payroll before paying salaries | Arc: 97% of 155 submissions agentic; winners wrapped familiar workflows | Circle Wallets, Gateway, USDC | unknown | https://www.arc.io/blog/meet-the-arc-track-winners-from-the-hackmoney-2026-hackathon-and-what-we-learned |

### 2C. Chainlink Convergence (winners Apr 6, 554 submissions)

| Project | Prize | What it does | Why it won | Link |
|---|---|---|---|---|
| InControl | Autonomous Agents 1st | Portfolio-intelligence platform: CRE consensus verification + Confidential HTTP + x402 agent monetization | "Orchestration layer for agent-driven finance" | https://chain.link/blog/convergence-hackathon-winners |
| CRE Risk Router | Autonomous Agents 2nd | 8-logic-gate onchain risk evaluation with attestation before an agent's action executes | Auditability + governance | same |
| SentinelCRE | CRE & AI 1st | 24/7 DeFi protection agent: anomaly detection to preemptive guardian contracts | Rules-driven protection | same |
| FlowVault | DeFi 1st | Predictive vault ingesting cross-chain indicators (stablecoin spreads, funding rates) to move capital before repricing | Real signal engineering | same |
| TAPL / VeritasX / SSL | Prediction 1st / Privacy 2nd / Privacy 1st | BTC micro-volatility market; private prediction market with AI resolution; dark-pool RWA trading | Privacy + verifiable resolution | same |

### 2D. Solana

| Project | Event / prize | What it does | Why it won | Alive? | Link |
|---|---|---|---|---|---|
| Peaks | Colosseum Frontier top-25; Accelerator Cohort 5 | Consumer app: agents launch self-managing portfolios from a sector, personality or worldview | "Invest in any idea" UX | In accelerator | https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/ |
| Clawpump | Frontier top-25 ("agentic finance") | Agents with self-custody Solana wallets, 132 MCP tools: swaps, launches, perps, DCA, limits; agents earn creator fees (up to 75%) | Agents that earn, not just trade | Live; running its own $350K "AnsemHack" | https://www.clawpump.tech/ |
| Cesto / Senthos / Bench | Frontier top-25 | Thematic baskets mixing RWAs, prediction markets, perps; risk-stratified tranches of prediction-market flow; opportunity markets rewarding signals | Structured products over prediction markets | Cesto/Senthos in accelerator | same |
| YieldCompass | Frontier top-25 | Yield search engine with realized APY and transparent protocol risk scores | Honest numbers | unknown | same |
| ZAUTH | Pump.fun Build in Public, first $250K winner (Feb 18) | Trust infra for agents: stress-tests endpoints, pre-transaction validation, RepoScan for "AI slop" | Agents need to know which services are real | Token live (~$4.8M mcap) | https://zauthx402.com/ |

### 2E. Pure trading-agent hackathons

| Project | Event / prize | What it does | Why it won | Alive? | Link |
|---|---|---|---|---|---|
| Neural Alpha by ClipX | BNB Hack 1st ($10K) | BSC agent: CMC data via x402; RSI/MACD/Bollinger/EMA/momentum/Fear&Greed + news sentiment; Trust Wallet Agent Kit local signing; hard-coded 25% max drawdown, daily trade limits, honeypot checks, allowlist; live dashboard | Won on guardrails + live wallet, not on alpha | Team profile deleted on DoraHacks; wallet published | https://dorahacks.io/buidl/45790 |
| Gridora | BNB Hack 3rd ($4K) | Non-custodial grid agent with ERC-8004 soulbound identity, append-only TradeJournal, commit-then-attest StrategyLedger (strategy hash committed before trading) | "Proof, not promises": 38 journaled trades, 58% win rate, +18.77% PnL verifiable | Live; last trade 81 days ago | https://gridora.vercel.app/ |
| Guarded Alpha | BNB Hack 4th ($2K) | Risk-gated agent | same pattern | unknown | https://en.cryptonomist.ch/2026/07/08/bnb-hack-winners/ |
| AGOS / Zhentan / Strike / ShieldBot / ProceedGate / IBITI EPK | BNB OpenClaw "Good Vibes" ($100K across 10) | Agent-to-agent job marketplace in USDT; onchain behavioral assistant; Telegram prediction market on Pyth; tx interception; spending-limit monitor for runaway agents; per-action revocable approvals | 4 of 10 winners were DeFi-protection tools | mixed | https://blockchain.news/news/bnb-chain-openclaw-hackathon-awards-100k-ai-agent-projects |
| TradeAgents / TrustTrade AI | lablab Kraken/Surge, community top-3 | ERC-8004-verifiable trading agents | Claude was the most-used model (35 of 107) | unknown | https://lablab.ai/ai-hackathons/ai-trading-agents/live |
| Alpha Hunter / TradePilot / VegaGuard | Alpaca hackathon, community top-4 of 428 | Autonomous trading "scientist"; auditable options agent | judging pending | pending | https://lablab.ai/ai-hackathons/alpaca-ai-trading-agents-hackathon/live |

### 2F. x402 / agentic commerce

| Project | Event / prize | What it does | Alive? | Link |
|---|---|---|---|---|
| Moltbet | SKALE SF x402 overall 2nd + Virtuals track 1st (Feb) | Headless prediction market for agents: propose/counter bets, reputation, x402 gas-abstracted settlement | No live traction found | https://www.skale.space/blog/san-francisco-agentic-commerce-x402-hackathon-recap-winners |
| Legasi | Virtuals track 2nd | Credit lines + reputation for agents, yield on idle funds | unknown | same |
| World of Geneva / Superpage / Pincer / RequestTap | SF x402 overall 1st / Coinbase 1st / Coinbase 2nd / Google AP2 1st | Agents play an MMORPG; agent e-commerce rails; ad-subsidized 402 paywalls; open-source x402 router | unknown | same |
| AgentFabric | Cronos x402 top prize ($24K staged) | Programmable-permission capital transfer between agents | unknown | https://blockchainreporter.net/cronos-reveals-x402-ai-hackathon-winners-in-collaboration-with-crypto-com |
| SoulForge Market / DCA402 / Faktory / x402 Intent Firewall / Cronos Shield | Cronos x402 | Agent trading markets; x402-metered DCA; AI treasury for invoices + yield; sanity-check layer for payments; safeguard layer for agent tx | unknown | same |
| Cash Drive / AgentVault / Paystabl (2025) | Coinbase Agents in Action | x402+CDP wallet apps; autonomous trading vault; stablecoin payroll agent | – | https://www.coinbase.com/developer-platform/discover/launches/agents-in-action-winners |

### 2G. Prediction-market agents (benchmark, not a hackathon)

Polystrat (Olas, on Polymarket since Feb 2026): ~14,700 trades across 1,750 markets by Q1 close, 63% prediction accuracy, average total ROI −4.14%, 33–37% of agents profitable vs ~16% of humans. The "376% single-trade return" headline is one trade. Fleet-wide it is not break-even; OLAS staking rewards subsidize it. https://olas.network/blog/olas-q1-2026-roundup ; https://www.coindesk.com/tech/2026/03/15/ai-agents-are-quietly-rewriting-prediction-market-trading . SKALE launched AgentPit (Aug 14), a Polymarket-compatible sandbox for benchmarking prediction agents without capital; judges now expect backtests. https://www.skale.space/blog/agentpit-the-sandbox-for-ai-prediction-market-agents

### 2H. OpenServ / SERV

2025 hackathon (Feb 27–Mar 17, 2025, HackerEarth + Crossmint, ~100 agents): ASSUREFI 2nd + Community Choice (contract audit, liquidity monitoring, trust scores); Portfolio Sentinel 3rd (GOAT SDK + CoinGecko + DexScreener portfolio risk and rebalancing). 1st place not found. https://x.com/openservai/status/1904637308957319466

Current SERV Hackathon Edition 01 competitors already public:
- Alloc: watches an ETH/Base position, decides hold / stablecoin / tokenized stock on Robinhood Chain via SERV with confidence + rejection reasons; Relay + Uniswap v4 UniversalRouter on 4663; risk profiles; geo warning. https://github.com/veznidav/alloc
- ThoughtProof "RH X-cut": SERV proposes, ThoughtProof gates, RH Chain MCP executes only on ALLOW; demo tx 0.5 USDG to tokenized NVDA (Sep 16). https://github.com/ThoughtProof/demo-clips/releases/tag/serv-hackathon-rh-2026-09-16
- IntentLease: single-writer collision firewall; SERV output treated as untrusted proposal, hard ceilings on SEND/PAY/SIGN. https://github.com/woahwhattheheck/commons/issues/14566
- Ecosystem: arambarnett/robinhood-chain-mcp (tracking error vs Chainlink in bps, heat scores, 42 feeds); Hkshoonya/agentic-trader (shadow-first, evidence-gated, fixed pre-registered trend rule, LLM may only veto); masterledgerlive/robinhood-agent-plugin (paper-by-default, 20% daily drawdown halt, plain-text machine log).

## 3. Synthesis

### 3.1 Patterns that keep winning

1. Guardrails are the product. ENShell, maki, CRE Risk Router, SentinelCRE, ProceedGate, IBITI EPK, x402 Intent Firewall, Cronos Shield, Guarded Alpha, Neural Alpha's hard limits, Reineira, Pact. Same architecture everywhere: LLM proposes, deterministic policy gates, chain executes. ThoughtProof and IntentLease have already shipped this shape on SERV, so the shape alone will not differentiate.
2. Verifiable track record beats claimed alpha. Gridora (commit strategy hash, journal, attest), AlphaGrid (onchain fills), Bond.Credit (Bond Score), Synthesis winners (TEE-attested actions). Judges have stopped believing PnL screenshots.
3. Agents competing for capital. AlphaGrid, Bond.Credit, Tilt, Versus, Peaks, Clawpump. The prop-firm / manager-vault model gives instant revenue logic (entry fee, 2/20, carry) and is what both Robinhood Chain award rounds funded.
4. Agent-to-agent money that a human can watch. Arc's Cannes track: 98% agentic, 67% of winners on sub-cent payments.
5. Prediction markets as structured products or oracles, not bets. DIVE, Cumulant, Senthos, Canary, Bench, VeritasX. "LLM bets on Polymarket" is the losing version.
6. Boring TradFi workflow, invisible chain. ArcFlow, Pagga, Faktory, Kustodia ($60K NYC winner is escrow). Email onboarding, no gas UX.
7. Privacy for trading agents: Shade, SSL, CanHav, VeritasX.
8. Discipline over intelligence, with public evidence. Alpha Arena: Qwen +22%, GPT-5 −62%; Lobstar Wilde sent $441K on a sob-story tweet. https://pumpparade.medium.com/ai-trading-bots-lost-441k-in-one-error-heres-what-actually-works-and-what-doesn-t-4f04f890c189
9. Real transactions or nothing. Uniswap's track requires tx IDs; SKALE counted 275K onchain txs; Gridora shows 38 real trades; ThoughtProof posted a tx hash.

### 3.2 Oversaturated / what judges are tired of

- Generic "AI trading bot" = LLM + RSI/MACD. BNB Hack had 317; CMC gave ten of them $200 each.
- "Chat with your wallet" / natural-language swap. Robinhood's own MCP already does "buy $100 of X every 2% dip".
- x402 pay-per-call wrapper demos. Simon Brown's 8,200-project analysis: CDP funded 47.6% of all agent prizes; at general events agents now win at 0.54x (ETHOnline 2025) and 0.43x (New Delhi). https://simbro.medium.com/what-8-200-hackathon-projects-reveal-about-what-actually-wins-f105346ec97c
- Cross-chain swap clones (0.63x, worst bet in his dataset).
- ERC-8004 registry/explorer number N (six at NYC alone).
- "Marketplace where agents hire agents" (six in one quarter).
- Multi-LLM bull/bear/quant councils.
- Pure autonomy with no kill switch, sandbox or limits. Now a red flag.
- Deck-only "agent corps" with no tx hashes (Corpus, DIVE were finalists but no live trace found).

### 3.3 Gaps: valuable, rarely done well, where a reasoning agent beats a bot

1. Reasoning trail attached to every onchain action. Gridora commits a strategy hash; nobody commits the decision rationale, rejected alternatives and confidence, then attests outcome vs rationale. SERV already emits steps and rejection reasons (Alloc uses them in a UI only).
2. Compliance-aware execution on Robinhood Chain. Coinfello showed geo-blocks are front-end only. An agent that checks eligibility, surfaces disclosures, respects per-asset trading windows, and refuses ineligible flows is the "grown-up" build. No winner does this.
3. Tracking-error / premium-discount awareness on tokenized stocks. Mint/burn is AP-only, so this is entry-timing signal and risk flag, not free arb.
4. 24/7 vs market-hours asymmetry. Stock tokens trade around the clock on Uniswap/Rialto/Lighter; the brokerage closes. After-hours news, reposition onchain, explain why. Unique to this track; untouched.
5. Corporate actions. `uiMultiplier()` changes shares-per-token on splits/dividends. Most agents will silently misprice.
6. Shadow mode and evidence gate before live. Robinhood MCP has no paper trading. Earn the right to trade with a visible promotion rule.
7. Portfolio-level reasoning: concentration, drift to thesis, idle-cash yield (USDG in Morpho ~7%), multi-leg options composed with risk checks.
8. Revenue that is not "token". AlphaGrid (entry + carry), Tilt (2/20), Pact (premium), Peaks/Cesto (basket fees).

### 3.4 What would stand out for the Robinhood track

Simon Brown's data: the only positive-alpha setup left is "specialist sponsor + genuinely novel category before it crowds." Robinhood Chain mainnet is 11 weeks old, Arbitrum reserved podium spots for it, and only ~6 agent projects have won on it.

Already in front of these judges: Alloc, ThoughtProof, IntentLease. Do not ship a fourth propose-gate-execute demo with nothing else.

Ranked ideas:
1. "Funded desk with receipts": AlphaGrid's prop model + Gridora's commit-then-attest, where the attested artifact is the SERV reasoning trail hashed next to every Robinhood Chain fill. Users allocate USDG to an agent whose every decision is explainable and auditable; agent earns carry.
2. "Compliance-first stock-token agent" (B2B): policy engine any wallet/agent calls before touching stock tokens.
3. "Overnight desk": after-hours news, gap risk, reposition in tokenized stocks while markets are closed, explain the thesis with Chainlink fair value vs onchain premium.
4. "Thesis baskets that explain their drift": Peaks/Cesto UX on Robinhood Chain, agent rebalances to a stated worldview, idle USDG in Morpho. Fee on AUM.
5. "Earn-the-right-to-trade" for the Robinhood MCP: shadow, evidence gate, small live, promotion.

Hard requirements the winners share: real tx hashes on Robinhood Chain, a UI a non-dev can use, visible limits and kill switch, a fee line, no PnL claims without an onchain journal.

Other sources: https://ethglobal.com/events ; https://ethglobal.com/events/cannes2026/prizes ; https://solanacompass.com/news/colosseum-announces-26-winners-of-the-solana-frontier-hackathon-the-largest-crypto-hackathon-ever ; https://devfolio.co/blog/synthesis/ ; https://robinhood.com/us/en/support/articles/agentic-trading-overview/ ; https://genfinity.io/2026/07/21/robinhood-agentic-trading-crypto-ai-agents/ ; https://egamers.io/arbitrum-launches-115k-buildathon-reserving-a-podium-spot-for-robinhood-chain-builders/
