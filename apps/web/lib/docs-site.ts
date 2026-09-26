/** The documentation site (`docs-site/`, its own Coolify app). `NEXT_PUBLIC_DOCS_URL` overrides it at build time. */
export const DOCS_SITE_URL: string = process.env.NEXT_PUBLIC_DOCS_URL?.trim() || 'https://docs.shijima.xyz'
