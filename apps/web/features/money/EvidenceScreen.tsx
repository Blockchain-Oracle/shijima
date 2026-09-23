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

export interface EvidenceMove {
  id: string
  kind: string
  where: string
  usd: number | null
  status: 'signing' | 'approved_only' | 'on_its_way' | 'done' | 'nothing_sent' | 'may_have_been_sent'
  at: string
  hash: string | null
  href: string | null
}

const PILL = {
  signing: 'pending',
  approved_only: 'pending',
  on_its_way: 'onItsWay',
  done: 'done',
  nothing_sent: 'failed',
  may_have_been_sent: 'pending',
} as const

/**
 * Evidence, after the reference wallet's "Verify it yourself" (WalletShell.tsx:44-67) and its evidence digest
 * (DemoEvidencePanel.tsx): what is on chain as a short list, a button that copies every hash as text, then one
 * table per agent (the decision, its fingerprint, the transaction that sealed it) and how to check one yourself.
 * Every row opens the decision, whose Check it recomputes the fingerprint in your own browser.
 */
export function EvidenceScreen({
  facts,
  agents,
  moves,
}: {
  facts: EvidenceFact[]
  agents: EvidenceAgent[]
  moves: EvidenceMove[]
}) {
  const c = moneyCopy.evidence
  const [copied, setCopied] = useState(false)

  const digest = () =>
    agents
      .flatMap((a) => [
        `# ${a.name} · ${a.address}`,
        ...a.rows.map((r) => `#${r.seq} ${r.outcome} ${r.recordHash} ${r.sealedByTx ?? 'unsealed'}`),
      ])
      .concat(moves.filter((m) => m.hash).map((m) => `${m.kind} ${m.where} ${m.status} ${m.hash}`))
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
            <div className="kit-evidence">
              <div className="kit-evidence-row kit-evidence-head" aria-hidden="true">
                <span>{c.step}</span>
                <span>{c.fingerprint}</span>
                <span>{c.explorer}</span>
              </div>
              {a.rows.map((r) => (
                <div className="kit-evidence-row" key={r.seq}>
                  <span className="kit-evidence-step">
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
                  <span>
                    <code title={r.recordHash}>{short(r.recordHash, 10, 8)}</code>
                  </span>
                  <span>
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

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.01em' }}>{c.movesTitle}</h2>
        {moves.length === 0 ? (
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
            {c.movesNone}
          </div>
        ) : (
          <div className="kit-evidence">
            {moves.map((m) => (
              <div className="kit-evidence-row" key={m.id}>
                <span className="kit-evidence-step">
                  <strong>
                    {m.kind} · {m.where}
                  </strong>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5 }}>
                    <StatusPill status={PILL[m.status]} label={c.moveStatus[m.status]} />
                    <small>{m.at}</small>
                  </span>
                </span>
                <span>
                  <code>{m.usd === null ? '—' : `$${m.usd.toFixed(2)}`}</code>
                </span>
                <span>
                  {m.href ? (
                    <a href={m.href} target="_blank" rel="noreferrer noopener">
                      <ExternalLink aria-hidden="true" size={14} /> {m.hash ? short(m.hash, 6, 4) : c.open}
                    </a>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

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
