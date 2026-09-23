'use client'

import type { ReactNode } from 'react'
import { Chip, fontMono } from './primitives'

/** The reference wallet's inputs (packages/ui/src/inputs.tsx): the big amount field and the segmented toggle. */

/** Large centred amount field with a unit, optional caption, Max and quick amounts. */
export function AmountInput({
  value,
  onChange,
  unit,
  caption,
  onMax,
  presets,
  onPreset,
  autoFocus,
  invalid,
  prefix,
}: {
  value: string
  onChange: (value: string) => void
  unit: string
  caption?: ReactNode
  onMax?: () => void
  presets?: readonly string[]
  onPreset?: (value: string) => void
  autoFocus?: boolean
  invalid?: boolean
  /** "$" for dollar amounts. */
  prefix?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 8,
          maxWidth: '100%',
        }}
      >
        {prefix ? (
          <span style={{ fontSize: 30, fontWeight: 800, color: invalid ? 'var(--warn)' : 'var(--tx3)' }}>
            {prefix}
          </span>
        ) : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          inputMode="decimal"
          // biome-ignore lint/a11y/noAutofocus: the amount is the only field on the step, as in the reference.
          autoFocus={autoFocus}
          aria-label={`${unit} amount`}
          style={{
            width: `${Math.max(1, value.length || 1)}ch`,
            maxWidth: '8ch',
            background: 'none',
            border: 'none',
            outline: 'none',
            textAlign: 'right',
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: '-.03em',
            color: invalid ? 'var(--warn)' : 'var(--tx)',
            fontVariantNumeric: 'tabular-nums',
            padding: 0,
          }}
        />
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--tx2)', fontFamily: fontMono }}>
          {unit}
        </span>
      </div>
      {caption ? (
        <div style={{ fontSize: 11.5, color: 'var(--tx3)', textAlign: 'center' }}>{caption}</div>
      ) : null}
      {onMax ? (
        <button
          type="button"
          onClick={onMax}
          style={{
            marginTop: 2,
            padding: '3px 11px',
            borderRadius: 999,
            border: '1px solid var(--bd)',
            background: 'var(--card)',
            color: 'var(--tx2)',
            fontSize: 10.5,
            fontFamily: fontMono,
            letterSpacing: '.06em',
            cursor: 'pointer',
          }}
        >
          MAX
        </button>
      ) : null}
      {presets && presets.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {presets.map((preset) => (
            <Chip key={preset} label={preset} onClick={() => onPreset?.(preset)} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export interface SegmentedOption {
  readonly value: string
  readonly label: ReactNode
}

/** n-segment toggle: the selected segment is the solid accent, with --on-accent text. */
export function Segmented({
  options,
  value,
  onChange,
  size = 'md',
  label,
  fullWidth = false,
}: {
  options: readonly SegmentedOption[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  label?: string
  fullWidth?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        padding: 3,
        gap: 3,
        background: 'var(--card)',
        border: '1px solid var(--bd)',
        borderRadius: 11,
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            style={{
              flex: fullWidth ? 1 : undefined,
              padding: size === 'sm' ? '6px 12px' : '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: selected ? 'var(--ac)' : 'transparent',
              color: selected ? 'var(--on-accent)' : 'var(--tx2)',
              transition: 'background .15s ease',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A labelled text field in the reference's style (mono label, 12px-radius inset). */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  invalid,
  hint,
  right,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
  invalid?: boolean
  hint?: ReactNode
  right?: ReactNode
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          font: '700 10px/1 var(--fm)',
          letterSpacing: '.1em',
          color: 'var(--tx3)',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {label}
        {right ? <span style={{ marginLeft: 'auto' }}>{right}</span> : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 13px',
          borderRadius: 12,
          border: `1px solid ${invalid ? 'var(--warn)' : 'var(--bd2)'}`,
          background: 'var(--card)',
          color: 'var(--tx)',
          fontFamily: mono ? 'var(--fm)' : 'inherit',
          fontSize: 13,
          outline: 'none',
        }}
      />
      {hint ? (
        <span
          style={{
            display: 'block',
            marginTop: 7,
            fontSize: 11,
            color: invalid ? 'var(--warn)' : 'var(--tx3)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  )
}
