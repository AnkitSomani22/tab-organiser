import { getSettings } from './settings.js';
import { buildTabPayload, callClaude } from './ai.js';
import { saveSnapshot } from './undo.js';

async function queryTabs(settings) {
  if (settings.scope === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

export async function getSmartSuggestions(aiConfig) {
  const settings = await getSettings();
  const tabs = await queryTabs(settings);
  const payload = buildTabPayload(tabs);

  if (payload.length === 0) {
    return { success: true, action: 'getSmartSuggestions', suggestions: [], scanned: tabs.length };
  }

  const { apiKey, model, baseUrl, provider, geminiApiKey, geminiModel } = aiConfig;
  const suggestions = await callClaude(payload, apiKey, model, baseUrl, provider, geminiApiKey, geminiModel);

  // Enrich suggestions with full tab metadata for display
  const tabMap = new Map(tabs.map(t => [t.id, t]));
  const enriched = suggestions
    .filter(s => tabMap.has(s.tabId))
    .map(s => {
      const t = tabMap.get(s.tabId);
      return { tabId: s.tabId, title: t.title || '(no title)', url: t.url, category: s.category, reason: s.reason };
    });

  return { success: true, action: 'getSmartSuggestions', suggestions: enriched, scanned: tabs.length };
}

export async function closeSmartSuggestions(tabIds) {
  if (!tabIds || tabIds.length === 0) {
    return { success: true, action: 'closeSmartSuggestions', closed: 0 };
  }

  const tabs = await chrome.tabs.query({});
  const tabsToClose = tabs.filter(t => tabIds.includes(t.id));

  await saveSnapshot('closeSmartSuggestions', tabsToClose);
  await chrome.tabs.remove(tabIds);

  return { success: true, action: 'closeSmartSuggestions', closed: tabIds.length };
}
