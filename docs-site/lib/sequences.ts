import type { Sequence } from './diagram-types';

export const sequences = {
  wake: {
    kicker: 'Sequence',
    title: 'One wake, start to finish',
    subtitle: 'What happens each time your agent looks. Most looks stop at step 5 with nothing to do.',
    note: 'Steps 1 to 5 and 9 are arithmetic or fixed rules. Step 7 is the only AI call, and it only chooses the timing. The record is saved and hashed before the transaction is signed, so a crash can never lose a trade.',
    actors: [
      { id: 'clock', label: 'Clock', sub: 'OpenServ or timer', logo: 'openserv' },
      { id: 'worker', label: 'Worker', sub: 'the engine' },
      { id: 'chain', label: 'Chain', sub: 'your Desk · pools', logo: 'robinhood' },
      { id: 'serv', label: 'SERV', sub: 'Reasoning', logo: 'openserv' },
      { id: 'db', label: 'Postgres', sub: 'the record' },
      { id: 'telegram', label: 'Telegram', sub: 'you', logo: 'telegram' },
    ],
    steps: [
      { from: 'clock', to: 'worker', label: 'wake: hourly task or 5-minute watch' },
      { from: 'worker', to: 'worker', label: 'settle any earlier send first' },
      { from: 'worker', to: 'chain', label: 'reconcile: balances, limits, seq' },
      { from: 'worker', to: 'chain', label: 'value on each pool’s 30-min average' },
      { from: 'worker', to: 'worker', label: 'needs: drift past tolerance?' },
      { from: 'worker', to: 'worker', label: 'pre-gate: halted, feed, band, list' },
      { from: 'worker', to: 'serv', label: 'one question: when?' },
      { from: 'serv', to: 'worker', label: 'now · in part · wait · decline', kind: 'reply' },
      { from: 'worker', to: 'worker', label: 'gate: your limits, the contract’s sums' },
      { from: 'worker', to: 'db', label: 'record hashed, send planned' },
      { from: 'worker', to: 'chain', label: 'trade carrying the decision hash' },
      { from: 'chain', to: 'worker', label: 'receipt and event', kind: 'reply' },
      { from: 'worker', to: 'db', label: 'result appended' },
      { from: 'worker', to: 'telegram', label: 'status edited · “I did this”' },
    ],
    frames: [{ label: 'only when a need passes', first: 5, last: 12 }],
  },

  send: {
    kicker: 'Sequence',
    title: 'The write-ahead send',
    subtitle: 'Every transaction is saved before it is broadcast, so a restart always knows what might be in flight.',
    note: 'If the process dies after step 4, the next start finds the receipt and settles it. If it dies before, the deadline in the transaction decides: once the chain’s clock passes it with no receipt, the send is marked never landed and the nonce is reused.',
    actors: [
      { id: 'engine', label: 'Engine', sub: 'a decision to act' },
      { id: 'sender', label: 'Sender', sub: 'operator key' },
      { id: 'db', label: 'Postgres', sub: 'actions table' },
      { id: 'chain', label: 'Chain', sub: 'your Desk', logo: 'robinhood' },
    ],
    steps: [
      { from: 'engine', to: 'db', label: 'record + action: planned' },
      { from: 'sender', to: 'chain', label: 'simulate, read nonce, check gas' },
      { from: 'sender', to: 'db', label: 'signed hash + nonce: prepared' },
      { from: 'sender', to: 'chain', label: 'broadcast' },
      { from: 'sender', to: 'db', label: 'sent' },
      { from: 'chain', to: 'sender', label: 'receipt', kind: 'reply' },
      { from: 'sender', to: 'db', label: 'confirmed or reverted, result appended' },
    ],
  },
} satisfies Record<string, Sequence>;

export type SequenceName = keyof typeof sequences;
