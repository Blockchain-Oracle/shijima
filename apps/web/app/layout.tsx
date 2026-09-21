import { webCopy } from '@desk/shared'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/components/providers'
import { ShellChrome } from '@/components/shell'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { fontVariables } from '@/lib/fonts'
import { loadShell } from '@/lib/shell.server'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import { cn } from '@/lib/utils'
import '@/styles/index.css'

export const metadata: Metadata = {
  title: { default: webCopy.brand.name, template: `%s · ${webCopy.brand.name}` },
  description: webCopy.brand.description,
}

/** Masayume's root, as Agari has it: the faces, the theme painted before the first frame, and the shell. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const shell = await loadShell()
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('antialiased cursor-custom', fontVariables)} suppressHydrationWarning>
        {/* Paint the chosen theme on the first frame, so there is no flash of the other one. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed script of our own, with no input in it */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <TooltipProvider>
            <Toaster limit={1}>
              <ShellChrome {...shell}>{children}</ShellChrome>
            </Toaster>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
