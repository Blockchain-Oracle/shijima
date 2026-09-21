# Design brief: the Desk

For a designer. Written in plain language on purpose. It covers everything the product does, every
screen, every message, and every awkward state. It says nothing about colours, type, or visual style.
Those are yours to decide.

Working name: **the Desk**. The name is not final.

*Revised 19 September after the technical research. Changes: the honest worst-case wording in 8.3, the
"money first" order in 8.4, the headline rule in 8.11, one new awkward state in 8.16, "close the desk" in
8.18, and two new public pages, 8.21 and 8.22.*

---

## 1. What this is, in one minute

People outside the United States can now own US stocks as digital tokens, called **Stock Tokens**, on a
new network called **Robinhood Chain**. You buy them with a digital dollar called **USDG**.

Here is the odd part. The US stock market is open about 32 hours a week. Stock Tokens trade all 168
hours. On weekends the real market is shut, but Stock Tokens keep changing hands and their prices keep
moving, sometimes by 2 or 3 percent. Nobody is watching your holdings during that time. Your broker is
closed. You are asleep.

**The Desk is an assistant that looks after your Stock Tokens during those hours.** You tell it what
you want to own and what your limits are. It checks on things every hour. Most of the time it finds
nothing to do, and it says so. When something does need doing, it decides whether to do it now, do
part of it, wait until the market reopens, or refuse. Every time, it writes down what it saw, what it
chose, what it chose not to do, and how sure it was. On Monday it looks back and marks its own
decisions against what actually happened.

It does not pick stocks. It does not predict prices. It never promises profit. It keeps your portfolio
the way you asked, carefully, and it shows its work.

## 2. Who it is for

Someone who already owns some crypto, lives outside the US, and wants to own US stocks without opening
a US brokerage account. Picture a person in Lagos, Nairobi, Manila or São Paulo who holds digital
dollars and wants some Nvidia and some S&P 500.

- They have a crypto wallet already, usually on their phone. MetaMask, Rabby, or Robinhood Wallet.
- They are comfortable with crypto basics. They are **not** finance professionals.
- They will use this mostly on a phone. Telegram is already on that phone.
- They start small. Think $20 to $2,000.
- Their biggest fear is simple: "Will this thing lose or steal my money while I am not looking?"

**The whole design has one job: make a careful person feel safe handing over a small amount of money
overnight.** Calm, honest and specific beats exciting. This must not look or feel like a trading app, a
casino, or a crypto "degen" tool.

## 3. The five promises

Everything on every screen should support one of these. They are the product.

1. **It is your account.** The money sits in an account that belongs to you. The assistant can trade
   inside it. It cannot send your money anywhere else. Only you can take money out.
2. **It stays inside your limits.** You set the most it can spend per action and per day, what it may
   buy, and the loss at which everything stops. The network itself enforces the spending limits, not
   just our software.
3. **It always explains itself.** Every decision has a reason, the options it turned down, how
   confident it was, and the facts it used. This includes every time it decided to do nothing.
4. **The record cannot be quietly changed.** A fingerprint of each decision is written to the public
   network at the moment of the trade. Anyone can check that the record shown today is the one made
   then.
5. **You can stop it at any moment.** Pause, take everything out, or remove the assistant, each in one
   action.

## 4. Words we use

| Word | What it means to the user |
|---|---|
| **Desk** | Your account plus the assistant looking after it. One person, one desk. |
| **Stock Token** | A digital token that follows the price of a real US stock or fund. Always write "Stock Tokens". **Never write "tokenized stocks".** This is a legal requirement from the issuer. |
| **USDG** | A digital US dollar. The cash inside the desk. |
| **Mandate** | Your instructions: what to hold, in what proportions, and your limits. |
| **Check** | One wake-up. The desk looks at everything and decides. Happens about once an hour. |
| **Decision** | The result of a check. Always recorded, even when the result is "nothing to do". |
| **Reference price** | The last trusted official price. On weekends it is old, and we always show how old. Write "last official update" with its time. **Do not call it "last close"**, because it often is not. |
| **Above / below reference** | How far today's trading price is from the reference price, as a percent. Under half a percent we simply say "in line". |
| **Shadow mode** | Practice mode. The desk does everything for real except spend money. It records what it would have done. |
| **Multiplier** | When a company pays a dividend or splits its stock, you do not receive cash or extra tokens. Instead each token quietly becomes worth a little more of a share. The multiplier is that number. |
| **Company event** | A dividend, a stock split, or similar. It changes the multiplier and can pause trading in that token. |

