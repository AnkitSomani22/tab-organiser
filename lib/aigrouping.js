import { getSettings } from './settings.js';
import { buildTabPayload, callClaudeForClusters } from './ai.js';
import { saveGroupSnapshot } from './undo.js';
import { GROUP_COLORS } from './constants.js';

const EXT_MARKER = '​'; // zero-width space — same marker used by grouping.js

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

/**
 * Ask AI to propose clusters, return them enriched with tab metadata for preview.
 * Does NOT create any Chrome groups — pure analysis.
 */
export async function getAiClusters(aiConfig) {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const payload = buildTabPayload(tabs);

  if (payload.length < 2) {
    return { success: true, action: 'getAiClusters', clusters: [], scanned: tabs.length };
  }

  const { apiKey, model, baseUrl, provider, geminiApiKey, geminiModel } = aiConfig;
  const raw = await callClaudeForClusters(payload, apiKey, model, baseUrl, provider, geminiApiKey, geminiModel);

  const tabMap = new Map(tabs.map(t => [t.id, t]));
  const validColor = new Set(GROUP_COLORS);

  const clusters = raw
    .filter(c => Array.isArray(c.tabIds) && c.tabIds.length > 0 && typeof c.name === 'string')
    .map(c => ({
      name: c.name.slice(0, 50),
      color: validColor.has(c.color) ? c.color : 'grey',
      tabs: c.tabIds
        .filter(id => tabMap.has(id))
        .map(id => {
          const t = tabMap.get(id);
          return { id: t.id, title: t.title || '(no title)', url: t.url };
        }),
    }))
    .filter(c => c.tabs.length > 0);

  return { success: true, action: 'getAiClusters', clusters, scanned: tabs.length };
}

/**
 * Create Chrome tab groups from confirmed clusters and save undo snapshot.
 */
export async function applyAiClusters(clusters) {
  if (!clusters || clusters.length === 0) {
    return { success: true, action: 'applyAiClusters', groupsCreated: 0, tabsGrouped: 0 };
  }

  // Get current window id for grouping (clusters come from the popup so same window)
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const windowId = activeTab?.windowId;

  const createdGroupIds = [];
  let tabsGrouped = 0;

  for (const cluster of clusters) {
    if (cluster.tabs.length === 0) continue;
    const tabIds = cluster.tabs.map(t => t.id);

    try {
      const groupProps = windowId ? { tabIds, createProperties: { windowId } } : { tabIds };
      const groupId = await chrome.tabs.group(groupProps);
      await chrome.tabGroups.update(groupId, {
        title: EXT_MARKER + cluster.name,
        color: cluster.color,
        collapsed: false,
      });
      createdGroupIds.push(groupId);
      tabsGrouped += tabIds.length;
    } catch {
      // Skip clusters whose tabs were closed between preview and confirm
    }
  }

  await saveGroupSnapshot('applyAiClusters', createdGroupIds);

  return {
    success: true,
    action: 'applyAiClusters',
    groupsCreated: createdGroupIds.length,
    tabsGrouped,
  };
}
