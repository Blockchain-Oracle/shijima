# Shijima demo video: plan and script

Status: plan, 26 Sep 2026. Abu records it; about **3:00**, screen-led, his voice.
For: SERV Hackathon Edition 01 (OpenServ). Tracks: Mainnet & MCP, Open, AgentKit. Judged on creativity,
user-readiness, revenue potential. Submission closes **Mon 28 Sep 2026, 00:00 UTC** (Sunday 8pm New York).

**The site address, in one place.** Every `{SITE}` below means this. Change it here if the domain changes.

```
SITE = https://rvqdneldfqkhjtywhlzlqnn1.84.46.247.92.sslip.io
```

On screen and out loud, don't read the sslip address. Say "link's below" and show it on the end card.

---

## 1. The idea

It's the weekend. Wall Street is shut, but Stock Tokens on Robinhood Chain are still trading, and nobody is
watching their basket at 3am. Abu shows that in ten seconds, then shows the answer: your own AI agent that keeps
your basket on plan through those hours. We watch someone set one up in four steps, then open a real decision it
made on mainnet with real money: what it saw, the four choices it weighed, why it picked one, and a fingerprint on
the chain that your own browser can check. Then the three things a judge wants to see: it runs on OpenServ and
SERV does the thinking, it can never take your money out (we tried, the chain said no), and it makes money through
copy trading (creator 80, Shijima 20). It ends on the live numbers and the link. Record it this weekend, so
"Wall Street is closed right now" is literally true.

---

## 2. Timed outline

Card words are what Abu reads before a take, not what he says.

| Time | On screen | Abu (card words) |
|---|---|---|
| 0:00–0:15 | Google "NVDA stock": *Closed*. Cut to `{SITE}/markets`: Nvidia priced "5m ago", on a Saturday. | **First line (memorised).** · "who's watching at 3am?" |
| 0:15–0:25 | `{SITE}/home` hero: "Wall Street closes. Your agent doesn't." Slow scroll to the three screens. | "so I built Shijima" · your own AI agent |
| 0:25–0:55 | `{SITE}/agents/new`: Strategy → Amount → Limits → Review (Live chosen, fee check ✓). Quick cut to Bridge "In", then the Free $1 card. | "$100 on The giants" · "limits live in your account" · "bring it from Base" · "free $1, first people" |
| 0:55–1:35 | `{SITE}/agents/showcase` latest decision, "Reasoned with SERV". Open decision #22. Scroll: what it saw → options weighed → limits check → Proof → **Check it** → "It matches." Blockscout tab. | "real money, mainnet" · "four choices" · "AI picks the timing, maths does the limits" · "check it yourself" |
| 1:35–1:55 | `{SITE}/status` row "started by OpenServ". OpenServ platform: agent 4513, workflow "Hourly desk review" runs. 3 s of `{SITE}/compare`. | "lives on OpenServ" · "wakes it every hour" · "SERV does the thinking" |
| 1:55–2:15 | `{SITE}/withdraw` "To your wallet only." Blockscout: the operator's withdraw, **reverted**. | "it can never take your money out" · "we tried" |
| 2:15–2:32 | Phone: Telegram @ShijimaBot, a trade message and the pinned status. Back on desktop: ⌘J Ask Shijima, "pause it for the weekend", the confirm card. | "Telegram tells you" · "or just ask it" · "nothing happens till you say yes" |
| 2:32–2:48 | Copy dialog on an agent: "One-time copy fee · $0.80 to the creator · $0.20 to Shijima". `{SITE}/live` Revenue section. | "copy someone's agent" · "80 / 20" · "trading is free" |
| 2:48–3:00 | `{SITE}/live` counts and the latest transactions (incl. a Friday 5:25pm buy). End card: logo, motto, the link. | **Last line (memorised).** |

---

## 3. What to say