**Words to avoid everywhere:** profit promises, "guaranteed", "beat the market", "alpha", "signals",
"snipe", "ape", "degen", rocket emojis. Say "value" rather than "gains" where you can.

## 5. Where the product lives

Two places. Same desk, two doors.

1. **A website.** Works well on a phone and on a computer. This is where you set things up, read the
   record, and change anything important.
2. **Telegram.** The desk's voice. It tells you what it did, asks permission when it needs it, and keeps
   one always-current status message. You can pause and resume from there.

There is no separate mobile app.

---

## 6. The journey, start to finish

1. **Arrive** at the public home page. Understand what this is in ten seconds. Optionally open a real,
   live desk in read-only mode to see what the record looks like.
2. **Connect a wallet** and sign a message to prove it is yours. This costs nothing.
3. **Read and accept the plain-language disclosure.** What Stock Tokens are, who may not hold them, the
   risks.
4. **Create your desk.** One confirmation in the wallet. A tiny network fee.
5. **Put money in.** Either USDG you already have, or bring dollars from another network in one step.
6. **Write your mandate.** Start from a preset or build your own. Set your limits. Add notes in your own
   words.
7. **The desk reads your instructions back to you** in its own words, and asks about anything unclear.
   You confirm.
8. **Connect Telegram.**
9. **The desk starts in shadow mode.** It checks every hour and records what it would have done. It
   spends nothing. A visible rule shows when it can go live.
10. **Go live.** First in "ask me first" mode. Later, if you choose, "act on your own within my limits".
11. **Live with it.** Telegram tells you when something happens. The website holds the full record.
12. **Monday.** The desk reports how each weekend decision looks now that the market has reopened.
13. **Change your mind at any time.** Edit the mandate, pause, withdraw some or all, or remove the
    assistant entirely.

---

## 7. The three modes

The desk is always in exactly one. The current mode must be visible at all times, on the website and in
Telegram.

| Mode | What the desk does | Who it is for |
|---|---|---|
| **Shadow** | Checks and decides for real. Spends nothing. Records "I would have…". | Everyone starts here. |
| **Ask first** | When it wants to act, it asks you. You approve or reject in Telegram or on the website. If you do not answer by the stated time, the request expires and that is recorded too. | The default once live. |
| **On its own** | Acts without asking, inside your limits. Still asks when an action is unusually large. | Turned on by the owner, deliberately. |

**Going from Shadow to live is earned, and the rule is visible from day one.** For example: "The desk
can go live after 24 checks in shadow mode and after you have opened its report." Design a progress
indicator for this and a "Go live" control that is locked until the rule is met.

Separately from the mode, the desk has a **state**: Active, Paused by you, Stopped by your loss limit,
or Needs attention.

---

## 8. Website: every screen

### 8.1 Public home page
- What it is, in one or two sentences.
- The weekend fact: the market is shut most of the week, Stock Tokens are not. Real numbers can be
  shown, for example "On the weekend of 12 September, Nvidia's token moved about 3.6% between Friday's close
  and Monday's open."
- How it works in three or four steps.
- The five promises.
- "See a real desk": opens a live desk in read-only mode. No wallet needed.
- What it costs. See 8.17.
- Who may not use it, stated plainly, before they connect.
- Connect wallet button.

### 8.2 Connect and sign in
- Pick a wallet. Approve the connection. Sign one message. No cost.
- If the wallet is on the wrong network: a clear prompt to switch to Robinhood Chain, with a one-tap
  "add this network" for wallets that do not know it yet.

### 8.3 Disclosure, shown once and always available later
Plain language, short sections, one acceptance at the end. It must cover:
- A Stock Token is a debt note from a company in Jersey that follows a stock's price. It is not the
  share itself. No voting rights. If the issuer fails you could lose everything.
- People in the US, UK, Canada, Switzerland and some other places may not hold them. The user confirms
  they are not in one of those places.
- Prices on weekends and at night can differ from the next official opening price.
- Outside market hours there are fewer buyers and sellers, so prices are worse and large orders cost
  more.
