import { APPROVED_TOKENS } from '@desk/chain'
import { PRESETS } from '@desk/shared'
import type { ControlsView } from '@/features/desk/DeskControls'
import type { DeskView } from './desk.server'

/** What the header's buttons and the settings page's controls need to know about this agent. */
export function controlsOf(view: DeskView): ControlsView {
  const d = view.desk
  return {
    deskId: d.id,
    slug: view.slug,
    address: d.address,
    owner: view.owner,
    mode: d.mode,
    state: d.state,
    lifecycle: d.lifecycle,
    assistantRemoved: d.assistantRemoved,
    shadowChecks: d.shadowChecks,
    goLiveChecks: d.goLiveChecks,
    reportOpened: d.reportOpened,
    cashUsdg: view.plate?.cashUsdg ?? null,
    perActionCapUsdg: view.mandate?.perActionCapUsdg ?? null,
    dailyCapUsdg: view.mandate?.dailyCapUsdg ?? null,
    mandate: view.mandate
      ? {
          presetId: view.mandate.presetId,
          targets: view.mandate.targets,
          cashBps: view.mandate.cashTargetBps,
          driftToleranceBps: view.mandate.driftToleranceBps,
          maxPositionBps: view.mandate.maxPositionBps,
          lossStopBps: view.mandate.lossStopBps,
          notes: view.mandate.notes,
          rules: view.mandate.rules,
        }
      : null,
    tokens: APPROVED_TOKENS.map((t) => ({ symbol: t.symbol, name: t.displayName })),
    presets: PRESETS.map((p) => ({ id: p.id, name: p.name })),
  }
}
