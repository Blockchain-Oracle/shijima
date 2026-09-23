# Fidelity: Shijima on Abu's wallet reference (round 4)

Pinned reference: `Blockchain-Oracle/zk-freighter` at `859d95f`, local copy `/Users/abu/dev/hackathon/stellar-zk-wallet`.
Its live site was down (521), so the repository is the authority. Plan: `PLAN-ROUND-4.md`. Decisions: W1–W13 in
`DECISIONS.md`. Code never carries the reference's name; its parts live under `kit`.

**Authority, when sources disagree:** Abu's messages of 23 Sep, then the standing rules (the web app holds no
keys, withdraw always pays the owner, not a trading place), then the reference's code, then our existing app.

**Allowed deviations, all from Abu:** Shijima's light and dark colours; wallet connection instead of seed phrases;
one app on phones instead of a separate phone app.

## Ledger

| Reference | Source | Shijima, now | Status |
|---|---|---|---|
| Canvas and framed panel | `apps/web/src/App.tsx:161-162`, `packages/ui/src/theme.tsx:60-72` | `styles/kit/shell.css` (`.kit-canvas`, `.kit-frame`), `components/shell/app/AppShell.tsx` | Exact, green glows |
| Sidebar, icon rail below 1100px | `WalletShell.tsx:104-137` | `components/shell/app/AppSidebar.tsx` | Exact, labels adapted |
| Home title row with Synced and Sync | `HomeScreen.tsx:186-199` | `features/wallet/WalletHome.tsx` | Exact |
| Shielded card with flip | `HomeScreen.tsx:48-97`, `cards.tsx` | Your agents card (`components/kit/cards.tsx`) | Adapted: agents instead of a shielded pool |
| Crossing strip | `HomeScreen.tsx:99-111` | Fund · Withdraw · Bridge strip | Adapted |
| Public card | `HomeScreen.tsx:117-144` | Your wallet card, every token priced | Adapted |
| Actions, three activity rows | `HomeScreen.tsx:216-232` | `/wallet` | Exact |
| Phone home: swipe rail, dots, four actions | `apps/mobile/src/MobileHome.tsx:84-116` | `/wallet` below 768px | Exact |
| Receive with QR | `ReceiveScreen.tsx`, `qr.tsx` | `/receive`, wallet and agent tabs | Exact |
| Scan to pay | `MobileScan.tsx` | Scan on `/send` (`features/money/ScanButton.tsx`) | Adapted: browser QR reader, paste when missing |
| Shield / Unshield flow and its run | `ShieldScreen.tsx:187-292`, `ProofRun.tsx` | `/fund`, `/withdraw`, `features/money/MoveFlow.tsx`, five endings | Adapted |
| Send | `SendScreen.tsx` | `/send` | Adapted: public only, nothing is private on this chain |
| Bridge, two panels | `BridgeScreen.tsx:190-269` | `/bridge`: out, in (through Fund), Get gas | Adapted |
| Test faucet | `EvmFundButton.tsx` | the free $1 | Adapted |
| Activity | `ActivityScreen.tsx:58-135` | `/activity` | Exact row anatomy |
| Disclosure and evidence tools | `DisclosureScreen.tsx`, `DemoEvidencePanel.tsx` | `/evidence`: facts, decisions, money moves, copy all; Check it on each decision | Adapted |
| Settings groups | `SettingsScreen.tsx` | `/settings` per W10 | Exact structure |
| Network and appearance rows | `SettingsScreen.tsx:92-96` | none | Excluded: mainnet only; theme stays in the shell (Abu) |
| Private engine reset | `SettingsScreen.tsx:111-121` | none | Excluded: no local prover |
| "Hackathon software" warning | `SettingsScreen.tsx:138-140` | "Real money, on mainnet" | Adapted |
| Confidential tokens | `ConfidentialScreen.tsx` | none | Excluded: a Stellar-only system |
| Onboarding slides | `packages/ui/src/onboarding.tsx` | our first-run tutorial | Adapted |
| Create, import, password, passkey, unlock | `OnboardingFlow.tsx`, `AccessPanels.tsx` | access card with Connect wallet (`features/money/SignedOutCard.tsx`) | Adapted (Abu: wallet connection) |
| Intro sound | `intro.tsx` | none | Excluded |
| Auto-shield banner | `AutoShieldBanner.tsx` | Needs-you banner on `/wallet` | Adapted |
| PhoneGate | `PhoneGate.tsx` | none | Excluded (Abu: one app) |
| Phone chrome, sheets, drag, pull to refresh, haptics | `MobileChrome.tsx`, `MobileSheetOverlay.tsx`, `mobile-gestures.ts` | `AppShell.tsx` tabs and More sheet, `components/kit/sheet.tsx`, `components/kit/gestures.ts` | Adapted: haptics through the browser's vibrate call |
| Route animation, reduced motion | reference CSS | `styles/kit/tokens.css`, `styles/kit/shell.css` | Exact |
| Landing sections and reveal | `apps/landing/src/*` | `features/home/landing/`, W12 order | Exact structure, our copy |
| Docs site order | `apps/docs/content/docs/meta.json` | `/docs` adds Evidence, When something goes wrong, Glossary | Adapted |
| Extension, native builds | `apps/extension`, native mobile | none | Excluded |

## Beyond the reference

Fund from any token (swap, as-is Stock Tokens, Relay), Withdraw one stock, Get gas, money moves recorded so
charts count performance net of money in and out, the agent page's Cash · Savings · Stocks · Total strip, Scan.

## Open

- **Licence.** The reference's tree has no licence file at `859d95f`. Abu owns it and asked for its code to be
  reused; `THIRD_PARTY_NOTICES.md` records that, and infers no licence.
- **Creating an agent** keeps its own Relay step (W13): its money moves before the agent is recorded.
