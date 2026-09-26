/** Shijima's mark, as in apps/web/components/shell/ShijimaMark.tsx: a crescent moon for the night, a still line,
 * and one point in the accent, the agent awake while the market sleeps. */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.17 4.53A10.5 10.5 0 1 0 25.12 17.79A8.6 8.6 0 0 1 14.17 4.53Z" fill="currentColor" />
      <rect x="4.5" y="27" width="23" height="2.2" rx="1.1" fill="currentColor" opacity="0.9" />
      <circle className="dot" cx="23.2" cy="9.2" r="2.6" />
    </svg>
  );
}

export function Brand({ docs = false, small = false }: { docs?: boolean; small?: boolean }) {
  return (
    <span className={`brand ${small ? 'brand-small' : ''}`}>
      <Mark />
      <span>Shijima</span>
      {docs && (
        <>
          <i />
          <span className="brand-docs">Docs</span>
        </>
      )}
    </span>
  );
}
