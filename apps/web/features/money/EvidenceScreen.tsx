'use client'

import { moneyCopy, short } from '@desk/shared'
import { ClipboardCheck, ExternalLink, FileCheck2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { Button, Eyebrow, Screen, ScreenTitle, StatusPill } from '@/components/kit'

const EXPLORER = 'https://robinhoodchain.blockscout.com'

export interface EvidenceFact {
  label: string
  value: string
  href: string
}

export interface EvidenceRow {
  seq: number
  summary: string
  outcome: string
  outcomeLabel: string
  shadow: boolean
  recordHash: string
  sealedByTx: string | null
  at: string
}

export interface EvidenceAgent {
  name: string
  slug: string
  address: string
  rows: EvidenceRow[]
}

/**
 * Evidence, after the reference wallet's "Verify it yourself" (WalletShell.tsx:44-67) and its evidence digest
 * (DemoEvidencePanel.tsx): what is on chain as a short list, a button that copies every hash as text, then one
 * table per agent (the decision, its fingerprint, the transaction that sealed it) and how to check one yourself.
 * Every row opens the decision, whose Check it recomputes the fingerprint in your own browser.
 */
export function EvidenceScreen({ facts, agents }: { facts: EvidenceFact[]; agents: EvidenceAgent[] }) {
  const c = moneyCopy.evidence
  const [copied, setCopied] = useState(false)

  const digest = () =>
    agents
      .flatMap((a) => [
        `# ${a.name} · ${a.address}`,
        ...a.rows.map((r) => `#${r.seq} ${r.outcome} ${r.recordHash} ${r.sealedByTx ?? 'unsealed'}`),
      ])
      .concat(facts.map((f) => `${f.label}: ${f.value}`))
      .join('\n')

  const copy = () =>
    navigator.clipboard.writeText(digest()).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      },
      () => undefined,
    )

  return (
    <Screen width={960}>
      <ScreenTitle
        title={c.title}
        sub={c.sub}
        right={
          <Button variant="secondary" onClick={copy}>
            <ClipboardCheck aria-hidden="true" size={16} />
            {copied ? c.copied : c.copyAll}
          </Button>
        }
      />

      <section
        style={{
          border: '1px solid var(--bd)',
          borderRadius: 16,
          background: 'var(--panel)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 18px',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <FileCheck2 aria-hidden="true" size={16} style={{ color: 'var(--ac2)' }} />
          <Eyebrow>{c.facts}</Eyebrow>
        </div>
        <dl className="kit-dl" style={{ padding: '14px 18px 16px' }}>
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                <a
                  href={f.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ color: 'var(--tx)', fontFamily: 'var(--fm)', fontSize: 12.5 }}
                >
                  {f.value} ↗
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {agents.map((a) => (
        <section key={a.slug} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.01em' }}>{a.name}</h2>
            <a
              href={`${EXPLORER}/address/${a.address}`}
              target="_blank"
              rel="noreferrer noopener"
              style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx3)' }}
            >
              {short(a.address, 6, 4)} ↗
            </a>
          </div>
          {a.rows.length === 0 ? (
            <div
              style={{
                padding: 18,
                border: '1px dashed var(--bd2)',
                borderRadius: 13,
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--tx3)',
              }}
            >
              {c.none}
            </div>
          ) : (
            <div className="kit-evidence" role="table" aria-label={a.name}>
              <div className="kit-evidence-row kit-evidence-head" role="row">
                <span role="columnheader">{c.step}</span>
                <span role="columnheader">{c.fingerprint}</span>
                <span role="columnheader">{c.explorer}</span>
              </div>
              {a.rows.map((r) => (
                <div className="kit-evidence-row" role="row" key={r.seq}>
                  <span role="cell" className="kit-evidence-step">
                    <Link href={`/agents/${a.slug}/decision/${r.seq}` as Route}>
                      <strong>#{r.seq}</strong> {r.summary}
                    </Link>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5 }}>
                      <StatusPill
                        status={r.shadow ? 'confirmed' : r.sealedByTx ? 'done' : 'pending'}
                        label={r.outcomeLabel.toUpperCase()}
                      />
                      <small>{r.at}</small>
                    </span>
                  </span>
                  <span role="cell">
                    <code title={r.recordHash}>{short(r.recordHash, 10, 8)}</code>
                  </span>
                  <span role="cell">
                    {r.sealedByTx ? (
                      <a href={`${EXPLORER}/tx/${r.sealedByTx}`} target="_blank" rel="noreferrer noopener">
                        <ExternalLink aria-hidden="true" size={14} /> {short(r.sealedByTx, 6, 4)}
                      </a>
                    ) : (
                      <small>{c.unsealed}</small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <section
        style={{
          border: '1px solid var(--bd)',
          borderRadius: 16,
          background: 'var(--card)',
          padding: '16px 18px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{c.howTitle}</div>
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12.5,
            color: 'var(--tx2)',
            lineHeight: 1.5,
          }}
        >
          {c.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
    </Screen>
  )
}
