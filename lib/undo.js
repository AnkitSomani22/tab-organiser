const SNAPSHOT_KEY = 'undoSnapshot';
const MAX_HISTORY  = 5;

/**
 * Save a snapshot of tabs that are about to be closed.
 * Stored in chrome.storage.session (cleared on browser restart).
 */
export async function saveSnapshot(action, closedTabs) {
  if (!closedTabs || closedTabs.length === 0) return;

  const entry = {
    type:      'close',
    action,
    timestamp: Date.now(),
    tabs: closedTabs.map(t => ({ id: t.id, title: t.title, url: t.url })),
  };

  await pushHistory(entry);
}

/**
 * Save a snapshot of tab groups that were just created.
 * Undo ungroups those tabs.
 */
export async function saveGroupSnapshot(action, groupIds) {
  if (!groupIds || groupIds.length === 0) return;

  // Collect tab IDs per group now, before anything changes
  const groups = [];
  for (const groupId of groupIds) {
    const tabs = await chrome.tabs.query({ groupId });
    if (tabs.length > 0) {
      groups.push({ groupId, tabIds: tabs.map(t => t.id) });
    }
  }
  if (groups.length === 0) return;

  const entry = {
    type:      'group',
    action,
    timestamp: Date.now(),
    tabs:      groups.flatMap(g => g.tabIds).map(id => ({ id })),
    groups,
  };

  await pushHistory(entry);
}

async function pushHistory(entry) {
  let { undoHistory = [] } = await chrome.storage.session.get('undoHistory');
  undoHistory.unshift(entry);
  if (undoHistory.length > MAX_HISTORY) undoHistory = undoHistory.slice(0, MAX_HISTORY);
  await chrome.storage.session.set({ undoHistory });
}

/**
 * Restore the most recent snapshot (undo last action).
 */
export async function undoLast() {
  const { undoHistory = [] } = await chrome.storage.session.get('undoHistory');
  if (undoHistory.length === 0) {
    return { success: false, error: 'Nothing to undo.' };
  }

  const [latest, ...rest] = undoHistory;
  await chrome.storage.session.set({ undoHistory: rest });

  if (latest.type === 'group') {
    return undoGroup(latest);
  }
  return undoClose(latest);
}

async function undoGroup(snapshot) {
  const allTabIds = snapshot.groups.flatMap(g => g.tabIds);
  let ungrouped = 0;
  let failed    = 0;

  try {
    await chrome.tabs.ungroup(allTabIds);
    ungrouped = allTabIds.length;
  } catch {
    // Fallback: ungroup per group in case some tabs were closed since
    for (const { tabIds } of snapshot.groups) {
      const existing = [];
      for (const id of tabIds) {
        try { await chrome.tabs.get(id); existing.push(id); } catch { failed++; }
      }
      if (existing.length > 0) {
        try { await chrome.tabs.ungroup(existing); ungrouped += existing.length; }
        catch { failed += existing.length; }
      }
    }
  }

  return {
    success:   true,
    action:    'undo',
    wasGroup:  true,
    restored:  ungrouped,
    failed,
  };
}

async function undoClose(snapshot) {
  const restored = [];
  const failed   = [];

  for (const tab of snapshot.tabs) {
    try {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
      const match = sessions.find(s => s.tab && s.tab.url === tab.url);
      if (match && match.tab) {
        await chrome.sessions.restore(match.sessionId);
      } else {
        await chrome.tabs.create({ url: tab.url, active: false });
      }
      restored.push(tab.url);
    } catch {
      failed.push(tab.url);
    }
  }

  return {
    success:  true,
    action:   'undo',
    restored: restored.length,
    failed:   failed.length,
  };
}

/**
 * Return the undo history for display in the popup.
 */
export async function getUndoHistory() {
  const { undoHistory = [] } = await chrome.storage.session.get('undoHistory');
  return undoHistory;
}
