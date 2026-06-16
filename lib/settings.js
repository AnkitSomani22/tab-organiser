import { DEFAULT_SETTINGS } from './constants.js';

// Returns the full settings object, merging defaults with whatever is stored.
export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

// Saves a partial or full settings object.
export async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
}

// Called on first install to write defaults if nothing is stored yet.
export async function initSettings() {
  const existing = await chrome.storage.sync.get(null);
  const missing = {};
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in existing)) missing[key] = val;
  }
  if (Object.keys(missing).length > 0) {
    await chrome.storage.sync.set(missing);
  }
}
