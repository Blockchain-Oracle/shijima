'use client'

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Spinner } from './proving'

/** The reference wallet's action button (packages/ui/src/button.tsx). Text on the accent is --on-accent, never white. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tertiary'

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--ac)',
    color: 'var(--on-accent)',
    border: 'none',
    boxShadow: 'var(--shadow-glow)',
  },
  secondary: { background: 'var(--card)', color: 'var(--tx)', border: '1px solid var(--bd)' },
  ghost: { background: 'none', color: 'var(--tx2)', border: 'none' },
  danger: { background: 'var(--dng)', color: '#fff', border: 'none' },
  tertiary: { background: 'none', color: 'var(--ac2)', border: 'none' },
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly variant?: ButtonVariant
  readonly loading?: boolean
  readonly fullWidth?: boolean
  readonly children: ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className={`kit-btn kit-btn--${variant}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 18px',
        borderRadius: 11,
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        width: fullWidth ? '100%' : 'auto',
        whiteSpace: 'nowrap',
        ...VARIANT_STYLE[variant],
        ...style,
      }}
    >
      {loading ? (
        <Spinner
          size={15}
          color={variant === 'primary' ? 'var(--on-accent)' : variant === 'danger' ? '#fff' : 'var(--ac)'}
        />
      ) : null}
      {children}
    </button>
  )
}

/** The same look for a link (the reference's action row mixes buttons and navigation). */
export function buttonStyle(variant: ButtonVariant, fullWidth = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 11,
    fontSize: 13.5,
    fontWeight: 700,
    textDecoration: 'none',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    ...VARIANT_STYLE[variant],
  }
}
