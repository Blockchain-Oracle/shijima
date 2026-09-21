'use client'

import { controlsCopy } from '@desk/shared'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ControlDialog, type ControlsView } from '@/features/desk/DeskControls'

/** Closing lives in settings, away from the everyday buttons: one confirmation, and it is final. */
export function CloseDeskButton({ view }: { view: ControlsView }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {controlsCopy.actions.closeDesk}
      </Button>
      {open && <ControlDialog view={view} form="closeDesk" onClose={() => setOpen(false)} />}
    </>
  )
}
