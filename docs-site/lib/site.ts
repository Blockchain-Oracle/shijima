function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}

/** Both run on Coolify: the app at shijima.xyz, these docs at docs.shijima.xyz. */
export const site = {
  name: 'Shijima',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'https://docs.shijima.xyz'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'https://shijima.xyz'),
  source: 'https://github.com/Blockchain-Oracle/shijima',
  revision: 'main',
  reviewed: '2026-09-26',
  explorer: 'https://robinhoodchain.blockscout.com',
};

export function appUrl(path = '/wallet') {
  return new URL(path, site.app).toString();
}
export function sourceUrl(path: string) {
  return `${site.source}/blob/${site.revision}/${path}`;
}
export function explorerUrl(kind: 'address' | 'tx', value: string) {
  return `${site.explorer}/${kind}/${value}`;
}
