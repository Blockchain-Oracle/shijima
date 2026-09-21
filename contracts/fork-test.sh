#!/usr/bin/env bash
# Runs the fork tests against live Robinhood Chain state.
#   ./fork-test.sh                 every fork test, at the current head block
#   ./fork-test.sh --match-test X  any extra forge flags are passed through
#   BLOCK=67734481 ./fork-test.sh  reuse a block. Foundry caches its storage, so reruns take seconds.
#
# The block is always pinned. With Alchemy (an archive node) a pinned block stays valid for ever and its
# storage is cached on disk. Without a key this falls back to the public RPC, which is slow, rate limited
# and forgets state after about ten minutes, so expect timeouts and rerun with the same BLOCK.
set -euo pipefail
cd "$(dirname "$0")"
[ -f ../.env ] && { set -a; . ../.env; set +a; }

if [ -n "${ALCHEMY_KEY:-}" ]; then
  URL="https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}"
else
  URL="https://rpc.mainnet.chain.robinhood.com"
  echo "No ALCHEMY_KEY in .env. Using the public RPC. This will be slow." >&2
fi

BLOCK="${BLOCK:-$(cast block-number --rpc-url "$URL")}"
echo "fork block ${BLOCK}  (rerun fast with: BLOCK=${BLOCK} ./fork-test.sh)"
# The key must never reach a log or a terminal scrollback.
forge test --match-path 'test/fork/*' --fork-url "$URL" --fork-block-number "$BLOCK" \
  --fork-retries 8 --fork-retry-backoff 1500 "$@" 2>&1 | sed "s#${ALCHEMY_KEY:-__none__}#<key>#g"
