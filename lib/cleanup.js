import { getSettings } from './settings.js';
import { findDuplicates, findErrorTabs, findSearchDuplicates, findYoutubeDuplicates, findDiscardedTabs, findTransientTabs, findOrphanedTabs, findStuckTabs } from './analyze.js';
import { saveSnapshot } from './undo.js';

export async function removeDuplicates() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findDuplicates(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('removeDuplicates', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('removeDuplicates', settings.scope, tabs.length, result);
}

export async function closeErrorTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findErrorTabs(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeErrorTabs', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeErrorTabs', settings.scope, tabs.length, result);
}

export async function closeSearchDuplicates() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findSearchDuplicates(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeSearchDuplicates', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeSearchDuplicates', settings.scope, tabs.length, result);
}

export async function closeYoutubeDuplicates() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findYoutubeDuplicates(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeYoutubeDuplicates', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeYoutubeDuplicates', settings.scope, tabs.length, result);
}

export async function closeDiscardedTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findDiscardedTabs(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeDiscardedTabs', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeDiscardedTabs', settings.scope, tabs.length, result);
}

export async function closeTransientTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findTransientTabs(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeTransientTabs', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeTransientTabs', settings.scope, tabs.length, result);
}

export async function closeOrphanedTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findOrphanedTabs(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeOrphanedTabs', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeOrphanedTabs', settings.scope, tabs.length, result);
}

export async function closeStuckTabs() {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const result = findStuckTabs(tabs, settings);

  if (result.tabIds.length > 0) {
    await saveSnapshot('closeStuckTabs', result.preview);
    await chrome.tabs.remove(result.tabIds);
  }

  return buildResult('closeStuckTabs', settings.scope, tabs.length, result);
}

/**
 * Run all safe cleanups in order.
 * Includes all new detection types.
 */
export async function runAllCleanups() {
  const r1 = await removeDuplicates();
  const r2 = await closeErrorTabs();
  const r3 = await closeSearchDuplicates();
  const r4 = await closeYoutubeDuplicates();
  const r5 = await closeDiscardedTabs();
  const r6 = await closeTransientTabs();
  const r7 = await closeOrphanedTabs();
  const r8 = await closeStuckTabs();

  const steps = [r1, r2, r3, r4, r5, r6, r7, r8];
  return {
    success: true,
    action: 'runAll',
    scope: r1.scope,
    steps,
    totalClosed: steps.reduce((sum, r) => sum + r.closed, 0),
  };
}

// --- Helpers ---

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

function buildResult(action, scope, scanned, analysis) {
  return {
    success: true,
    action,
    scope,
    scanned,
    closed:  analysis.tabIds.length,
    matched: analysis.count,
    preview: analysis.preview,
  };
}
