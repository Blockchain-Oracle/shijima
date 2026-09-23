'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Panels from the reference wallet's screens:
 *   AccessCard / CardTop / CardBody  the 380px floating card of its onboarding and unlock (AccessPanels.tsx:8-54)
 *   Group / Row                      the settings groups with a mono header (SettingsScreen.tsx:22-40)
 *   ToggleSwitch                     the 42×24 switch (SettingsScreen.tsx:25-31)
 *   FlowCard                         the one card every money flow steps inside (ShieldScreen.tsx:187-290)
 */

export function AccessCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 380,
        maxWidth: '100%',
        background: 'linear-gradient(180deg, rgb(255 255 255 / 0.02), transparent 30%), var(--panel)',
        border: '1px solid var(--bd2)',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-pop)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )
}

export function CardTop({ left, title, right }: { left?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '15px 20px',
        borderBottom: '1px solid var(--bd)',
      }}
    >
      {left}
      <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
      {right ? <span style={{ marginLeft: 'auto' }}>{right}</span> : null}
    </div>
  )
}

export function CardBody({
  children,
  center,
  style,
}: {
  children: ReactNode
  center?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        padding: '24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: 1,
        ...(center ? { alignItems: 'center', textAlign: 'center', justifyContent: 'center', gap: 20 } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Group({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section
      id={id}
      style={{
        border: '1px solid var(--bd)',
        borderRadius: 16,
        background: 'var(--panel)',
        overflow: 'hidden',
        scrollMarginTop: 72,
      }}
    >
      <h2
        style={{
          margin: 0,
          padding: '13px 18px',
          borderBottom: '1px solid var(--bd)',
          font: '600 9px/1 var(--fm)',
          letterSpacing: '.12em',
          color: 'var(--tx3)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Row({
  label,
  children,
  top,
  sub,
}: {
  label: ReactNode
  children?: ReactNode
  top?: boolean
  sub?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '15px 18px',
        borderTop: top ? 'none' : '1px solid var(--bd)',
        fontSize: 12.5,
        color: 'var(--tx2)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block' }}>{label}</span>
        {sub ? (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'var(--tx3)' }}>{sub}</span>
        ) : null}
      </span>
      {children !== undefined ? (
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--tx)', textAlign: 'right' }}>
          {children}
        </span>
      ) : null}
    </div>
  )
}

export function ToggleSwitch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        flex: 'none',
        width: 42,
        height: 24,
        borderRadius: 999,
        border: '1px solid var(--bd2)',
        background: on ? 'var(--ac)' : 'var(--card2)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on ? 'var(--on-accent)' : '#fff',
          transition: 'left .15s',
          boxShadow: '0 1px 3px rgb(0 0 0 / 0.3)',
        }}
      />
    </button>
  )
}

/** The money flows' card: an icon tile, a title and a badge on top; the current step below. */
export function FlowCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: ReactNode
  title: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        border: '1px solid var(--bd)',
        borderRadius: 18,
        background: 'var(--panel)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '16px 20px',
          borderBottom: '1px solid var(--bd)',
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--ac) 14%, transparent)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ac2)',
            fontSize: 16,
            flex: 'none',
          }}
        >
          {icon}
        </span>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {badge ? <div style={{ marginLeft: 'auto' }}>{badge}</div> : null}
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  )
}

/** The reference's screen column: a centred section with its max width and padding. */
export function Screen({
  children,
  width = 1024,
  gap = 24,
}: {
  children: ReactNode
  width?: number
  gap?: number
}) {
  return (
    <section
      className="kit-screen"
      style={{
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </section>
  )
}
