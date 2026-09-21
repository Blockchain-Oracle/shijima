'use client'

import { canonicalJson, hashRecord, short } from '@desk/shared'
import { useState } from 'react'

/**
 * Recomputes the record's fingerprint in the reader's own browser, in front of them.
 *
 * This is the whole promise made checkable: the same bytes, the same hash function, run on their machine and
 * not ours. If it matches what the network holds, nobody has changed the record since, including us.
 */
export function CheckIt({
  record,
  recordHash,
  onChainHash,
  explorerUrl,
}: {
  record: unknown
  recordHash: string
  onChainHash?: string | undefined
  explorerUrl?: string | undefined
}) {
  const [result, setResult] = useState<{ ok: boolean; computed: string } | null>(null)
  const [showBytes, setShowBytes] = useState(false)

  const check = () => {
    const computed = hashRecord(record)
    const matches =
      computed.toLowerCase() === recordHash.toLowerCase() &&
      (!onChainHash || computed.toLowerCase() === onChainHash.toLowerCase())
    setResult({ ok: matches, computed })
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={check}
          className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent text-sm hover:bg-accent hover:text-surface"
        >
          Check it
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-md border border-line px-3 py-1.5 text-ink-soft text-sm hover:border-ink-soft"
        >
          Download this record
        </button>
        <button
          type="button"
          onClick={() => setShowBytes(!showBytes)}
          className="rounded-md border border-line px-3 py-1.5 text-ink-soft text-sm hover:border-ink-soft"
        >
          {showBytes ? 'Hide' : 'Show'} the exact bytes
        </button>
      </div>

      {result ? (
        <div className={`rounded-md border p-3 text-sm ${result.ok ? 'border-acted' : 'border-blocked'}`}>
          <p className={result.ok ? 'text-acted' : 'text-blocked'}>
            {result.ok
              ? 'It matches. This record is exactly the one whose fingerprint was written on the public network.'
              : 'It does NOT match. This record is not the one that was written on the network.'}
          </p>
          <p className="mt-2 break-all font-mono text-ink-soft text-xs">
            your browser computed {result.computed}
          </p>
          <p className="break-all font-mono text-ink-soft text-xs">stored with the record {recordHash}</p>
          {onChainHash ? (
            <p className="break-all font-mono text-ink-soft text-xs">
              written on the network {onChainHash}
              {explorerUrl ? (
                <>
                  {' '}
                  <a href={explorerUrl} className="text-accent hover:underline">
                    (see the transaction)
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-ink-faint text-xs">
          Your browser will rebuild the fingerprint from the record below and compare it with the one on the
          public network. Nothing is sent anywhere.
        </p>
      )}

      {showBytes ? (
        <pre className="max-h-72 overflow-auto rounded-md border border-line bg-page p-3 text-xs">
          <code className="break-all">{canonicalJson(record)}</code>
        </pre>
      ) : null}
      {!showBytes && result?.ok ? (
        <p className="text-ink-faint text-xs">fingerprint {short(result.computed, 10, 8)}</p>
      ) : null}
    </div>
  )
}
