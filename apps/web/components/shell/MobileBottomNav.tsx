'use client'

import { webCopy } from '@desk/shared'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { isActiveNavItem, MOBILE_DRAWER_SECTIONS, MOBILE_NAV, MOBILE_OVERFLOW } from './nav-items'

/** The floating pill nav and the "everything" drawer, from Agari (`MobileBottomNav.tsx`), with our destinations. */
export function MobileBottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const fastPathActive = MOBILE_NAV.some((item) => isActiveNavItem(pathname, item))
  const moreActive = !fastPathActive && MOBILE_OVERFLOW.some((item) => isActiveNavItem(pathname, item))

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer whenever the route changes
  useEffect(() => setOpen(false), [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav className="mobile-bottom-nav" aria-label={webCopy.nav.mobileAria}>
        {MOBILE_NAV.map((item) => {
          const active = isActiveNavItem(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          )
        })}
        <SheetTrigger
          render={<button type="button" className={moreActive || open ? 'active' : ''} />}
          aria-label={webCopy.nav.openAll}
        >
          <MoreHorizontal aria-hidden="true" />
          <span>{webCopy.nav.more}</span>
        </SheetTrigger>
      </nav>

      <SheetContent side="right" className="mobile-nav-drawer" overlayClassName="mobile-nav-overlay">
        <SheetHeader className="mobile-nav-header">
          <span className="mobile-nav-kicker">{webCopy.nav.drawerKicker}</span>
          <SheetTitle>{webCopy.nav.drawerTitle}</SheetTitle>
          <SheetDescription>{webCopy.nav.drawerDescription}</SheetDescription>
        </SheetHeader>
        <nav className="mobile-nav-groups" aria-label={webCopy.nav.drawerTitle}>
          {MOBILE_DRAWER_SECTIONS.map((section) => (
            <section
              className="mobile-nav-group"
              key={section.id}
              aria-labelledby={`mobile-nav-${section.id}`}
            >
              <div className="mobile-nav-group-title">
                <h2 id={`mobile-nav-${section.id}`}>{section.name}</h2>
                <span>{section.description}</span>
              </div>
              <div className="mobile-nav-links">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const active = isActiveNavItem(pathname, item)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`mobile-nav-link ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span className="mobile-nav-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="mobile-nav-copy">
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