- Trading in a token can be paused without warning, for example around a company event.
- Dividends are not paid in cash. They raise the multiplier. After that, one token is no longer exactly
  one share.
- What the assistant can do and cannot do. See the five promises.
- The assistant uses an AI model to make judgments. It can be wrong. Your limits apply no matter what it
  decides.
- **The honest worst case, in these words or close to them:** "The assistant cannot send your funds to
  anyone. If its key were ever stolen, the thief could only make bad trades, costing at most 8% of your
  daily limit per day, until you remove the assistant. You are told about every trade."
- If a weekend price moves more than 8% away from the last official update, the assistant's trades are
  refused by your account. You can still sell yourself.
- The company that issues Stock Tokens can pause a token, block an address, or cancel tokens. No product
  can change that.

### 8.4 Create your desk
- One short explanation: "This creates an account that belongs to you. Only you can take money out."
- One wallet confirmation. Show the tiny network fee.
- States: waiting for wallet, waiting for the network, done, failed with the reason.
- The user needs a very small amount of ETH on Robinhood Chain to pay network fees for their own
  actions. **If they have none, the order flips: they bring money in first (8.5), which also sends
  about $1 of ETH to their wallet, and then they create the desk.** The desk's address is known in
  advance, so the money can be sent to it before it exists. Design both orders as one flow.
- The assistant pays the network fees for everything it does. The owner pays only for their own rare
  actions: creating the desk, changing on-chain limits, withdrawing, removing the assistant.

### 8.5 Put money in
Two paths, side by side:
- **"I have USDG on Robinhood Chain."** Enter an amount, confirm in the wallet.
- **"Bring dollars from another network."** Choose where from: Base, Arbitrum, Ethereum or BNB Chain.
  Enter an amount. Show clearly, before confirming: you send this, you receive this, the fee, and how
  long it takes, which is usually seconds.
- Minimum about $20. Explain why: below that, fixed fees eat too much.
- Progress while money is on its way. A clear result. A clear failure message with what to do next.
- This same screen is reused later as "Add money".

### 8.6 Write your mandate
- **Start from a preset or from scratch.** Two or three presets, for example "Broad market" with S&P 500
  and Nasdaq funds, "Big tech", and "Mostly cash". Nobody should face an empty form.
- **What to hold.** Pick from a short approved list of about ten Stock Tokens. Each shows its name, its
  ticker, and a small note on how easily it trades. Give each a target percent. Cash is also a line. The
  total must be 100.
- **How strict.** How far a holding may wander from its target before the desk considers acting.
- **Limits.** Each with a one-line explanation and a sensible default:
  - The most any single holding may be, as a percent of the desk.
  - The most the desk may spend in one action.
  - The most the desk may spend in one day.
  - The loss at which everything stops. If the desk's value falls this far, it stops acting and tells
    you.
  - The size above which it must ask you even in "On its own" mode.
- **Notes in your own words.** A free text box, with examples: "Do not add to Tesla in the week before
  its earnings." "If Nvidia falls more than 3% over a weekend, cut it by half." "Prefer waiting for
  Monday unless something is clearly wrong."
- Show which settings are enforced by the network itself. Changing those later needs a wallet
  confirmation. The others save instantly.

### 8.7 "Here is how I understood you"
- The desk restates the whole mandate in plain sentences, including how it read the notes.
- If something is missing or unclear, it asks a specific question here. It will not start until
  answered.
- Confirm, or go back and edit.

### 8.8 Connect Telegram
- A button and a QR code that open our Telegram bot with a one-time code.
- Shows "Connected as @name" once done. Can be disconnected later.
- It can be skipped, with a plain warning: without Telegram, approvals only happen on the website.

### 8.9 Desk home
The screen people see most. It should answer, in order: **Is everything okay? What is it doing? What do
I have?**

- **Status.** Mode. State. Which market session it is right now and when that changes, for example
  "US market closed. Reopens Monday 9:30 New York time, in 1 day 4 hours." Last check time and its
  result in a few words. Next check time.
- **Anything needing you.** Pending approval requests with a countdown, and Approve and Reject right
  there. Warnings. See 8.16.
- **Total value** of the desk, and how it has changed since you started and since the last market
  reopen. No celebration, no alarm. Just numbers.
