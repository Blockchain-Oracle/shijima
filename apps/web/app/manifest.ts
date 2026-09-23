import { webCopy } from '@desk/shared'
import type { MetadataRoute } from 'next'

/**
 * Makes Shijima installable from the browser: "Add to Home Screen" opens it full screen, like an app, with no
 * store. The owner is on a phone (design brief §2), and a native build buys nothing a home-screen icon does not.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: webCopy.brand.name,
    short_name: webCopy.brand.name,
    description: `${webCopy.brand.motto}. ${webCopy.brand.description}`,
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
