import { controlsCopy, engineCopy, settingsCopy, studioCopy, webCopy } from '@desk/shared'
import type { ReactNode } from 'react'
import { WrongNetworkBanner } from '@/components/shell/WrongNetworkBanner'
import { EmptyState, ErrorState } from '@/components/states'
import { SectionHeader } from '@/components/ui/section-header'
import { Holdings, NeedsYou, NextCheck, Plate, Record } from '@/features/desk/DeskPanels'
import { decision, desk, FIXTURE_TIMES, holding, OUTCOME_ROWS } from './fixtures'

export const metadata = { title: 'Fixtures · states', robots: { index: false } }

/**
 * Every row of design brief 8.16 and every record outcome, drawn by the real components from fixtures (FIDELITY
 * L-72, Agari's `/dev/states`). A state the product cannot reach yet says so here instead of being faked.
 */
export default function StatesPage() {
  const { at, iso } = FIXTURE_TIMES
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  return (
    <div className="container flex flex-col gap-10 py-8">
      <section className="flex flex-col gap-4">
        <SectionHeader
          index="01"
          title="Awkward states"
          desc="Design brief 8.16: where trust is won or lost. Each is the component the desk page uses."
        />
        <Grid>
          <Fixture label="Desk paused by you">
            <NextCheck view={desk({ desk: { state: 'paused_by_owner' } })} />
          </Fixture>
          <Fixture label="Stopped by your loss limit">
            <NeedsYou
              view={desk({
                desk: {
                  state: 'stopped_by_loss_limit',
                  stateReason: engineCopy.lossLimitReached('$8.40', 1600, '$10.00', 1500),
                },
              })}
            />
            <NextCheck view={desk({ desk: { state: 'stopped_by_loss_limit' } })} />
          </Fixture>
          <Fixture label="The desk has not checked in on time">
            <NextCheck view={desk({ desk: { lastCheckAt: iso(3) } })} />
          </Fixture>
          <Fixture label="Trading paused in a token">
            <Holdings view={desk({ holdings: [holding('Nvidia', 'NVDA', { halted: true })] })} />
          </Fixture>
          <Fixture label="Price more than 8% from the last official update">
            <Holdings view={desk({ holdings: [holding('Tesla', 'TSLA', { beyondBandBps: -912 })] })} />
          </Fixture>
          <Fixture label="Price feed unavailable, or trading status unreadable">
            <Holdings
              view={desk({
                holdings: [
                  holding('Meta', 'META', { feedMissing: true }),
                  holding('Apple', 'AAPL', { halted: null }),
                ],
              })}
            />
          </Fixture>
          <Fixture label="Company event coming">
            <Holdings
              view={desk({
                holdings: [holding('Nvidia', 'NVDA', { report: { date: inThreeDays, timing: 'amc' } })],
              })}
            />
          </Fixture>
          <Fixture label="A holding's value jumped with no trade">
            <Record
              view={desk({
                notes: [
                  {
                    at: iso(5),
                    kind: 'multiplier',
                    detail: {
                      token: FIXTURE_TIMES.NVDA,
                      oldRaw: '1000000000000000000',
                      newRaw: '1000775159164630595',
                    },
                  },
                ],
              })}
            />
          </Fixture>
          <Fixture label="Your holdings changed outside the desk">
            <Record
              view={desk({
                notes: [
                  {
                    at: iso(2),
                    kind: 'holdings_changed_outside',
                    detail: { changes: [{ asset: 'USDG', delta: '2000000', usdgValue: '2000000' }] },
                  },
                  {
                    at: iso(4),
                    kind: 'owner_action',
                    detail: { event: 'Sold', detail: { token: FIXTURE_TIMES.NVDA } },
                  },
                ],
              })}
            />
          </Fixture>
          <Fixture label="Approval waiting">
            <NeedsYou
              view={desk({
                approvals: [
                  {
                    id: '00000000-0000-4000-8000-00000000a001',
                    summary: 'Buy now: the pool is in line with the reference and the cost is low.',
                    side: 'buy',
                    reason: 'ask_first',
                    expiresAt: new Date(Date.now() + 40 * 60_000).toISOString(),
                    preview: { amountIn: '$5.00', expectedOut: '0.0277 NVDA' },
                  },
                ],
              })}
            />
          </Fixture>
          <Fixture label="Approval expired">
            <Record
              view={desk({
                record: [
                  { kind: 'entry', decision: decision(1, 'not_executed', engineCopy.approvalExpired) },
                ],
              })}
            />
          </Fixture>
          <Fixture label="An action failed">
            <Record
              view={desk({
                record: OUTCOME_ROWS.filter((r) => r.kind === 'entry' && r.decision.outcome === 'failed'),
              })}
            />
          </Fixture>
          <Fixture label="Not enough ETH for your own network fees">
            <ErrorState
              diagnosis={{ kind: 'out-of-gas', technical: 'insufficient funds for gas * price + value' }}
            />
            <Note title={studioCopy.create.noEth.title} body={studioCopy.create.noEth.body} />
          </Fixture>
          <Fixture label="Wallet on the wrong network">
            <WrongNetworkBanner preview />
          </Fixture>
          <Fixture label="Money on its way in">
            <Note title={controlsCopy.addMoney.eyebrow} body={controlsCopy.addMoney.progress.waiting} />
          </Fixture>
          <Fixture label="Telegram not connected">
            <Note title={settingsCopy.telegram.title} body={settingsCopy.telegram.without} />
          </Fixture>
          <Fixture label="Savings vault short of cash">
            <Note
              title="Withdraw $250"
              body="The savings vault can pay out only $120.00 right now, less than the $200.00 this needs from it. You can withdraw $170.00 now, and the rest once the vault has the cash."
            />
          </Fixture>
          <Fixture label="Network or data trouble on our side">
            <ErrorState
              diagnosis={{ kind: 'desk-unreachable', technical: 'connect ECONNREFUSED 127.0.0.1:5432' }}
            />
            <ErrorState
              diagnosis={{ kind: 'chain-unreachable', technical: 'HTTP request failed. Status: 503' }}
            />
          </Fixture>
          <Fixture label="Empty desk, no money yet">
            <Plate view={desk({ plate: null })} />
            <EmptyState
              why={controlsCopy.addMoney.body}
              nextAction={{ label: webCopy.nav.strategies.name, href: '/strategies' }}
            />
          </Fixture>
          <Fixture label="Brand-new desk, no decisions yet">
            <NextCheck
              view={desk({
                desk: { lastCheckAt: null, shadowChecks: 0, reportOpened: false, mode: 'shadow' },
              })}
            />
            <Record view={desk({})} />
          </Fixture>
        </Grid>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          index="02"
          title="Every record outcome"
          desc="Each outcome the record can hold, live and in practice."
        />
        <Record view={desk({ record: OUTCOME_ROWS })} limit={20} />
        <p className="type-caption text-ink-muted">Fixture times run back from {at(0).toLocaleString()}.</p>
      </section>
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}

/** Agari's labeled specimen card (`app/dev/states/_sections/Fixture.tsx`). */
function Fixture({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <h3 className="type-label-micro text-ink-muted">{label}</h3>
      {children}
    </section>
  )
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="desk-card">
      <p className="type-body-strong text-ink">{title}</p>
      <p className="type-body text-ink-secondary">{body}</p>
    </div>
  )
}
