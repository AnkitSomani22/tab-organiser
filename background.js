import { dispatch } from './lib/actions.js';
import { initSettings, getSettings } from './lib/settings.js';
import {
  BADGE_COLOR_BLUE,
  BADGE_COLOR_YELLOW,
  BADGE_COLOR_RED,
  DEFAULT_SETTINGS,
} from './lib/constants.js';

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await initSettings();
  await updateBadge();
  registerContextMenus();
});

chrome.runtime.onStartup.addListener(updateBadge);

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  dispatch(message)
    .then(result => {
      sendResponse(result);
      updateBadge();
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true;
});

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    chrome.action.setBadgeText({ text: String(count) });

    const settings = await getSettings();
    const yellow = settings.tabLimitYellow ?? DEFAULT_SETTINGS.tabLimitYellow;
    const red    = settings.tabLimitRed    ?? DEFAULT_SETTINGS.tabLimitRed;

    let color = BADGE_COLOR_BLUE;
    if (count >= red)         color = BADGE_COLOR_RED;
    else if (count >= yellow) color = BADGE_COLOR_YELLOW;

    chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    // Service worker may be restarting; ignore
  }
}

// ---------------------------------------------------------------------------
// Context menus
// ---------------------------------------------------------------------------

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       'findDuplicates',
      title:    'Find & close duplicates of this tab',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id:       'groupDomain',
      title:    'Group all tabs from this domain',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;

  if (info.menuItemId === 'findDuplicates') {
    dispatch({ action: 'removeDuplicates' }).catch(() => {});
  }

  if (info.menuItemId === 'groupDomain') {
    dispatch({ action: 'groupDomainOf', tabId: tab.id }).catch(() => {});
  }
});
