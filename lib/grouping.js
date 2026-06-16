import { registrableDomain } from './normalize.js';
import { FRIENDLY_DOMAIN_NAMES, GROUP_COLORS, SKIP_PROTOCOLS } from './constants.js';
import { getSettings } from './settings.js';
import { saveGroupSnapshot } from './undo.js';

// Marker stored in group title so we don't re-group user-managed groups
const EXT_MARKER = '​'; // zero-width space prefix

/**
 * Analyse which tabs can be grouped (read-only).
 */
export async function analyseGrouping() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const groups = buildDomainMap(tabs, settings);
  const candidates = [...groups.entries()].filter(([, g]) => g.tabs.length >= 2);

  return {
    count: candidates.length,
    tabIds: candidates.flatMap(([, g]) => g.tabs.map(t => t.id)),
    preview: candidates.map(([domain, g]) => ({
      domain,
      label: g.label,
      tabCount: g.tabs.length,
      tabs: g.tabs.map(t => ({ id: t.id, title: t.title, url: t.url })),
    })),
  };
}

/**
 * Group tabs by registrable domain, per window.
 * Skips tabs already in an extension-created group.
 */
export async function groupByDomain() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);

  // Partition tabs by window
  const byWindow = new Map();
  for (const tab of tabs) {
    if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
    byWindow.get(tab.windowId).push(tab);
  }

  let groupsCreated = 0;
  let tabsGrouped = 0;
  const createdGroupIds = [];

  for (const [windowId, winTabs] of byWindow.entries()) {
    const domainMap = buildDomainMap(winTabs, settings);

    for (const [domain, group] of domainMap.entries()) {
      if (group.tabs.length < 2) continue;

      const tabIds = group.tabs.map(t => t.id);
      const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });

      await chrome.tabGroups.update(groupId, {
        title: EXT_MARKER + group.label,
        color: colorForDomain(domain),
        collapsed: false,
      });

      createdGroupIds.push(groupId);
      groupsCreated++;
      tabsGrouped += tabIds.length;
    }
  }

  await saveGroupSnapshot('groupByDomain', createdGroupIds);

  return {
    success: true,
    action: 'groupByDomain',
    groupsCreated,
    tabsGrouped,
  };
}

/**
 * Group tabs from a single domain (used by context menu).
 */
export async function groupDomainOf(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const domain = getDomain(tab.url);
  if (!domain) return { success: false, error: 'Cannot determine domain for this tab.' };

  const settings = await getSettings();
  const allTabs = await queryTabs(settings);
  const matching = allTabs.filter(t => getDomain(t.url) === domain && t.windowId === tab.windowId);

  if (matching.length < 2) {
    return { success: false, error: `Only one tab found for ${domain}.` };
  }

  const tabIds = matching.map(t => t.id);
  const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId: tab.windowId } });
  await chrome.tabGroups.update(groupId, {
    title: EXT_MARKER + labelForDomain(domain),
    color: colorForDomain(domain),
  });

  return { success: true, action: 'groupDomain', domain, tabsGrouped: tabIds.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDomainMap(tabs, settings) {
  const map = new Map(); // domain -> { label, tabs: [] }

  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    // Skip tabs already in an extension-managed group
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue;

    const domain = getDomain(tab.url);
    if (!domain) continue;

    if (!map.has(domain)) {
      map.set(domain, { label: labelForDomain(domain), tabs: [] });
    }
    map.get(domain).tabs.push(tab);
  }
  return map;
}

function getDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (SKIP_PROTOCOLS.has(u.protocol)) return null;
    return registrableDomain(u.hostname);
  } catch {
    return null;
  }
}

function labelForDomain(domain) {
  const friendly = FRIENDLY_DOMAIN_NAMES[domain];
  if (friendly) return friendly;
  const stripped = domain.replace(/^www\./, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1, 20);
}

// Deterministic colour from domain name
function colorForDomain(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

// ---------------------------------------------------------------------------
// Auto-group by time opened
// ---------------------------------------------------------------------------

const TIME_SLOTS = [
  { label: 'Morning',   start:  5, end: 12 },
  { label: 'Afternoon', start: 12, end: 17 },
  { label: 'Evening',   start: 17, end: 21 },
  { label: 'Night',     start: 21, end: 29 }, // 29 = 5am next day
];

/**
 * Group tabs by the time-of-day slot in which they were last accessed.
 * Tabs with no lastAccessed fall into "Older".
 * Only creates a group when ≥2 tabs share the same slot.
 */
export async function groupByTime() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const now = Date.now();

  // Partition tabs by window first (chrome.tabs.group cannot span windows)
  const byWindow = new Map();
  for (const tab of tabs) {
    if (tab.pinned && settings.skipPinnedTabs) continue;
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue;
    if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
    byWindow.get(tab.windowId).push(tab);
  }

  let groupsCreated = 0;
  let tabsGrouped = 0;
  const createdGroupIds = [];

  for (const [windowId, winTabs] of byWindow.entries()) {
    const slotMap = new Map();

    for (const tab of winTabs) {
      const slot = timeSlotFor(tab.lastAccessed ?? now);
      if (!slotMap.has(slot)) slotMap.set(slot, []);
      slotMap.get(slot).push(tab);
    }

    for (const [slotLabel, slotTabs] of slotMap.entries()) {
      if (slotTabs.length < 2) continue;
      const tabIds = slotTabs.map(t => t.id);
      const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(groupId, {
        title: slotLabel,
        color: colorForSlot(slotLabel),
        collapsed: false,
      });
      createdGroupIds.push(groupId);
      groupsCreated++;
      tabsGrouped += tabIds.length;
    }
  }

  await saveGroupSnapshot('groupByTime', createdGroupIds);

  return { success: true, action: 'groupByTime', groupsCreated, tabsGrouped };
}

function timeSlotFor(ts) {
  const hour = new Date(ts).getHours();
  for (const slot of TIME_SLOTS) {
    const end = slot.end > 24 ? slot.end - 24 : slot.end;
    if (slot.start <= slot.end) {
      if (hour >= slot.start && hour < slot.end) return slot.label;
    } else {
      // wraps midnight
      if (hour >= slot.start || hour < end) return slot.label;
    }
  }
  return 'Other';
}

const SLOT_COLORS = {
  Morning:   'yellow',
  Afternoon: 'blue',
  Evening:   'orange',
  Night:     'purple',
  Other:     'grey',
};

function colorForSlot(label) {
  return SLOT_COLORS[label] ?? 'grey';
}

