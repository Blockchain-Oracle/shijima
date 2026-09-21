#!/usr/bin/env bash
# Deploys DeskFactory to Robinhood Chain mainnet and records the addresses.
#   ./deploy.sh v0        label the deployment (v0 = throwaway dev deploy, v1 = the frozen one)
#
# --slow waits for each receipt. The 200% gas estimate multiplier is there because estimates on an Arbitrum
# stack include an L1 data component that moves between estimate and execution. 300% was tried first, but the
# node checks gas limit times max fee up front, and 300% demanded about $2.85 of ETH for a deploy that costs $1.
# Keys come from ../.env and must never reach a log, so all output is filtered.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ../.env; set +a
LABEL="${1:-v0}"
# RPC_URL and DEPLOYMENTS_FILE let the deploy be rehearsed on a local fork without touching real state.
URL="${RPC_URL:-https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}}"
OUT_FILE="${DEPLOYMENTS_FILE:-../packages/chain/deployments.json}"
hide() { sed -e "s#${ALCHEMY_KEY}#<key>#g" -e "s#${DEPLOYER_PRIVATE_KEY}#<private-key>#g"; }

forge build --sizes 2>&1 | hide | grep -E "Desk|DeskFactory|Contract" || true

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast --slow \
  --gas-estimate-multiplier 200 2>&1 | hide | tee /tmp/desk-deploy.log | grep -E "DeskFactory|Desk implementation|Error|error|ONCHAIN EXECUTION|Paid|Hash" || true

FACTORY=$(grep -E "^\s*DeskFactory " /tmp/desk-deploy.log | awk '{print $2}' | tail -1)
IMPL=$(grep -E "Desk implementation " /tmp/desk-deploy.log | awk '{print $3}' | tail -1)
rm -f /tmp/desk-deploy.log
[ -n "$FACTORY" ] || { echo "deploy failed: no factory address in the output"; exit 1; }

# Confirm there is really code there before recording anything.
CODE=$(cast code "$FACTORY" --rpc-url "$URL" | wc -c)
[ "$CODE" -gt 10 ] || { echo "deploy failed: no code at $FACTORY"; exit 1; }

python3 - "$LABEL" "$FACTORY" "$IMPL" "$OUT_FILE" <<'PY'
import json, sys, os, datetime
label, factory, impl, p = sys.argv[1:5]
d = json.load(open(p)) if os.path.exists(p) else {}
d[label] = {"chainId": 4663, "factory": factory, "implementation": impl,
            "deployedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
d["current"] = label
json.dump(d, open(p, 'w'), indent=2); open(p, 'a').write('\n')
print(f"recorded {label}: factory {factory}, implementation {impl}")
PY

[ -n "${RPC_URL:-}" ] && { echo "local rehearsal: skipping Blockscout verification"; exit 0; }
# Verification is best effort and must never flood the terminal. Blockscout's API sits behind a Cloudflare bot
# check that answers scripts with a page of HTML, so only one short line per contract is ever printed.
# Sourcify is tried first because Blockscout imports verified sources from it.
echo "verifying source (best effort, can be rerun with: ./verify.sh $LABEL)"
./verify.sh "$LABEL" || true
