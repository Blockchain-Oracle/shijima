'use client'

import { controlsCopy } from '@desk/shared'
import { useState } from 'react'
import { ControlDialog, type ControlsView } from '@/features/desk/DeskControls'

/** Closing lives in settings, away from the everyday buttons: one confirmation, and it is final. */
export function CloseDeskButton({ view }: { view: ControlsView }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="st-btn st-btn--danger dz-btn" onClick={() => setOpen(true)}>
        {controlsCopy.actions.closeDesk}
      </button>
      {open && <ControlDialog view={view} form="closeDesk" onClose={() => setOpen(false)} />}
    </>
  )
}
