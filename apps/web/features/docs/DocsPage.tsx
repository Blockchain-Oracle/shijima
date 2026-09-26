import { docsCopy as D, type DocBlock } from '@desk/shared'
import { Info } from 'lucide-react'
import { DOCS_SITE_URL } from '@/lib/docs-site'
import './docs.css'

function Block({ b }: { b: DocBlock }) {
  if ('p' in b) return <p className="doc-p">{b.p}</p>
  if ('list' in b)
    return (
      <ul className="doc-list">
        {b.list.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    )
  if ('steps' in b)
    return (
      <ol className="doc-steps">
        {b.steps.map((l, i) => (
          <li key={l}>
            <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            {l}
          </li>
        ))}
      </ol>
    )
  if ('code' in b) return <pre className="doc-code">{b.code}</pre>
  if ('rows' in b)
    return (
      <dl className="doc-rows">
        {b.rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    )
  return (
    <p className="doc-note">
      <Info aria-hidden />
      {b.note}
    </p>
  )
}

/**
 * The manual: a table of contents that stays in view on a wide screen, and the sections beside it, grouped for
 * people who use Shijima and people who build on it. Server-rendered, no data.
 */
export function DocsPage() {
  return (
    <div className="container doc-page">
      <header className="doc-head">
        <p className="section-eyebrow">しじま · {D.title}</p>
        <h1 className="doc-title">{D.title}</h1>
        <p className="doc-lead">{D.lead}</p>
        {DOCS_SITE_URL && (
          <p className="doc-note">
            <Info aria-hidden />
            <span>
              {D.site.body}{' '}
              <a href={DOCS_SITE_URL} target="_blank" rel="noreferrer">
                {D.site.cta} ↗
              </a>
            </span>
          </p>
        )}
      </header>
      <div className="doc-grid">
        <nav className="doc-toc" aria-label={D.onThisPage}>
          <p className="doc-toc-label">{D.onThisPage}</p>
          {D.groups.map((g) => (
            <div key={g} className="doc-toc-group">
              <p className="doc-toc-group-name">{g}</p>
              {D.sections
                .filter((s) => s.group === g)
                .map((s) => (
                  <a key={s.id} href={`#${s.id}`}>
                    {s.title}
                  </a>
                ))}
            </div>
          ))}
        </nav>
        <div className="doc-body">
          {D.groups.map((g) => (
            <div key={g} className="doc-group">
              <p className="doc-group-name">{g}</p>
              {D.sections
                .filter((s) => s.group === g)
                .map((s) => (
                  <section key={s.id} id={s.id} className="doc-section" aria-label={s.title}>
                    <h2>{s.title}</h2>
                    {s.blocks.map((b) => (
                      <Block key={JSON.stringify(b).slice(0, 80)} b={b} />
                    ))}
                  </section>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
