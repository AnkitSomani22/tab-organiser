// Tracking params stripped during URL normalisation
export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gclsrc', 'fbclid', 'msclkid', 'dclid', 'twclid', 'ref',
  '_ga', '_gl', 'mc_cid', 'mc_eid',
];

// Protocols whose tabs we never touch
export const SKIP_PROTOCOLS = new Set([
  'chrome:', 'chrome-extension:', 'devtools:', 'about:', 'data:', 'javascript:',
]);

// Error URL prefixes that mark a tab as broken
export const ERROR_URL_PREFIXES = [
  'chrome-error://',
  'about:neterror',
];

// Error page URLs (exact match)
export const ERROR_URLS = new Set([
  'chrome://crashed/',
  'chrome://newtab/',
  'about:newtab',
]);

// Transient URL path/query patterns — one-time-use pages safe to close
export const TRANSIENT_URL_PATTERNS = [
  // OAuth / SSO callbacks
  /\/auth\/callback/i,
  /\/oauth\/callback/i,
  /\/sso\/callback/i,
  /[?&]code=[^&]{8}/,          // OAuth code param (min 8 chars to avoid false positives)
  /[?&]oauth_token=/i,
  /[?&]access_token=/i,

  // Payment / order confirmations
  /\/order[-_]?(confirmed|complete|success|thank)/i,
  /\/checkout\/(success|complete|confirmed|thank)/i,
  /\/payment\/(success|complete|confirmed)/i,
  /\/thank[-_]?you/i,
  /\/purchase[-_]?(complete|confirmed|success)/i,

  // Download completion
  /\/download\/(complete|success|done)/i,
  /[?&]downloaded=1/i,

  // Unsubscribe / email confirmations
  /\/unsubscribe\/(success|confirmed|complete)/i,
  /\/email[-_]?(confirmed|verified|unsubscribed)/i,
];

// Orphaned-popup detection: tab opened by another tab (openerTabId set) that no longer exists.
// Detected at runtime in analyze.js — no constants needed here.

// Error strings that Chrome sets as tab titles on error pages
export const ERROR_TITLE_FRAGMENTS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NETWORK_CHANGED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_CONNECTION_RESET',
  'ERR_SSL_PROTOCOL_ERROR',
  'ERR_CERT_',
  'ERR_EMPTY_RESPONSE',
  'ERR_TOO_MANY_REDIRECTS',
  'ERR_TUNNEL_CONNECTION_FAILED',
];

// Title patterns that indicate an authentication/session expiry page.
// These are matched case-insensitively against tab.title.
export const AUTH_EXPIRY_TITLE_PATTERNS = [
  /session\s*(expired|timeout|timed\s*out)/i,
  /your\s*session\s*has\s*(ended|expired)/i,
  /signed?\s*out/i,
  /logged?\s*out/i,
  /login\s*required/i,
  /authentication\s*(required|expired|failed)/i,
  /access\s*(denied|expired)/i,
  /token\s*(expired|invalid)/i,
  /unauthorized/i,
];

// URL path fragments that strongly indicate an auth expiry redirect.
// Matched against the full URL (pathname + search).
export const AUTH_EXPIRY_URL_PATTERNS = [
  /[?&]session(expired|timeout)=1/i,
  /[?&]reason=(session_expired|token_expired|auth_expired)/i,
  /\/session[-_]expired/i,
  /\/auth[-_]expired/i,
  /\/logged[-_]?out/i,
  /\/signed[-_]?out/i,
  /\/timeout/i,
];

// Friendly display names for well-known domains
export const FRIENDLY_DOMAIN_NAMES = {
  'google.com':         'Google',
  'github.com':         'GitHub',
  'youtube.com':        'YouTube',
  'stackoverflow.com':  'Stack Overflow',
  'notion.so':          'Notion',
  'figma.com':          'Figma',
  'linear.app':         'Linear',
  'atlassian.net':      'Atlassian',
  'twitter.com':        'Twitter',
  'x.com':              'X',
  'reddit.com':         'Reddit',
  'wikipedia.org':      'Wikipedia',
  'mdn.io':             'MDN',
  'developer.mozilla.org': 'MDN',
  'npmjs.com':          'npm',
  'vercel.com':         'Vercel',
  'netlify.com':        'Netlify',
  'medium.com':         'Medium',
  'dev.to':             'Dev.to',
};

// Chrome TabGroup colour palette (the only valid values)
export const GROUP_COLORS = [
  'blue', 'green', 'red', 'yellow', 'purple', 'cyan', 'orange', 'pink', 'grey',
];

// Default settings written to chrome.storage.sync on first install
export const DEFAULT_SETTINGS = {
  scope:                 'currentWindow',  // 'currentWindow' | 'allWindows'
  skipPinnedTabs:        true,
  skipAudibleTabs:       true,
  closeBlankTabs:        false,
  removeTrackingParams:  true,
  tabLimitYellow:        20,
  tabLimitRed:           30,
  staleDays:             3,    // tabs not accessed in N days are considered stale
  focusKeepCount:        4,    // number of recent tabs to keep in focus mode
};

// Badge colours
export const BADGE_COLOR_BLUE   = '#4A90D9';
export const BADGE_COLOR_YELLOW = '#E67E22';
export const BADGE_COLOR_RED    = '#E74C3C';
