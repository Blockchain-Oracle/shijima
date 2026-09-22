'use client'

import { deskAbi, EXPLORER, OFFICIAL_RPC } from '@desk/chain'
import { checkItCopy as c, canonicalJson, hashRecord, newYorkTime, short } from '@desk/shared'
import { useState } from 'react'
import { createPublicClient, type Hex, http, parseEventLogs } from 'viem'
import { robinhood } from 'viem/chains'
import type { Proof } from '@/lib/proof.server'

/**
 * Recomputes the record's fingerprint in the reader's own browser, in front of them, and compares it with the
 * one the public network holds. The network is asked from the browser, over the official public RPC, so the
 * comparison never depends on a number we supplied.
 *
 * A record that did nothing has no transaction of its own. It is sealed by a later record, and each record
 * names the fingerprint of the one before it, so the browser rebuilds every link from this record to the sealing
 * one. Only then is the network's fingerprint a proof of THIS record.
 */
interface Result {
  computed: string
  storedOk: boolean
  links: { seq: number; ok: boolean }[]
  expected: string
  chain: 'ok' | 'mismatch' | 'unreachable' | 'no_event' | 'unsealed' | 'unknown'
  eventHash?: string
}

export function CheckIt({
  record,
  recordHash,
  desk,
  proof,
}: {
  record: unknown
  recordHash: string
  desk: string
  proof: Proof
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [showBytes, setShowBytes] = useState(false)

  const check = async () => {
    setBusy(true)
    const computed = hashRecord(record)
    const storedOk = same(computed, recordHash)
    let expected = computed
    const links: Result['links'] = []
    if (proof.kind === 'later') {
      for (const link of proof.links) {
        const body = link.record as { prevHash?: unknown }
        const joined = typeof body.prevHash === 'string' && same(body.prevHash, expected)
        const hash = hashRecord(link.record)
        links.push({ seq: link.seq, ok: joined })
        expected = hash
      }
    }
    const base = { computed, storedOk, links, expected }
    if (proof.kind === 'unsealed') {
      setResult({ ...base, chain: 'unsealed' })
      setBusy(false)
      return
    }
    try {
      const client = createPublicClient({
        chain: robinhood,
        transport: http(OFFICIAL_RPC, { retryCount: 2 }),
      })
      const receipt = await client.getTransactionReceipt({ hash: proof.txHash as Hex })
      const logs = receipt.logs.filter((l) => l.address.toLowerCase() === desk.toLowerCase())
      const events = parseEventLogs({ abi: deskAbi, logs })
      const found = events.find((e) => 'decisionHash' in e.args) as
        | { args: { decisionHash: Hex } }
        | undefined
      if (!found) {
        setResult({ ...base, chain: 'no_event' })
      } else {
        const eventHash = found.args.decisionHash
        const linksOk = links.every((l) => l.ok)
        const ok = proof.kind === 'unknown' ? false : linksOk && same(eventHash, expected)
        setResult({
          ...base,
          chain: proof.kind === 'unknown' ? 'unknown' : ok ? 'ok' : 'mismatch',
          eventHash,
        })
      }
    } catch {
      setResult({ ...base, chain: 'unreachable' })
    }
    setBusy(false)
  }

  const download = () => {
    const blob = new Blob([`${canonicalJson(record)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `record-${recordHash.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const explorer = proof.kind === 'unsealed' ? undefined : `${EXPLORER}/tx/${proof.txHash}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={busy} className="desk-control" data-cursor="hover">
          {busy ? c.checking : c.check}
        </button>
        <button type="button" onClick={download} className="desk-control" data-cursor="hover">
          {c.download}
        </button>
        <button
          type="button"
          onClick={() => setShowBytes(!showBytes)}
          className="desk-control"
          data-cursor="hover"
        >
          {showBytes ? c.hideBytes : c.showBytes}
        </button>
      </div>

      {result ? (
        <Verdict result={result} proof={proof} recordHash={recordHash} explorer={explorer} />
      ) : (
        <p className="type-caption text-ink-muted">
          {proof.kind === 'unsealed' ? c.beforeUnsealed : c.before}
        </p>
      )}

      {showBytes ? (
        <pre className="desk-bytes">
          <code>{canonicalJson(record)}</code>
        </pre>
      ) : null}
      {!showBytes && result?.storedOk ? (
        <p className="type-caption text-ink-muted">fingerprint {short(result.computed, 10, 8)}</p>
      ) : null}
    </div>
  )
}

function Verdict({
  result,
  proof,
  recordHash,
  explorer,
}: {
  result: Result
  proof: Proof
  recordHash: string
  explorer: string | undefined
}) {
  const good = result.storedOk && result.chain === 'ok'
  const bad = !result.storedOk || result.chain === 'mismatch' || result.chain === 'no_event'
  const tone = good ? 'text-acted' : bad ? 'text-blocked' : 'text-ink-secondary'
  const sentence = !result.storedOk
    ? c.storedMismatch
    : result.chain === 'ok'
      ? c.matches
      : result.chain === 'mismatch'
        ? c.mismatch
        : result.chain === 'no_event'
          ? c.noEvent
          : result.chain === 'unreachable'
            ? c.storedOnly
            : result.chain === 'unknown'
              ? c.unknownSeal
              : c.unsealedResult
  return (
    <div className="desk-card" data-tone={good ? 'good' : bad ? 'bad' : undefined}>
      <p className={`type-body ${tone}`}>{sentence}</p>
      {proof.kind === 'unsealed' && (
        <p className="type-caption text-ink-muted">
          {proof.nextSealAt ? c.unsealedNext(newYorkTime(new Date(proof.nextSealAt))) : c.unsealedNextUnknown}
        </p>
      )}
      {proof.kind === 'own' && <p className="type-caption text-ink-secondary">{c.stepOwn}</p>}
      {proof.kind === 'later' && (
        <>
          <p className="type-caption text-ink-secondary">
            {c.stepLater(result.links.length, proof.sealingSeq)}
          </p>
          <ul className="desk-card-lines">
            {result.links.map((l) => (
              <li key={l.seq} className={l.ok ? 'type-caption text-ink-muted' : 'type-caption text-blocked'}>
                {l.ok ? c.linkOk(l.seq) : c.linkBroken(l.seq)}
              </li>
            ))}
          </ul>
        </>
      )}
      <dl className="desk-receipt">
        <dt>{c.computed}</dt>
        <dd className="type-mono break-all">{result.computed}</dd>
        <dt>{c.stored}</dt>
        <dd className="type-mono break-all">{recordHash}</dd>
        {result.eventHash && (
          <>
            <dt>{c.onChain}</dt>
            <dd className="type-mono break-all">
              {result.eventHash}
              {explorer && (
                <>
                  {' '}
                  <a href={explorer} className="text-accent hover:underline" rel="noreferrer noopener">
                    ({c.seeTx})
                  </a>
                </>
              )}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
