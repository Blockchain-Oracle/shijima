'use client';

import { useId, useRef, type ReactNode } from 'react';
import { Maximize2, X } from 'lucide-react';
import { Brand } from './brand';
import { logos, type LogoName } from './logo';

/** An inline SVG logo that follows the theme: both files are drawn, CSS hides the one for the other theme. */
export function SvgLogo({ name, x, y, size }: { name: LogoName; x: number; y: number; size: number }) {
  const file: { light: string; dark?: string } = logos[name];
  return (
    <g>
      <image href={file.light} x={x} y={y} width={size} height={size} className={file.dark ? 'logo-light' : undefined} />
      {file.dark && <image href={file.dark} x={x} y={y} width={size} height={size} className="logo-dark" />}
    </g>
  );
}

export const ink = {
  surface: 'var(--diagram-surface)',
  ink: 'var(--diagram-ink)',
  muted: 'var(--diagram-muted)',
  line: 'var(--diagram-line)',
  accent: 'var(--diagram-accent)',
  wash: 'var(--diagram-wash)',
  danger: 'var(--danger)',
};

/** The frame every diagram shares, after Masayume's architecture figure: heading, the picture, a caption, a
 * legend, a text version, and an expanded view in a dialog. */
export function DiagramFrame({
  kicker,
  title,
  subtitle,
  note,
  legend,
  text,
  minWidth,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  note: string;
  legend: ReactNode;
  text: ReactNode;
  minWidth: number;
  children: (id: string) => ReactNode;
}) {
  const id = `d${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  return (
    <figure className="architecture diagram not-prose" aria-labelledby={`${id}-title`}>
      <div className="architecture-toolbar">
        <div className="architecture-heading">
          <span className="architecture-kicker">{kicker}</span>
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="architecture-actions">
          <Brand small />
          <button ref={expand} type="button" className="diagram-expand" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
            <Maximize2 size={15} aria-hidden="true" /> Expand
          </button>
        </div>
      </div>
      <div className="diagram-scroll" role="region" aria-label={`${title}, diagram`} tabIndex={0}>
        <div style={{ minWidth }}>{children(`${id}-inline`)}</div>
      </div>
      <figcaption className="architecture-caption">{note}</figcaption>
      <div className="architecture-footer">
        <span className="architecture-legend">{legend}</span>
      </div>
      <details className="architecture-connections">
        <summary>Read it as text</summary>
        {text}
      </details>
      <dialog
        ref={dialog}
        className="capture-dialog architecture-dialog"
        aria-labelledby={`${id}-dialog-title`}
        onClose={() => expand.current?.focus()}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="dialog-heading">
          <h2 id={`${id}-dialog-title`}>{title}</h2>
          <Brand small />
          <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Close diagram">
            <X size={23} aria-hidden="true" />
          </button>
        </div>
        <div className="diagram-scroll diagram-scroll-dialog">
          <div style={{ minWidth }}>{children(`${id}-dialog`)}</div>
        </div>
        <p className="architecture-caption" style={{ paddingBottom: 18 }}>{note}</p>
      </dialog>
    </figure>
  );
}

export function Swatch({ kind }: { kind: 'action' | 'read' | 'money' | 'never' | 'reply' }) {
  return <i className={`swatch swatch-${kind}`} aria-hidden="true" />;
}
