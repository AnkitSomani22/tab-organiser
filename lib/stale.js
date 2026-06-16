import { getSettings } from './settings.js';
import { saveSnapshot } from './undo.js';

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Stale tab detection
// ---------------------------------------------------------------------------

/**
 * Analyse tabs by age. Returns buckets: today, thisWeek, older.
 */
export async function analyseTabAge() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const now = Date.now();

  const buckets = { today: [], thisWeek: [], older: [] };

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    if (tab.audible && settings.skipAudibleTabs) continue;

    const age = now - (tab.lastAccessed ?? now);
    if (age < DAY_MS) {
      buckets.today.push(tabSummary(tab, age));
    } else if (age < 7 * DAY_MS) {
      buckets.thisWeek.push(tabSummary(tab, age));
    } else {
      buckets.older.push(tabSummary(tab, age));
    }
  }

  return {
    total:       tabs.length,
    todayCount:  buckets.today.length,
    weekCount:   buckets.thisWeek.length,
    olderCount:  buckets.older.length,
    buckets,
  };
}

/**
 * Find stale tabs (not accessed in staleDays days).
 */
export async function findStaleTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const now = Date.now();
  const threshold = (settings.staleDays ?? 3) * DAY_MS;

  const stale = [];
  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    if (tab.audible && settings.skipAudibleTabs) continue;
    const age = now - (tab.lastAccessed ?? 0);
    if (age >= threshold) {
      stale.push(tabSummary(tab, age));
    }
  }

  stale.sort((a, b) => b.ageMs - a.ageMs); // oldest first
  return { count: stale.length, tabs: stale };
}

/**
 * Close stale tabs — saves snapshot for undo first.
 */
export async function closeStaleTabs() {
  const result = await findStaleTabs();
  if (result.tabs.length === 0) {
    return { success: true, action: 'closeStaleTabs', closed: 0 };
  }

  await saveSnapshot('closeStaleTabs', result.tabs);
  await chrome.tabs.remove(result.tabs.map(t => t.id));

  return { success: true, action: 'closeStaleTabs', closed: result.tabs.length };
}

// ---------------------------------------------------------------------------
// Save and close
// ---------------------------------------------------------------------------

/**
 * Save stale tab URLs to local storage, then close them.
 * URLs are stored in chrome.storage.local under 'savedTabs'.
 */
export async function saveAndCloseStaleTabs() {
  const result = await findStaleTabs();
  if (result.tabs.length === 0) {
    return { success: true, action: 'saveAndClose', saved: 0, closed: 0 };
  }

  const entries = result.tabs.map(t => ({
    title:   t.title,
    url:     t.url,
    savedAt: Date.now(),
  }));

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs');
  // Deduplicate by URL before appending
  const existingUrls = new Set(savedTabs.map(t => t.url));
  const fresh = entries.filter(e => !existingUrls.has(e.url));
  await chrome.storage.local.set({ savedTabs: [...savedTabs, ...fresh] });

  await saveSnapshot('saveAndClose', result.tabs);
  await chrome.tabs.remove(result.tabs.map(t => t.id));

  return {
    success: true,
    action: 'saveAndClose',
    saved:  fresh.length,
    closed: result.tabs.length,
  };
}

/**
 * Return the saved tab queue.
 */
export async function getSavedTabs() {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs');
  return savedTabs;
}

/**
 * Remove a URL from the saved tab queue (called when user reopens it).
 */
export async function removeSavedTab(url) {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs');
  await chrome.storage.local.set({ savedTabs: savedTabs.filter(t => t.url !== url) });
}

/**
 * Reopen a saved tab and remove it from the queue.
 */
export async function reopenSavedTab(url) {
  await chrome.tabs.create({ url, active: true });
  await removeSavedTab(url);
  return { success: true };
}

/**
 * Clear the entire saved tabs queue.
 */
export async function clearSavedTabs() {
  await chrome.storage.local.set({ savedTabs: [] });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Close a tab group
// ---------------------------------------------------------------------------

/**
 * Close all tabs belonging to a given groupId.
 */
export async function closeGroup(groupId) {
  const tabs = await chrome.tabs.query({ groupId });
  if (tabs.length === 0) {
    return { success: false, error: 'Group not found or already empty.' };
  }

  await saveSnapshot('closeGroup', tabs.map(t => tabSummary(t, 0)));
  await chrome.tabs.remove(tabs.map(t => t.id));

  return { success: true, action: 'closeGroup', closed: tabs.length };
}

/**
 * Return all current tab groups with their tab counts (for the popup).
 */
export async function listGroups() {
  const settings = await getSettings();
  const allTabs = await queryTabs(settings);

  const grouped = allTabs.filter(t => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);
  const groupMap = new Map();

  for (const tab of grouped) {
    if (!groupMap.has(tab.groupId)) groupMap.set(tab.groupId, []);
    groupMap.get(tab.groupId).push(tab);
  }

  const groups = [];
  for (const [groupId, tabs] of groupMap.entries()) {
    try {
      const info = await chrome.tabGroups.get(groupId);
      groups.push({
        groupId,
        title:    info.title || '(unnamed)',
        color:    info.color,
        tabCount: tabs.length,
        tabs:     tabs.map(t => tabSummary(t, 0)),
      });
    } catch {
      // Group may have been removed; skip
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Focus mode
// ---------------------------------------------------------------------------

/**
 * Keep only the N most recently accessed tabs (configurable via settings.focusKeepCount).
 * Pinned and audible tabs are always kept regardless.
 * Closes everything else after saving a snapshot.
 */
export async function focusMode() {
  const settings = await getSettings();
  const keepCount = settings.focusKeepCount ?? 4;
  const tabs = await queryTabs(settings);

  const protected_ = tabs.filter(t => t.pinned || t.audible);
  const candidates = tabs.filter(t => !t.pinned && !t.audible);

  // Sort by lastAccessed descending — most recent first
  candidates.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));

  const keep  = candidates.slice(0, keepCount);
  const close = candidates.slice(keepCount);

  if (close.length === 0) {
    return { success: true, action: 'focusMode', closed: 0, kept: tabs.length };
  }

  await saveSnapshot('focusMode', close.map(t => tabSummary(t, 0)));
  await chrome.tabs.remove(close.map(t => t.id));

  return {
    success:   true,
    action:    'focusMode',
    closed:    close.length,
    kept:      keep.length + protected_.length,
    protected: protected_.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tabSummary(tab, ageMs) {
  return {
    id:       tab.id,
    title:    tab.title ?? '',
    url:      tab.url   ?? '',
    ageMs,
    ageLabel: formatAge(ageMs),
  };
}

function formatAge(ms) {
  if (ms < DAY_MS)       return 'Today';
  const days = Math.floor(ms / DAY_MS);
  if (days === 1)        return '1 day ago';
  if (days < 7)          return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1)       return '1 week ago';
  return `${weeks} weeks ago`;
}

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}
