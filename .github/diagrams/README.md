# README diagrams

The README pictures are rendered from `readme-system.mmd` and `readme-hourly-check.mmd`. Edit the Mermaid source, then render light and dark PNGs into `.github/assets/` with Mermaid CLI. The committed images use CLI 11.15.0 at 2× scale.

```sh
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-light.png -c .github/diagrams/mermaid-light.json -b '#F4EEE3' -s 2
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-dark.png -c .github/diagrams/mermaid-dark.json -b '#10130C' -s 2
mmdc -i .github/diagrams/readme-hourly-check.mmd -o .github/assets/hourly-check-light.png -c .github/diagrams/mermaid-light.json -b '#F4EEE3' -s 2
mmdc -i .github/diagrams/readme-hourly-check.mmd -o .github/assets/hourly-check-dark.png -c .github/diagrams/mermaid-dark.json -b '#10130C' -s 2
```

Mermaid CLI needs a local Chromium browser. On a machine where Puppeteer cannot find one, pass `-p` with a local Puppeteer config containing its `executablePath`.
