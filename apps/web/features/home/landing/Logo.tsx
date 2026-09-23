import { ShijimaMark } from '@/components/shell/ShijimaMark'

/** The reference's Logo slot: our mark in a rounded tile, with its glow when asked. Decorative. */
export function Logo({ size, glow = false }: { size: number; glow?: boolean }) {
  return (
    <span
      className={`land-logo${glow ? ' is-glow' : ''}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      aria-hidden
    >
      <ShijimaMark />
    </span>
  )
}
