'use client'

import { disclosureCopy, settingsCopy } from '@desk/shared'
import { ArrowUpRight, CircleAlert, CircleCheck, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { acceptDisclosureAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'

const d = settingsCopy.disclosure

/**
 * The disclosure (design brief 8.3), always readable again, with the one acceptance and the region declaration.
 * Laid out like 21st's Feature Toggle Switch Cards (22208): an icon chip, the title and a status pill, then the
 * sections as a numbered list folded away once accepted.
 */
export function Disclosure({
  acceptedOn,
  onAccepted,
}: {
  acceptedOn: string | null
  /** The studio waits on this before it lets money move. */
  onAccepted?: () => void
}) {
  const [accepted, setAccepted] = useState(acceptedOn)
  const [declared, setDeclared] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="dc">
      <header className="sh-head">
        <span className="sh-chip" aria-hidden="true">
          <ScrollText />
        </span>
        <div className="sh-titles">
          <h3>{d.title}</h3>
        </div>
        <span className="sh-pill" data-on={accepted ? '' : undefined} data-warn={accepted ? undefined : ''}>
          {accepted ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          {accepted ? d.pillAccepted(accepted) : d.pillPending}
        </span>
      </header>
      {!accepted && <p className="sh-body dc-warn">{d.acceptBefore}</p>}
      <details className="dc-read" open={!accepted}>
        <summary>{d.read}</summary>
        <ol className="dc-list">
          {disclosureCopy.sections.map((section, i) => (
            <li key={section.heading}>
              <span className="dc-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h4>{section.heading}</h4>
                <p>{section.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>
      <Link href="/how-it-works#withdraw-without-us" className="dc-link">
        {settingsCopy.withdrawAnywhere}
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
      {!accepted && (
        <label className="dc-declare">
          <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
          <span>{d.declare}</span>
        </label>
      )}
      {!accepted && (
        <Button
          size="sm"
          disabled={pending || !declared}
          onClick={() =>
            start(async () => {
              const done = await acceptDisclosureAction()
              if (!done.ok) {
                setProblem(done.why)
                return
              }
              setProblem(null)
              setAccepted(new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' }))
              onAccepted?.()
            })
          }
        >
          {d.accept}
        </Button>
      )}
      {problem && (
        <p className="sh-why" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}