The method (from Abu's own research in `chain-jam/docs/marketing/demo-video.md`): memorise only the first and the
last line. Everything in between is a few card words, said your own way. Talk to one friend, not "everyone".
One idea per sentence. Words you'd use with friends. Never explain what it isn't.

The "could come out like" lines are examples only. Don't learn them. If your mouth wants other words, use those.
Together they come to about 400 words, which is 3:00 at a calm pace.

### First line (memorise)

> **"Wall Street closes at four, and all weekend. My stocks on Robinhood Chain don't."**

### The middle, as cards

Record one card at a time (see §5). Each card is one short take.

**Card 1 · the problem**
`who's watching at 3am?`
- Could come out like: "They trade all night. Right now it's Saturday, and Nvidia's price is still moving. So who's
  watching my basket at three in the morning? Nobody."

**Card 2 · the answer**
`so I built Shijima · your own AI agent`
- Could come out like: "So I built Shijima. You get your own AI agent, and it keeps your stock basket on plan while
  New York sleeps."

**Card 3 · setting one up**
`$100 on The giants · limits live in your account`
- Could come out like: "Pick a strategy. Say a hundred dollars on The giants. It buys about fourteen dollars of each
  stock and keeps sixteen as cash. Then you set the most it can spend in a trade and in a day. That goes into your
  own account on the chain, so the agent can't go past it."

**Card 4 · getting money in**
`bring it from Base · free $1, first people`
- Could come out like: "No USDG yet? Bring USDC over from Base in one step. And the first people who sign up get a
  dollar free to try it."
- Only say the free dollar if the card still shows "1 left" or "2 left" on the day. If it says all gone, drop it.

**Card 5 · a real decision**
`real money, mainnet · four choices`
- Could come out like: "This one's live on mainnet with real money. Here's a decision it made. Nvidia was way under
  its target. It had four choices: do it now, do part of it, wait for New York to open, or don't. It said now,
  seventy-four percent sure, and it tells you why, and why not the others."

**Card 6 · who decides what**
`AI picks the timing · maths does the limits`
- Could come out like: "That's SERV reasoning. But the AI only picks the timing. It never picks what you own or how
  much. The limits check is plain maths, and it can say no."

**Card 7 · proof**
`check it yourself`
- Could come out like: "Every decision gets a fingerprint on the chain, in the same transaction as the trade. Press
  Check it and your own browser checks it. It matches. You don't have to trust me."

**Card 8 · OpenServ**
`lives on OpenServ · wakes it every hour · SERV thinks`
- Could come out like: "The agent lives on OpenServ. Every hour an OpenServ workflow wakes it up. Today's noon check
  was started by OpenServ. And SERV does the thinking. Here's the same question with and without SERV."

**Card 9 · the promise**
`it can never take your money out · we tried`
- Could come out like: "The one thing it can never do is take your money out. Only you can, and only to your own
  wallet. We tried it on mainnet with the agent's own key. The chain said no."

**Card 10 · talking to it**
`Telegram tells you · or just ask it · nothing till you say yes`
- Could come out like: "When it does something, it tells you on Telegram. Or you just ask it. 'Pause it for the
  weekend.' It shows you a card, and nothing happens until you say yes."

**Card 11 · money**
`copy someone's agent · 80 / 20 · trading is free`
- Could come out like: "See an agent you like? Copy it. Yours makes the same moves with your own money. The creator
  sets a small one-time fee. They keep eighty percent, we keep twenty. Trading itself is free."
- Optional, only if there's time: "Later there's a small yearly fee, half a percent. It's off during the beta."

### Last line (memorise)

> **"It's live right now. Link's below. Wall Street closes. Your agent doesn't."**

### What the old reference video teaches (tone and pace only)

The reference (`youtu.be/21d_5TiDnqg`, "VeChain AI Terminal", 8:34) has no captions on YouTube, so it was
transcribed locally with whisper. Keep: it opens on a question the viewer has felt, it says "this is real, this is
live" and then proves it on the block explorer, and it ends on a short line that repeats the tagline. Leave behind:
it runs 8½ minutes, spends half of it on the roadmap and setup steps, and says what it's *not*. This one is 3 minutes,
has no roadmap, and proves things instead of listing them.

---

## 4. Capture list

### Get ready first (once)

- [ ] **Record on Saturday or Sunday**, so "Wall Street is closed right now" is true, and say the real day.
- [ ] **Chrome, clean profile**, window 1920×1080 (or 1440×900), page zoom 110–125% so text reads at 1080p. Dark
      theme (Robin Neon on black). Bookmarks bar hidden. macOS Focus on, so no notifications.
- [ ] **Two browser windows:**
  - **A, signed in** with your own wallet and your own agent (probably the "Weekend Agent" on `/live`; any agent you own works). Used for the create
    flow, withdraw, Ask Shijima and settings.
  - **B, signed out** (or a second Chrome profile). Used for the landing, the showcase, the decision page and the
    copy dialog, because you can't copy your own agent.
- [ ] **Turn on copying with a fee**, so the dialog shows the 80/20 split. In window A: your agent → Settings →
      **Sharing** tab → "Others can copy it", fee **$1**, Save. Then in window B open that agent and press
      **Copy this agent**. It should read "$0.80 to the creator · $0.20 to Shijima". (The showcase is owned by the
      dev wallet, so it's easier to use your own agent here.) This makes your agent public; that's fine for the demo.
- [ ] **Telegram on your phone**, linked (Settings → Connections), with the chat of @ShijimaBot open. A real trade message
      should be in it (the Weekend Agent's Friday 5:25pm buys, if that agent is yours). Phone on Do Not Disturb, iOS screen recording ready.
- [ ] **OpenServ** signed in, in a tab: `https://platform.openserv.ai/agents/4513`, and your workspace's
      "Hourly desk review" workflow with its run history.
- [ ] **Blockscout tabs** preloaded:
  - the decision's trade: `https://robinhoodchain.blockscout.com/tx/0x0384d7636143c86344217ac6d279b60e9d9418b5864052a1c3b605c591481e4b`
  - the operator's withdraw that reverted: `https://robinhoodchain.blockscout.com/tx/0x96cad9fe012236fcf12e81d3695b310a40b9424b1705594e5adb75e68dd2ad59`
- [ ] **Check the free $1 card** in window A (Wallet page). Note if it says "1 left", "2 left" or all gone.
- [ ] **Wallet for the create flow:** a little USDG and ETH on Robinhood Chain in window A's wallet, so the Review
      step shows the fee check with a ✓. You don't have to create anything: stop at Review.
- [ ] Load every page once before recording, so nothing is cold and slow.

### Shots, in order

Record each shot as its own clip, 5–20 s, with a second or two of stillness at the start and end.

| # | Window | Route / URL | What to do | What must be on screen |
|---|---|---|---|---|
| 1 | B | `google.com/search?q=NVDA+stock` | Just hold. | "Closed" (Friday 4:00 PM close) |
| 2 | B | `{SITE}/markets` | Scroll to the ten Stock Tokens. Hover Nvidia. | Nvidia priced "5m ago", today's day, market clock "Reopens in…" |
| 3 | B | `{SITE}/home` | Hold on the hero, then scroll slowly to the three screens (web, phone, Telegram). | "Wall Street closes. Your agent doesn't." |
| 4 | A | `{SITE}/agents/new` | **Strategy:** search or tap **The giants**. | The strategy grid, The giants picked |
| 5 | A | same | **Amount:** type an amount (the doc's $100 is a spoken example; any small amount is fine). | "In your wallet" and the amount |
| 6 | A | same | **Limits:** drag "Per trade" and "Per day". | "Written into your agent's account. It cannot go past these." |
| 7 | A | same | **Review:** show "It starts: Live", the network fee line "You have … ✓". **Don't press Create.** | Live selected, fee check ✓ |
| 8 | A | `{SITE}/bridge` | Tap **In**, pick Base and USDC, toggle **USDG / ETH** once. Don't send. | "Into your wallet, from another network" |
| 9 | A | `{SITE}/wallet` | Hold on the **Free $1 to try** card. Don't claim it. | "Free $1 to try", "N left" |
| 10 | B | `{SITE}/agents/showcase` | Hold on the Latest decision. Move the pointer to **Reasoned with SERV**. | "Buy $0.94 of NVDA", "74% sure", "Reasoned with SERV", "Live on mainnet" |
| 11 | B | `{SITE}/agents/showcase/decision/22` | Scroll slowly: 03 What it saw → 04 The options it weighed → 05 The limits check. | The four options, "chosen" / "turned down", "This part is plain arithmetic, not an assistant" |
| 12 | B | same, section 08 Proof | Press **Check it**. Wait for the result. | "It matches." |
| 13 | B | Blockscout tx `0x0384d763…` | Hold on "Success" and the Desk contract. | A real mainnet trade |
| 14 | B | `{SITE}/status` | Hold on the OpenServ row. | "the … New York check was started by OpenServ · agent 4513"; SERV Reasoning row |
| 15 | – | OpenServ platform | Agent 4513 page, then the "Hourly desk review" workflow's runs. | Shijima on OpenServ, recent hourly runs |
| 16 | B | `{SITE}/compare` | Hold, one situation, both columns. | "The model on its own" vs "Through SERV Reasoning" |
| 17 | A | `{SITE}/withdraw` | Hold. | "To your wallet only. The agent's contract pays its owner and nobody else" |
| 18 | B | Blockscout tx `0x96cad9fe…` | Hold on the red status. | Reverted |
| 19 | phone | Telegram @ShijimaBot | Scroll to a "bought" message, then up to the pinned status. | A real trade message, the pinned status |
| 20 | A | any app page, press ⌘J | Type "pause it for the weekend", send. Show the card. **Don't confirm.** | The confirm card |
| 21 | B | your agent, **Copy this agent** | Open the dialog. | "One-time copy fee · $1 · $0.80 to the creator · $0.20 to Shijima" |
| 22 | B | `{SITE}/live` | Scroll: counts → latest transactions → Revenue. | "Live on mainnet", confirmed trades, SERV calls, OpenServ runs, the Friday 17:25 ET buys, the 80/20 line |
| 23 | – | End card (made in edit) | – | Shijima mark, "Wall Street closes. Your agent doesn't.", the link |

**Nothing in this list sends money.** The create flow stops at Review, the bridge stops before Review, the gift is
not claimed, the chat card is not confirmed. If you want a real "created" moment, do it yourself with $1 and use the
success card as an extra 2 s shot; it isn't needed.

**Fallbacks.** If "Check it" can't reach the network on the day, it says so and gives the transaction link: use the
Blockscout shot (13) instead. If OpenServ's platform page is slow, shot 14 (`/status`) already proves OpenServ
started the check.

---

## 5. Pacing, cuts, music, and what to leave out

### Recording your voice
1. Say a friend's name before each take ("Okay, Tunde…"). It turns it into talking. Cut it in the edit.
2. First take sloppy, like you're telling him while making tea. It often gives the best lines.
3. **One card per take**, 5–15 s. Three takes per card, then move on. Take two usually beats take seven.
4. Leave small stumbles in. They sound like a person.
5. Mic close, quiet room. Face camera is optional; if you use one, only for the first and last line.

### Pace
- About 140–150 words a minute. That's calm. Pause when something happens on screen and let it land.
- Hold every proof on screen long enough to read: "It matches.", "Reverted", the 80/20 line, the four options.
  About 2 s each.
- Something should move on screen by 0:05, and the product should be doing something by 0:25.

### Cuts
- Hard cuts. No wipes, no spinning transitions.
- Speed up any wait (page loads, "Check it" thinking) and put a small "2×" or "sped up" label on it.
- Zoom in only on small things that matter: "Reasoned with SERV", "74% sure", the fee split.
- Captions burned in, big, bottom third. Many people watch muted.

### Music
- One quiet, late-night track (lo-fi or ambient) under the whole thing, low under the voice.
- One small sound when the landing hero appears (0:15). Nothing else.
- Music comes up only on the end card.

### Leave out
- MCP. The Mainnet track counts because the agent acts on Robinhood Chain.
- Jargon: basis points, keccak, hash chains, EIP-1167, contract versions, "session key", "mandate".
- Performance claims. The agent header shows "0 of 4 timing calls beat the alternative". That's the honest
  grading; don't zoom in on it and don't talk about returns. It never predicts prices.
- The loss stop as an on-chain limit. Only the per-trade and per-day limits and owner-only withdraw are in the
  contract. Say those.
- "First" or "only" claims. Roadmap. Reels, rooms, takes, price alerts, the states gallery, the Safe idea.
- Practice mode. Agents start live now (DECISIONS R8); no need to explain the other mode.
- Any private data: wallet balances you don't want shown, other Telegram chats, the `.env`.

### What's true, so nothing is overclaimed

| Said in the video | Why it's true |
|---|---|
| Live on mainnet with real money | Robinhood Chain 4663; `/live` shows 2 agents trading real money and confirmed trades on Blockscout |
| Stock Tokens trade nights and weekends | `/markets` prices every 5 minutes on a Saturday against Friday's close |
| The AI only picks the timing | SERV answers one question: now, in part, wait for the open, or not at all (`packages/core`) |
| Limits live in your account | `Desk.sol` enforces per-action and daily caps on chain |
| It can never take your money out | `Desk.sol` withdraw is owner-only; the operator's real withdraw on mainnet reverted (`0x96cad9fe…`) |
| Fingerprint in the same transaction, check it yourself | Decision #22's page: "written on the public network in the same transaction as the action"; Check it runs in the browser |
| On OpenServ, hourly workflow wakes it, SERV thinks | Agent 4513, workflow "Hourly desk review"; `/status` names the check OpenServ started; ERC-8004 identity 95396 on Base |
| Trades sign through Coinbase AgentKit | Worker signs with AgentKit's wallet provider (`apps/worker/src/agentkit.ts`); on screen only in the landing's "Built on" row, so no need to say it |
| Free $1 for the first people | Gift wallet capped at 2 claims (`GIFT_CAP=2`); the card shows how many are left |
| Copy fee: creator 80, Shijima 20; trading free | Copy dialog and `/live` Revenue; the 0.5% yearly fee is shown on the agent page as waived during the beta |
