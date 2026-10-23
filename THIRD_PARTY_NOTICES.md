# Third-party notices

This file records the earlier work and third-party material the project carries. It does not grant a licence to
Shijima as a whole, change any upstream terms, or imply endorsement by the projects named. File-level notices and each
dependency's own licence still apply.

## Earlier work by the author: the interface

The website's design system comes from the author's own earlier projects, built before this one. It lives in
`apps/web/styles/`, `apps/web/components/ui/` (shadcn `base-nova` primitives on Base UI), `apps/web/components/shell/`
and `apps/web/components/states/`. The author approved reusing it for Shijima.

- **Design system source:** [Cybire1/yosuku](https://github.com/Cybire1/yosuku), pinned at commit
  `3c56ef52b78dae28cc198495f753480292f6a5ad`. Its README shows an MIT badge, but its tree has no licence file for the
  badge to point at. No MIT grant is inferred from the badge or from this notice, and the question stays open for
  public redistribution.

## Earlier work by the author: the wallet screens

The app's frame, sidebar, wallet, money screens, settings, phone chrome and landing page reuse components from the
author's own earlier wallet project, **ZK Freighter**
([Blockchain-Oracle/zk-freighter](https://github.com/Blockchain-Oracle/zk-freighter), pinned at `859d95f`), in
`apps/web/components/kit/`, `apps/web/styles/kit/`, `apps/web/components/shell/app/`, `apps/web/features/money/`,
`apps/web/features/wallet/` and `apps/web/features/home/landing/`, with Shijima's colours and copy. Its tree at that
commit has no licence file, so no licence grant is inferred here.

## Fonts

| Font | Terms | Where |
| --- | --- | --- |
| Sora | Copyright 2019 The Sora Project Authors. SIL Open Font License 1.1. | `apps/web/lib/fonts.ts`, through `next/font/google`; the SemiBold TTF is vendored with its licence in `apps/web/features/og/fonts/` for link previews |
| Inter | Copyright 2020 The Inter Project Authors. SIL Open Font License 1.1. | the same |
| JetBrains Mono | Copyright 2020 The JetBrains Mono Project Authors. SIL Open Font License 1.1. | the same |
| Hanken Grotesk | Copyright 2021 The Hanken Grotesk Project Authors. SIL Open Font License 1.1. | `apps/web/lib/fonts.ts`, through `next/font/google`: the display and body face since round 4 |
| IBM Plex Mono | Copyright 2017 IBM Corp. SIL Open Font License 1.1. | the same: the mono face since round 4 |
| Noto Serif JP | Copyright 2012 Google Inc. SIL Open Font License 1.1. It sets しじま in the wordmark. | the same |

## Packaged libraries

Packaged libraries keep their own notices. Among them:
- React and Next.js (MIT);
- Base UI (MIT);
- lightweight-charts (Apache-2.0, which asks for a link to TradingView where its charts appear);
- Lucide (ISC);
- viem and wagmi (MIT).

This list is a guide to attribution. It does not replace the lockfile or the full licence text shipped with
each dependency.

## Asset marks

The discs that name a Stock Token (`apps/web/features/markets/mark-paths.ts`) carry the issuer's
mark as inline SVG path data, so nothing is fetched at runtime. The marks and names are trademarks of their owners;
they identify the underlying assets and imply no endorsement of, or affiliation with, Shijima. A CC0 grant below
covers the vectorization, not the trademark.

| Mark | Source | Terms |
| --- | --- | --- |
| Tesla, NVIDIA, Apple, Meta, Google, SpaceX, Circle | [simple-icons](https://github.com/simple-icons/simple-icons) **16.31.0** (`icons/<slug>.svg`) | CC0 1.0 Universal |
| Amazon | simple-icons **14.15.0**, the last release to carry `amazon.svg` | CC0 1.0 at publication. Removed in 15.0.0 pending permission, not on a request from Amazon. |
| Microsoft | Own geometry: four rectangles, no third-party artwork | simple-icons removed its Microsoft icons on Microsoft's trademark terms, so none is vendored. |
| SPDR S&P 500, Invesco QQQ, iShares 0-3 Month Treasury Bond, iShares Silver Trust, United States Oil Fund | None: a monogram typed on the fund house's colour | — |
| Micron, GameStop | None: no mark in simple-icons or svgl, so a monogram typed on the brand colour | — |
