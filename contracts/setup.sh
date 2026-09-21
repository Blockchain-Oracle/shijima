#!/usr/bin/env bash
# Installs the contract test library. Run once after cloning: pnpm --filter @desk/contracts setup
#
# Why this is not a git submodule and not an npm package:
#  - The network this was built on stalls on full git clones. A release tarball is one 128 KB download.
#  - The `forge-std` package on npm is NOT published by the Foundry team. It is a third-party upload from
#    2022. Never install it.
# The tarball comes from the official repository at a pinned tag, and its checksum is verified.
# OpenZeppelin is installed from its official npm package by pnpm, see package.json.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="v1.16.2"
SHA256="35dbdf9c98db566f150a70b723f11d831feebb01ce615245a4fcaa4652fd4275"
DEST="lib/forge-std"

if [ -f "$DEST/.version" ] && [ "$(cat "$DEST/.version")" = "$VERSION" ]; then
  echo "forge-std $VERSION already installed"; exit 0
fi

TMP="$(mktemp -t forge-std.XXXXXX).tgz"
for attempt in 1 2 3 4 5; do
  if curl -sSL -m 120 -o "$TMP" "https://github.com/foundry-rs/forge-std/archive/refs/tags/${VERSION}.tar.gz" \
     && tar -tzf "$TMP" >/dev/null 2>&1; then break; fi
  echo "download failed, attempt $attempt of 5"; sleep $((attempt * 3))
done

ACTUAL="$(shasum -a 256 "$TMP" | awk '{print $1}')"
if [ "$ACTUAL" != "$SHA256" ]; then
  echo "CHECKSUM MISMATCH for forge-std $VERSION"; echo " expected $SHA256"; echo " actual   $ACTUAL"; exit 1
fi

rm -rf "$DEST" && mkdir -p "$DEST"
tar -xzf "$TMP" -C "$DEST" --strip-components 1
echo "$VERSION" > "$DEST/.version"
rm -f "$TMP"
echo "forge-std $VERSION installed and verified"
