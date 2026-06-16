import { normaliseUrl, normaliseSearchQuery } from './normalize.js';
import { ERROR_URL_PREFIXES, ERROR_URLS, ERROR_TITLE_FRAGMENTS, AUTH_EXPIRY_TITLE_PATTERNS, AUTH_EXPIRY_URL_PATTERNS, TRANSIENT_URL_PATTERNS, SKIP_PROTOCOLS } from './constants.js';
import { getSettings } from './settings.js';
import { analyseGrouping } from './grouping.js';

/**
 * Run a read-only analysis of all tabs.
 * Returns a structured object — never closes or modifies any tab.
 */
export async function analyseTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);

  const duplicates    = findDuplicates(tabs, settings);
  const errorTabs     = findErrorTabs(tabs, settings);
  const searchDupes   = findSearchDuplicates(tabs, settings);
  const youtubeDupes  = findYoutubeDuplicates(tabs, settings);
  const discarded     = findDiscardedTabs(tabs, settings);
  const transient     = findTransientTabs(tabs, settings);
  const orphaned      = findOrphanedTabs(tabs, settings);
  const stuck         = findStuckTabs(tabs, settings);
  const grouping      = await analyseGrouping();

  return {
    totalTabs: tabs.length,
    scope:     settings.scope,
    duplicates,
    errorTabs,
    searchDupes,
    youtubeDupes,
    discarded,
    transient,
    orphaned,
    stuck,
    grouping,
  };
}

// --- Duplicate detection ---

export function findDuplicates(tabs, settings) {
  const seen = new Map();   // normalisedUrl -> tab kept so far
  const toClose = [];
  const skipped = { pinned: 0, audible: 0, unsupportedUrl: 0 };

  for (const tab of tabs) {
    if (shouldSkip(tab, settings, skipped)) continue;

    const key = normaliseUrl(tab.url, settings.removeTrackingParams);
    if (!key) { skipped.unsupportedUrl++; continue; }

    if (seen.has(key)) {
      const existing = seen.get(key);
      const keepNew = (!existing.pinned && tab.pinned)
        || (!tab.pinned && (tab.lastAccessed ?? 0) > (existing.lastAccessed ?? 0));
      if (keepNew) {
        toClose.push(existing.id);
        seen.set(key, tab);
      } else {
        toClose.push(tab.id);
      }
    } else {
      seen.set(key, tab);
    }
  }

  return makeResult(toClose, tabs);
}

// --- Error tab detection ---

export function findErrorTabs(tabs, settings) {
  const toClose = [];
  const skipped = { pinned: 0, audible: 0 };

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) { skipped.pinned++; continue; }
    if (tab.audible && settings.skipAudibleTabs) { skipped.audible++; continue; }
    if (isErrorTab(tab, settings)) {
      toClose.push(tab.id);
    }
  }

  return makeResult(toClose, tabs);
}

function isErrorTab(tab, settings) {
  const url   = tab.url   ?? '';
  const title = tab.title ?? '';

  if (ERROR_URLS.has(url)) return true;
  if (ERROR_URL_PREFIXES.some(p => url.startsWith(p))) return true;
  if (ERROR_TITLE_FRAGMENTS.some(f => title.includes(f))) return true;

  // Auth/session expiry: match title patterns
  if (AUTH_EXPIRY_TITLE_PATTERNS.some(re => re.test(title))) return true;

  // Auth/session expiry: match URL path/query patterns
  try {
    const u = new URL(url);
    if (!SKIP_PROTOCOLS.has(u.protocol)) {
      const urlTarget = u.pathname + u.search;
      if (AUTH_EXPIRY_URL_PATTERNS.some(re => re.test(urlTarget))) return true;
    }
  } catch {
    // unparseable URL — skip
  }

  if (settings.closeBlankTabs &&
      url === 'about:blank' &&
      !title &&
      tab.status === 'complete' &&
      !tab.active) {
    return true;
  }

  return false;
}

// --- Search duplicate detection ---

