import { SKIP_PROTOCOLS, TRACKING_PARAMS } from './constants.js';

/**
 * Normalise a URL for deduplication comparison.
 * Returns null for URLs we cannot or should not touch.
 */
export function normaliseUrl(raw, removeTracking = true) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (SKIP_PROTOCOLS.has(url.protocol)) return null;

  // Lowercase protocol + hostname
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  // Remove default ports
  if ((url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }

  // Strip fragment
  url.hash = '';

  // Strip tracking params
  if (removeTracking) {
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }
  }

  // Upgrade http → https for near-duplicate comparison
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
  }

  // Strip www. prefix for near-duplicate comparison
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
  }

  // Normalise trailing slash: remove for non-root paths
  let href = url.toString();
  if (url.pathname !== '/' && href.endsWith('/')) {
    href = href.slice(0, -1);
  }

  return href;
}

/**
 * Extract the registrable domain (eTLD+1) from a hostname.
 * Uses a simple heuristic: last two labels normally, but keeps three
 * for known two-part TLDs like .co.uk, .com.au, .co.jp, etc.
 *
 * Limitation: not 100% accurate for all ccTLD variants — documented trade-off.
 */
export function registrableDomain(hostname) {
  if (!hostname) return null;
  const labels = hostname.split('.');
  if (labels.length <= 2) return hostname;

  const tld = labels.slice(-2).join('.');
  // Known two-part TLDs where we need three labels
  const TWO_PART_TLDS = new Set([
    'co.uk', 'co.in', 'co.jp', 'co.nz', 'co.za', 'co.kr',
    'com.au', 'com.br', 'com.cn', 'com.mx', 'com.ar', 'com.tr',
    'org.uk', 'net.au', 'gov.uk', 'ac.uk', 'me.uk',
  ]);
  if (TWO_PART_TLDS.has(tld) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return tld;
}

/**
 * Normalise a Google search query for deduplication.
 * Returns null if the URL is not a Google search.
 */
export function normaliseSearchQuery(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/\bgoogle\.[a-z.]{2,6}$/.test(url.hostname)) return null;
  if (url.pathname !== '/search') return null;
  const q = url.searchParams.get('q');
  if (!q) return null;
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}
