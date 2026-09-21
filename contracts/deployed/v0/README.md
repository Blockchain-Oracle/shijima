# v0, as deployed on Robinhood Chain mainnet on 2026-09-20

The exact source of factory `0x35A40883BAD8874F8fB5592c72c4385226070958` and Desk implementation
`0x99a3f0DD497d60308F138f420902BbB2b6406565`, both verified on Sourcify. Kept because `src/` has moved on to v1
and a deployed contract can never change. Foundry does not compile this folder.

v0's `checkpoint`, `sweepToVault` and `redeemFromVault` take no deadline. v1 adds one to each.
