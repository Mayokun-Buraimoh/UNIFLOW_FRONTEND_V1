/**
 * App bundle only. Build-time checks duplicate this logic in `vite.config.ts` (see TS project layout).
 * Catches copied `.env.example` values that are not real tunnels.
 */
export function isTemplatedBackendUrl(url: string): boolean {
  const s = url.trim().toLowerCase();
  if (!s) return false;
  if (/\breplace[_-]?me\b/i.test(url)) return true;
  if (/\byour[_-]?subdomain\b/i.test(url)) return true;
  if (s.includes('changeme')) return true;
  if (s.includes('localhost') && s.includes('example')) return true;
  try {
    const host = new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase();
    if (host.startsWith('replace_me.') || host.startsWith('replace-me.')) return true;
    if (host.includes('replace_me') || host.includes('replace-me')) return true;
    if (host.startsWith('your_subdomain.') || host.startsWith('your-subdomain.')) return true;
  } catch {
    /* ignore */
  }
  return false;
}
