'use client'

import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PickOption<V extends string> {
  value: V
  label: string
  icon?: ReactNode
}

/**
 * A dropdown in the kit's own look, on base-ui's Select: the trigger shows the chosen option with its icon, and the
 * list opens under it in a panel with a check on the chosen row. Keyboard, focus and screen readers come from
 * base-ui; nothing here is the browser's native menu.
 */
export function Pick<V extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: V
  onChange: (value: V) => void
  options: PickOption<V>[]
  label: string
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Select.Root
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
    >
      <Select.Trigger className={cn('pick-trigger', className)} aria-label={label}>
        {current?.icon && <span className="pick-icon">{current.icon}</span>}
        <Select.Value className="pick-value" />
        <Select.Icon className="pick-chevron">
          <ChevronDown className="size-4" aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="pick-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
          align="end"
        >
          <Select.Popup className="pick-popup">
            <Select.List>
              {options.map((o) => (
                <Select.Item key={o.value} value={o.value} className="pick-item">
                  {o.icon && <span className="pick-icon">{o.icon}</span>}
                  <Select.ItemText className="pick-item-text">{o.label}</Select.ItemText>
                  <Select.ItemIndicator className="pick-check">
                    <Check className="size-4" aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