export function findSearchDuplicates(tabs, settings) {
  const groups = new Map();  // normalisedQuery -> [tab, ...]
  const skipped = { pinned: 0, audible: 0 };

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) { skipped.pinned++; continue; }
    if (tab.audible && settings.skipAudibleTabs) { skipped.audible++; continue; }
    const q = normaliseSearchQuery(tab.url);
    if (!q) continue;
    if (!groups.has(q)) groups.set(q, []);
    groups.get(q).push(tab);
  }

  const toClose = [];
  for (const tabList of groups.values()) {
    if (tabList.length < 2) continue;
    // Keep most recently accessed; fall back to highest tab.id
    tabList.sort((a, b) => {
      const la = a.lastAccessed ?? a.id;
      const lb = b.lastAccessed ?? b.id;
      return lb - la;
    });
    toClose.push(...tabList.slice(1).map(t => t.id));
  }

  return {
    count:   toClose.length,
    tabIds:  toClose,
    skipped,
    preview: toClose.map(id => {
      const t = tabs.find(t => t.id === id);
      return t ? { id: t.id, title: t.title, url: t.url } : null;
    }).filter(Boolean),
  };
}

// --- Helpers ---

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

function shouldSkip(tab, settings, skipped) {
  if (tab.pinned && settings.skipPinnedTabs) { skipped.pinned++; return true; }
  if (tab.audible && settings.skipAudibleTabs) { skipped.audible++; return true; }
  return false;
}

function makeResult(toClose, tabs) {
  return {
    count:   toClose.length,
    tabIds:  toClose,
    preview: toClose.map(id => {
      const t = tabs.find(t => t.id === id);
      return t ? { id: t.id, title: t.title, url: t.url } : null;
    }).filter(Boolean),
  };
}

// --- YouTube duplicate detection ---
// Tabs with the same ?v= param on youtube.com/watch are the same video.

export function findYoutubeDuplicates(tabs, settings) {
  const seen    = new Map(); // videoId -> first tab
  const toClose = [];

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    if (tab.audible && settings.skipAudibleTabs) continue;
    const vid = youtubeVideoId(tab.url);
    if (!vid) continue;
    if (seen.has(vid)) {
      toClose.push(tab.id);
    } else {
      seen.set(vid, tab.id);
    }
  }

  return makeResult(toClose, tabs);
}

function youtubeVideoId(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('youtube.com')) return null;
    if (u.pathname !== '/watch') return null;
    return u.searchParams.get('v') ?? null;
  } catch { return null; }
}

// --- Discarded tab detection ---
// Chrome sets tab.discarded=true when it evicts a tab from memory.
// These tabs reload on click — they are safe to close if unused.

export function findDiscardedTabs(tabs, settings) {
  const toClose = tabs
    .filter(tab => tab.discarded
      && !(tab.pinned && settings.skipPinnedTabs)
      && !(tab.audible && settings.skipAudibleTabs))
    .map(t => t.id);

  return makeResult(toClose, tabs);
}

// --- Transient URL detection ---
// One-time-use pages: OAuth callbacks, order confirmations, download complete, unsubscribe.

export function findTransientTabs(tabs, settings) {
  const toClose = [];

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    if (tab.audible && settings.skipAudibleTabs) continue;
    if (!tab.url) continue;

    try {
      const u = new URL(tab.url);
      if (SKIP_PROTOCOLS.has(u.protocol)) continue;
      const target = u.pathname + u.search;
      if (TRANSIENT_URL_PATTERNS.some(re => re.test(target))) {
        toClose.push(tab.id);
      }
    } catch { /* unparseable */ }
  }

  return makeResult(toClose, tabs);
}

// --- Orphaned popup detection ---
// Tabs opened by another tab (openerTabId set) whose opener no longer exists.

export function findOrphanedTabs(tabs, settings) {
  const tabIds  = new Set(tabs.map(t => t.id));
  const toClose = tabs
    .filter(tab =>
      tab.openerTabId != null
      && !tabIds.has(tab.openerTabId)
      && !(tab.pinned  && settings.skipPinnedTabs)
      && !(tab.audible && settings.skipAudibleTabs))
    .map(t => t.id);

  return makeResult(toClose, tabs);
}

// --- Stuck tab detection ---
// Tabs still in 'loading' state that haven't been accessed in over 5 minutes.

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

export function findStuckTabs(tabs, settings) {
  const now     = Date.now();
  const toClose = tabs
    .filter(tab => {
      if (tab.status !== 'loading') return false;
      if (tab.pinned  && settings.skipPinnedTabs)  return false;
      if (tab.audible && settings.skipAudibleTabs) return false;
      const age = now - (tab.lastAccessed ?? now);
      return age > STUCK_THRESHOLD_MS;
    })
    .map(t => t.id);

  return makeResult(toClose, tabs);
}