- **Holdings.** For each: name, amount, value, its share of the desk next to its target share, the
  current trading price, the reference price and how old it is, and "above", "below" or "in line" with
  the percent. Small flags where relevant: trading paused, price unavailable, company event coming,
  multiplier is not 1.
- **Cash.** USDG in the desk. Idle cash is parked in a savings vault that earns interest, currently
  about 3.6% a year and variable. Show amount parked, the current rate, and interest earned so far.
  Never show 7%. One line of small print: taking cash out of the vault depends on how much the vault has
  available at that moment.
- **Limits in use.** Spent today against the daily limit. The per-action limit. How far the desk's value
  is from the stop-everything loss limit.
- **Recent decisions.** The last few, one line each, leading to the full record.
- **Main controls.** Pause or resume. Add money. Withdraw. Change mode. Edit mandate.
- **Shadow mode progress** while it applies.
- **Fee line.** See 8.17.

### 8.10 The record, a list of every decision
This is the product's signature screen.

- Every check produces one entry. Newest first.
- Each entry: time, outcome, the token involved if any, the amount if any, a one-line reason, and
  whether it was shadow or live.
- **Outcomes to design for:**
  - Acted
  - Acted in part
  - Waited, meaning "there is something to do, but not now"
  - Declined, meaning "I will not do this", for example a paused token
  - Nothing to do
  - Blocked by a limit
  - Asked you, then: approved, rejected, or expired without an answer
  - Failed, with the named cause
  - Would have acted, in shadow mode
- **The design problem to solve:** most entries are "nothing to do". An hourly desk makes about 160 of
  them a week. They must be present, because they are proof the desk was awake and honest. But they
  must not bury the few entries that matter. Consider grouping runs of quiet checks, such as "14 checks,
  nothing to do, Saturday 02:00 to 15:00", which can be opened.
- Filters: outcome, token, dates, shadow or live.

### 8.11 One decision, in full
The most important single page. A user, or a judge, should be able to read it top to bottom and think
"I understand exactly why it did that."

1. **The decision.** What it decided, when, in which mode, and how confident it was.
2. **Why it looked.** A holding drifted, new cash arrived, one of your notes applied, a company event is
   coming, or a routine hourly check.
3. **What it saw.** The facts at that moment:
   - Market session.
   - The token's trading price. The reference price and its age. How far apart they are.
   - How much it would cost to trade your size right now.
   - Whether trading in the token was paused or its price feed was unavailable.
   - Any company event, pending or recent.
   - Recent headlines about that company: at most the three the assistant actually relied on, each
     with source, time and link. On the read-only public view, show source, time and link only, never
     the headline text. This is a licensing rule, not a style choice.
   - Your balances and how much of each limit was left.
4. **The options it weighed.** Usually three or four: do it now, do part now, wait for the reopen,
   decline. The chosen one is marked. Each rejected one carries the reason it was turned down.
5. **The limits check.** Each of your rules with a pass or a block. This part is plain arithmetic, not
   AI, and the page should make that difference felt.
6. **The cost, shown before acting.** Price, the trading fee, the expected effect of your order on the
   price, the network fee, what you should receive, and the least it would accept.
7. **What happened.** A link to the transaction. What was actually received against what was expected.
   Or, if it failed, the specific cause and what happens next.
8. **If you were asked.** Who answered, when, and where: Telegram or website.
9. **Proof.** The record's fingerprint, where it was written on the public network, and a "Check it"
   button that recalculates the fingerprint in front of the user and shows that it matches. Also
   "Download this record".
10. **How it looks now.** Appears once the market has reopened. Plain words: "Waiting was the better
    choice by 1.4%" or "Acting on Sunday would have been better by 0.6%." Neutral in tone both ways. This
    grades the decision. It is not a profit boast.

### 8.12 The weekend report
- One per weekend, ready on Monday after the market opens.
- Every decision from that weekend with its "how it looks now" verdict.
- An honest summary line, for example "5 decisions. 3 turned out better than the alternative, 1 worse,
  1 no real difference."
- The quiet checks counted: "41 checks found nothing to do."
- A list of past reports.

