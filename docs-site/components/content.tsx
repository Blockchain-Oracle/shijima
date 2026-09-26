import { explorerUrl } from '@/lib/site';

/** An address or transaction on Robinhood Chain's Blockscout, shown in full so it can be checked. */
export function Addr({ value, tx = false, short = false }: { value: string; tx?: boolean; short?: boolean }) {
  const text = short ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <a className="addr" href={explorerUrl(tx ? 'tx' : 'address', value)} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
}

/** Key facts as a definition list. */
export function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="facts not-prose">{children}</dl>;
}
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A worked example in dollars. */
export function Example({ title = 'In dollars', children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="example">
      <span>{title}</span>
      {children}
    </div>
  );
}
