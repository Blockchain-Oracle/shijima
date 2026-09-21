'use client'

import { disclosureCopy, settingsCopy } from '@desk/shared'
import { useState, useTransition } from 'react'
import { acceptDisclosureAction } from '@/app/owner-actions'
import { Button } from '@/components/ui/button'

const d = settingsCopy.disclosure

/** The disclosure (design brief 8.3), always readable again, with the one acceptance and the region declaration. */
export function Disclosure({ acceptedOn }: { acceptedOn: string | null }) {
  const [accepted, setAccepted] = useState(acceptedOn)
  const [declared, setDeclared] = useState(false)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-3">
      <p className={accepted ? 'type-caption text-ink-secondary' : 'type-caption text-warning'}>
        {accepted ? d.accepted(accepted) : d.notAccepted}
      </p>
      <details className="modal-disclosure" open={!accepted}>
        <summary>{d.read}</summary>
        <div className="flex flex-col gap-3">
          {disclosureCopy.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="type-body-strong text-ink">{section.heading}</h3>
              <p className="type-caption text-ink-secondary">{section.body}</p>
            </div>
          ))}
        </div>
      </details>
      {!accepted && (
        <label className="flex items-start gap-2 type-caption text-ink-secondary">
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
              if (done.ok) setAccepted(new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' }))
            })
          }
        >
          {d.accept}
        </Button>
      )}
    </div>
  )
}