### 8.13 One holding, in detail
- Price now, reference price and age, the gap between them.
- Market session information.
- **Multiplier now, and its history** as a small table: date, what happened, from what to what. One
  plain sentence: "One token currently stands for 1.0008 shares."
- **Company event banner** when one is coming: what, when, what it means for this token, and that
  trading may pause around it.
- What it costs to trade your size right now.
- The desk's past decisions about this token.
- A short legal reminder of what the token is.

### 8.14 Mandate and safety
- The current mandate, readable as sentences, with Edit.
- Editing leads back through "Here is how I understood you". Changes apply from the next check.
- The mode switch, with a clear confirmation when turning on "On its own".
- The approved token list.
- **Emergency controls, each one action with one confirmation:**
  - **Pause.** The desk stops acting. Nothing is sold.
  - **Sell everything to cash.** Every holding becomes USDG. Show the cost first.
  - **Remove the assistant.** It loses all access immediately. Your money stays in your account.
  - **Withdraw.** See next.

### 8.15 Withdraw
- Some or all.
- Choice: "sell holdings to cash first" or "send me the tokens as they are".
- Money only ever goes to the owner's own wallet. Show that address. It cannot be changed here.
- Show costs first. If the savings vault is short of available cash at that moment, say so plainly and
  offer to withdraw what is available now.
- Progress and result, with links.

### 8.16 Warnings and awkward states
Design each of these. They are where trust is won or lost.

| Situation | What the user must understand |
|---|---|
| Desk paused by you | Nothing will happen until you resume. |
| Stopped by your loss limit | It stopped itself because of your rule. Here is the number. Here is how to restart. |
| The desk has not checked in on time | "Last check was 3 hours ago. Your money is safe in your account and cannot move without the assistant." |
| Trading paused in a token | The desk will not touch it, and why. |
| Price has moved more than 8% from the last official update | "The assistant cannot trade this right now. Only you can sell." With the owner's own sell control right there. |
| Price feed unavailable for a token | Same. |
| Company event coming | What, when, and what changes for you. |
| A holding's value jumped with no trade | Explain the multiplier change. |
| Your holdings changed outside the desk | "Your balance is different from what the desk expected. It has updated its picture." |
| Approval waiting | With time left. |
| Approval expired | It did not act. Recorded. |
| An action failed | The specific cause, in words, and the next step. Never "Something went wrong". |
| Not enough ETH for your own network fees | How to get a little. |
| Wallet on the wrong network | Switch. |
| Money on its way in | Progress. |
| Telegram not connected | What you are missing. |
| Savings vault short of cash | Partial withdrawal offered. |
| Network or data trouble on our side | Honest and specific. The desk does not act on facts it cannot verify. |
| Empty desk, no money yet | What to do next. |
| Brand-new desk, no decisions yet | When the first check will happen. |

### 8.17 The fee
- A small yearly percentage of what the desk holds. Shown as 0.5% a year. **Waived during the beta.**
- Shadow mode is always free.
- Show it building up honestly: "Fee so far: $0.03, waived."
- No fee per trade, and say why in one line: a desk that is paid per trade is paid to trade too much.

### 8.18 Settings
Telegram connection, including disconnect. Share a read-only link to this desk, on or off. Re-read the
disclosure. **Close the desk:** one confirmation that sells or returns everything, sends it to the
owner's wallet, removes the assistant and stops all checks. The record stays readable afterwards.

### 8.19 Read-only desk view
The desk home, the record and the single decision pages, with every control removed and a clear
"You are viewing someone else's desk" marker. Used for "See a real desk" on the home page and for shared
links.

### 8.20 "With and without reasoning", a demonstration page
For competition judges and curious users. Pick one of a few saved tricky situations, for example an old
reference price combined with a company event coming. Run the same situation two ways, side by side:
a plain AI model, and the reasoning engine the desk actually uses. Show both decisions and both
explanations so the difference is visible. Simple two-column layout. Not part of the owner's daily
flow.

### 8.21 "How the desk decides", a public page
The rules, published in plain words, so nobody has to trust a black box. The order of every check: look
at what you hold, look at the market, work out by arithmetic whether anything needs doing, refuse
anything a hard rule forbids, ask the reasoning engine only about timing, run the limits again, then
act, ask, or record. State plainly which steps are arithmetic and which one is AI judgment. State what
the desk never does: pick stocks, predict prices, chase or fade weekend moves.

