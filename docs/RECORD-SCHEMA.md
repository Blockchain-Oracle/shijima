# The decision record, version 1

Frozen 2026-09-20. The machine-readable form is `packages/shared/src/schemas/record.ts`. A body that does not
match it is refused before it is hashed. To change the shape, add version 2. Never edit version 1: records
already fixed on-chain were made with it.

## What a record is

Every check of a desk writes at least one record, including "nothing to do". A record is a JSON object. Its
fingerprint is written on-chain in the same transaction as the trade it describes, or in a later checkpoint.
After that nobody can change the record without the change being visible, including us.

## How to check one yourself, without our code

1. Take the record body exactly as downloaded.
2. Serialise it as canonical JSON (RFC 8785): keys sorted, no whitespace. There are no floats in a record, so
   Python's `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)` gives the same bytes.
3. Hash those bytes with keccak256. With Foundry: `cast keccak "$(cat canonical.json)"`.
4. Compare with the `decisionHash` in the desk contract's `Bought`, `Sold`, `Swept`, `Redeemed` or `Checkpoint`
   event.

A record that was not an action has no transaction of its own. Each record holds `prevHash`, the fingerprint of
the record before it, so the records form a chain. Walk forward from your record to the next one that IS on-chain.
That fingerprint commits to every record behind it, yours included.

## Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | `1` for this shape. Version 2 records say `2`; see below. |
| `chainId`, `desk` | Which desk this belongs to. They are inside the hash, so a fingerprint fits exactly one desk. |
| `seq`, `prevHash` | Position in this desk's record, gap free from 1, and the fingerprint of the record before. |
| `chain` | The contract's own counter and head when this was decided. The contract counts on-chain actions only. |
| `decidedAt`, `wake` | When it was decided, which scheduled check it belongs to, and what triggered that check. |
| `mode` | `shadow`, `ask_first` or `on_its_own`. |
| `mandate` | The mandate version in force and its fingerprint, so the record commits to the exact instructions. |
| `valuation` | What the desk was worth, valued on the pool's 30 minute average, with each holding's share and target. |
| `need` | Why arithmetic looked at this token: how far it had drifted, and the threshold it had to pass. |
| `candidate` | The action arithmetic proposed. The model never proposes one and never sets a size. |
| `deferral` | A remembered earlier decision that this record continues or ends, with the reason it ended. |
| `blockers` | Rules decided by code that stopped this before any model call, each with its name. |
| `evidence` | Exactly what the model was shown. It may cite only these ids. Headlines appear as hashes, never text. |
| `serv` | The model call: prompt version, model, latency, and its answer word for word. `null` if it was not asked. |
| `gate` | The limits check. Plain arithmetic. What would count against the limits, and the contract's own floor. |
| `override` | A developer's forced test trade (`by: 'developer'`), or the owner's own "do it anyway" from the chat (`by: 'owner'`, version 2). |
| `outcome` | What the desk decided. `ask` says why it asked, when it did. |
| `preview` | What would be sent: amount in, expected out, the least it would accept, and the deadline. |

A field that does not apply is `null`, never missing. Amounts are decimal strings. Basis points, counts and
seconds are integers.

## Version 2 (20 to 22 Sep), beside version 1

Version 2 keeps every version 1 field and changes these. Every widening is optional or additive, so every
record already fixed on-chain still parses.

- `kind` may be `execution`: what the desk did after the owner approved a request. It carries `approvalOf`
  (`decisionSeq`, `askedBecause`, `answeredAt`, `answeredVia`, `movedBps`). `approvalOf` is optional: sixteen
  real records were written before it existed.
- The `price` evidence item records the pool's own price and half-hour average, the reference (`last_regular_close`
  or `last_official_update`) with its price and time, the gap to it, and the last official update separately.
  The `cost` item is measured for the exact trade (`costBps`), not a table figure.
- `candidate.side` may be `sweep` or `redeem` (savings-vault moves, below).
- An `event` evidence item (22 Sep) names a company event near the token: `eventKind`, `eventDate`, `timing`,
  `daysAway`. Only the date, never the news text.
- `need.rule` (22 Sep) names the owner's standing rule that raised a protective need, when one did.
- `override.by` may be `owner`.

## Savings-vault moves (version 2, widened 22 Sep)

A record whose `candidate.side` is `sweep` or `redeem` moved cash into or out of the savings vault (Steakhouse
USDG on Morpho). No model is asked, so `serv` is `null` and `need` is `null`. `evidence` holds one `vault` item:
the rate and the cash that could be taken out (both from Morpho's API), what a deposit and a later withdrawal cost
in network fees, and the cash the desk keeps for its own buys. `gate.countedUsdg` is `0`, because a vault move
does not count against the owner's limits, exactly as the contract does not count it. A sweep's `amountIn` is
USDG and its `expectedOut` is vault shares; a redeem is the other way round.

## Not in the hash

`result` (the transaction, what was really received, the checks) is added after the fact and is not hashed.
`private` holds what only the owner may see, such as headline text, which our news licence forbids passing on.
