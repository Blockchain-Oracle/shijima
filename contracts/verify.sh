#!/usr/bin/env bash
# Publishes the contract source so anyone can read it. Safe to rerun.
#   ./verify.sh v0
# Uses Sourcify, which supports chain 4663 and which Blockscout imports verified sources from. Blockscout's own
# API is not used: it sits behind a Cloudflare bot check that answers scripts with a page of HTML.
set -uo pipefail
cd "$(dirname "$0")"
LABEL="${1:-v0}"
read -r FACTORY IMPL < <(python3 - "$LABEL" <<'PY'
import json, sys
d = json.load(open('../packages/chain/deployments.json'))[sys.argv[1]]
print(d['factory'], d['implementation'])
PY
)
for target in "$FACTORY src/DeskFactory.sol:DeskFactory" "$IMPL src/Desk.sol:Desk"; do
  set -- $target
  printf "%-12s %s  " "${2##*:}" "$1"
  forge verify-contract "$1" "$2" --chain-id 4663 --verifier sourcify 2>&1 | tr -d '\r' \
    | grep -iE "already verified|successfully verified|verified|fail|error" | tail -1 | cut -c1-120 || echo "no answer"
done
echo "read the source at https://repo.sourcify.dev/4663/$IMPL"
