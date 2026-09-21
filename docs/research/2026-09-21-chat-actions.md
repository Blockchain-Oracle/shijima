# Chat that gets things done: how each request maps onto the desk

21 Sep 2026. Abu's direction: Shijima is a chat app. You talk to your AI and it gets things done: it rebalances,
it switches strategy. A **strategy is a basket of stocks** with target weights, like Glider's "The Mag Seven".
This note maps every kind of request onto code that already exists, and names what is missing. Read from
source.

## The rule that makes it safe

The chat model never holds a key and never signs. It can only **propose** one of a fixed set of typed actions.
Each proposal is shown as a card, and the owner confirms it. Only then does the proposal run, through the same
guarded path the website and Telegram already use. Those paths re-check ownership against the signed-in session.
Anything that moves the owner's own money, or changes a limit the chain enforces, is a transaction **the owner
signs in their wallet**. The five promises stay true exactly as written: the assistant cannot send money anywhere
but to the owner, and the chain holds the limits.

Records, headlines and prices are data the model reads, never instructions it follows. Its output is checked
against a schema before anything is shown.

## Request by request

| The owner says | What happens | Path that exists today | New | Who signs |
|---|---|---|---|---|
| "Why did you wait on Saturday?" / "How am I doing?" | Answer from the record and the valuation, naming the records used | Record and value queries (`packages/db/src/queries/public.ts`, `records.ts`); SERV client (`core/serv/client`) | The chat endpoint, with read-only tools | nobody |
| "Move me into The Mag Seven" | Card: current mix → new mix, the trades it implies, their rough cost, and the fact that the desk moves there over its next checks within your limits. Confirm applies a new mandate version. | `applyMandate` (`packages/db/src/queries/mandates.ts`), which supersedes the old version; the engine reads the current mandate each check | `via: 'chat'` on the actor; the card | nobody (off-chain), unless a stock is not yet allowed on-chain, when the owner signs `allowToken` |
| "Rebalance now" | Card with the desk's own view first: act now or wait, with its reasons. **Check now** runs a check at once. | Wake trigger `manual` already runs immediately (`packages/db/src/schema/enums.ts`, `apps/worker/src/review.ts`) | A small request row that the web writes and the worker's 15-second timer picks up. The web still never sends anything. | nobody |
| "Do it anyway" (after the desk says wait) | An owner-instructed trade that still passes every limit and the price band, recorded plainly as the owner's timing call, not the desk's | The record already has an `override: { by, reason }` field and the decision page shows it in plain words (`shared/schemas/record.ts`) | An owner-override path through the gate | nobody: the operator trades inside the caps |
| "Pause" / "Resume" | Instant, recorded | `pauseDesk`, `resumeDesk` (`packages/db/src/queries/engine.ts`) | `via: 'chat'` | nobody |
| "Ask me first" / "Go live" / "Act on your own" | Mode change. The go-live rule is enforced on the server. Pending approvals are cancelled, as today. | `setDeskMode` (`engine.ts`) | `via: 'chat'` | nobody |
| "Approve" / "Reject" | Same as the Telegram buttons | `answerApproval` (`engine.ts`) | none | nobody |
| "Never add to Tesla before earnings" | A new mandate version with the note | `applyMandate` stores `notes` | **The engine never reads notes today** (see below) | nobody |
| "Lower my daily limit to $200" | Off-chain limits apply at once. On-chain caps need a transaction. | `applyMandate`; `Desk.setLimits` | Card with a prepared transaction | the owner, for on-chain caps |
| "Withdraw $200" / "Sell everything to cash" / "Remove the assistant" | Card with the amount and cost, then the wallet asks | `Desk.withdraw`, `Desk.batch`, `revokeOperator` | Prepared transactions in the card | the owner |
| "Add $500" | Opens Add money | Relay bridge planned (brief 8.5) | The page itself | the owner |

## Gaps found while mapping

1. **Mandate notes never reach the model.** `notes` is in the mandate schema (`shared/schemas/mandate.ts`) and
   the table (`db/schema/desks.ts`), but nothing in `packages/core` reads it. The brief's promise that the desk
   follows "notes in your own words" (8.6) and reads them back (8.7) is not wired. It matters twice over now,
   because the chat is how owners will give instructions.
2. **No way for the web to ask for a check now.** `manual` exists as a trigger, but only the command line uses it.
3. **No `chat` channel** on the actor type (`via: 'web' | 'telegram' | 'chain' | 'worker'`).
4. **No owner-override trade path.** Needed only if "do it anyway" is allowed. The record already has a place
   for it.

## One product question for plan mode

The desk's promise was "it decides only *when*". If the owner can say "do it now" against the desk's advice, the
owner decides *when* that time. My view: allow it. Show the desk's view first. Record it as the owner's call,
and keep every limit in force. The Monday grading then honestly compares the owner's call too.
