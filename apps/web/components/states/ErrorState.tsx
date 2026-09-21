'use client'

import { webCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Diagnosis } from '@/lib/kit'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  diagnosis: Diagnosis
  retry?: () => void
  backHref?: Route
  variant?: 'inline' | 'boundary'
  className?: string
}

/** An honest diagnosis in plain words, with the technical detail folded away. From Agari's `ErrorState`. */
export function ErrorState({ diagnosis, retry, backHref, variant = 'inline', className }: ErrorStateProps) {
  const boundary = variant === 'boundary'
  const copy = boundary ? webCopy.states.boundary : webCopy.states.diagnosis[diagnosis.kind]
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4',
        boundary && 'p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className={cn('text-ink', boundary ? 'type-headline' : 'type-body-strong')}>{copy.headline}</p>
        <p className="type-body text-ink-secondary">{copy.body}</p>
      </div>
      {(retry || backHref) && (
        <div className="flex flex-wrap gap-2">
          {retry && (
            <Button variant="secondary" size="sm" onClick={retry}>
              {webCopy.states.retry}
            </Button>
          )}
          {backHref && (
            <Button variant="ghost" size="sm" render={<Link href={backHref} />}>
              {webCopy.states.back}
            </Button>
          )}
        </div>
      )}
      <details className="type-caption text-ink-muted">
        <summary className="cursor-pointer">{webCopy.states.technical}</summary>
        <pre className="numbers mt-2 overflow-x-auto whitespace-pre-wrap text-ink-secondary">
          {diagnosis.kind}
          {'\n'}
          {diagnosis.technical}
        </pre>
      </details>
    </div>
  )
}