### 8.22 "Withdraw without our website", a public page
Short, calm, step by step. If our website ever disappears, the owner's money is still in the owner's
account on the public network. This page shows how to take it out using only the public block explorer.
It exists to make promise 1 believable. Link it from the home page, the disclosure and settings.

---

## 9. Telegram: every message

Telegram messages are short text with a few buttons. Design the wording, the order of information, and
what each button says. Tone: a calm, competent colleague. Short sentences. Numbers where they matter.
No hype, no emojis as decoration. A small, consistent set of marker symbols is fine.

### 9.1 The status message
**One message, pinned, edited in place at every check. It never sends a notification.** It is the answer
to "is it awake, and is everything fine?"

Example:
> **Desk: Ask first · Active**
> Last check 03:00. Nothing to do.
> Nvidia in line with reference. Apple in line. S&P 500 0.6% above.
> Value $1,204.10. Cash parked $310.00.
> Spent today $0 of $200.
> Next check 04:00. US market reopens in 1d 6h.

### 9.2 "I need your approval"
What it wants to do, why, the main option it turned down, confidence, cost, and when the request
expires. Buttons: **Approve**, **Reject**, **See details**, which opens the decision page. After an
answer, the same message updates to show the outcome.

Example:
> **Approval needed · expires 05:00**
> Buy $120 of Nvidia.
> Why: Nvidia is 4% under your target, and its price is in line with the reference. No news explains a
> move. Trading cost is low right now.
> Turned down: waiting for Monday. Nothing suggests Monday will be cheaper.
> Confidence: fairly high.
> Cost: about $0.13.

### 9.3 "I did this", in On its own mode
Same content, past tense, with a link to the transaction and to the decision page.

### 9.4 "This one is large, so I am asking"
Same as 9.2, with the reason it is asking: it is above your large-action size.

### 9.5 "I would have", in Shadow mode
Only for would-be actions. Quiet checks stay in the status message.

### 9.6 "I chose not to act, and you should know"
Only for the notable ones: waiting when a holding is well off target, or declining because trading is
paused. Routine "nothing to do" never sends a message.

### 9.7 Alerts
Each is short and specific:
- Your loss limit was reached. The desk has stopped.
- A company event is coming for a token you hold.
- A holding's value changed because of a company event, with the explanation.
- Trading is paused in a token you hold.
- An action failed, with the cause and what happens next.
- Your approval request expired. Nothing was done.
- Your holdings changed outside the desk.
- Money arrived. Withdrawal complete.
- The desk was paused or resumed, and from where.

### 9.8 The Monday report
A short summary of the weekend report with a link to the full page.

### 9.9 First contact
A welcome after connecting: what this chat will and will not do, and the commands.

### 9.10 Commands
`/status` `/pause` `/resume` `/help`. Pausing from Telegram must be instant, and its confirmation message
must be unmistakable.

---

## 10. Things the design must never do

- Never suggest the desk will make money or beat anything.
- Never hide a decision, a cost, or a failure.
- Never show a price without saying where it comes from and how old it is.
- Never show an old price as if it were current.
- Never use casino or trading-floor energy: flashing numbers, confetti, leaderboards, streaks.
- Never say "tokenized stocks".
- Never blur the difference between what the AI judged and what the hard limits enforced.

## 11. Not in the first version

So you can leave room for them without designing them now: choosing how often reports arrive, quiet
hours, price alerts, deeper performance statistics, a calendar of daily results, sharing a single
decision as a card, a public track record page, export for taxes, asking the desk questions in chat,
more than one desk per person, other assistants paying to ask the desk a question, a history of
mandate versions, and sending withdrawn money straight to another network.

**Never planned:** copying other traders, leaderboards, referral rewards, memecoins, borrowing, a token
of our own, card payments, voice.

## 12. What is fixed and what is yours

**Fixed:** the five promises, the three modes, the vocabulary in section 4, everything listed under
each screen and message, the legal wording requirement, and honesty about price age and sources.

**Yours:** everything visual, the layout, the navigation, how screens are grouped or merged, how the
record handles hundreds of quiet entries, how confidence is shown, how "above or below reference" is
shown, what the desk's personality feels like in Telegram, and the name if you have a better one.
