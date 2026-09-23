# Third-party notices

This file records where the website's design came from, and the attribution for material it carries. It does
not grant a licence to Shijima as a whole, change any upstream terms, or imply endorsement by the projects named.
File-level notices and each dependency's own licence still apply.

## Masayume, Agari and Yosuku: the interface

The website's look comes from **Masayume** (`sommina-events` @ `a255ae9`), by way of **Agari**
(`agari-wt/w1`, branch `integration/w1` @ `695e7ca`). Agari had already moved Masayume onto US stocks. Both are
the same author's own projects. Masayume's interface is itself a source-led port of **Yosuku**.

- **Yosuku:** [Cybire1/yosuku](https://github.com/Cybire1/yosuku), pinned reference commit
  `3c56ef52b78dae28cc198495f753480292f6a5ad`. `apps/web/styles/yosuku/` holds its design system, copied
  verbatim from Agari. The parts join byte for byte into the reference's `globals.css`. Only the `@source` lines
  in `index.css` are ours, and they point at this app's folders.
- **Carried over from Agari:** `apps/web/styles/agari/`, the semantic bridge, the component tokens and the
  sheets for the surfaces Shijima keeps, all verbatim. `apps/web/components/ui/` holds the shadcn `base-nova`
  primitives on Base UI. `apps/web/components/shell/` and `apps/web/components/states/` are adapted from
  Agari's own files, and each file names its source in a comment.
- **Approval:** the owner approved reusing Yosuku's source, CSS, tokens and assets for Masayume on
  1 September 2026. Agari carried that approval on 13 September, and Shijima carries it here.
- **What is not known:** Yosuku's pinned README shows an MIT badge, but its tree has no licence file for the
  badge to point at. No MIT grant is inferred from the badge or from this notice. The question stays open for
  public redistribution, as it was for Agari.

## ZK Freighter: the wallet screens

The app's frame, sidebar, wallet, money screens, settings, phone chrome and landing page follow **ZK Freighter**
([Blockchain-Oracle/zk-freighter](https://github.com/Blockchain-Oracle/zk-freighter), pinned at `859d95f`), the same
author's own wallet project. Its components were ported into `apps/web/components/kit/`, `apps/web/styles/kit/`,
`apps/web/components/shell/app/`, `apps/web/features/money/`, `apps/web/features/wallet/` and
`apps/web/features/home/landing/`, with Shijima's colours and copy. The author asked for its code to be reused on
23 September 2026. Its tree at that commit has no licence file, so no licence grant is inferred here.

## Fonts

| Font | Terms | Where |
| --- | --- | --- |
| Sora | Copyright 2019 The Sora Project Authors. SIL Open Font License 1.1. | `apps/web/lib/fonts.ts`, through `next/font/google`; the SemiBold TTF is vendored with its licence in `apps/web/features/og/fonts/` for link previews, as Agari does |
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

The discs that name a Stock Token (`apps/web/features/markets/mark-paths.ts`, copied from Agari) carry the issuer's
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
