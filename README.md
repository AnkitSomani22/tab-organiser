# Tab Organiser

A lightweight Chrome extension (Manifest V3) that intelligently cleans up, organises, and helps you stay on top of browser tabs — without fear of losing anything important.

---

## Installation

### From GitHub Releases (recommended)

1. Go to the [Releases page](../../releases) and download the latest `tab-organiser.zip`
2. Unzip the file
3. Open `chrome://extensions` in Chrome
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the unzipped folder
6. The extension icon appears in your toolbar — click it to open the popup

> **Note:** Developer mode must stay enabled for the extension to keep working. Chrome may occasionally show a notification about it — just dismiss it.

### Updating to a newer release

1. Download the new ZIP from the [Releases page](../../releases)
2. Unzip and replace the old folder contents
3. Go to `chrome://extensions` and click the **↻** refresh icon on the Tab Organiser card

---

## How to use

### Popup overview

Click the extension icon to open the popup. It analyses your tabs instantly and shows smart suggestion cards.

```
┌─────────────────────────────────────────┐
│  Tab Organiser          8 tabs  ↻  ⚙   │
├──────────┬──────────┬──────────┬────────┤
│  6 TODAY │  2 WEEK  │  0 OLDER │ Window │ ← age bar + scope
├──────────┴──────────┴──────────┴────────┤
│  ╔══════════════════════════════════╗   │
│  ║ 3 tabs can be closed          ⓘ ║   │ ← suggestion card
│  ║ 2 duplicates, 1 error/auth      ║   │
│  ║                           [Fix] ║   │
│  ╚══════════════════════════════════╝   │
│  ╔══════════════════════════════════╗   │
│  ║ 1 domain group possible       ⓘ ║   │
│  ║ Google (2)                       ║   │
│  ║                         [Group] ║   │
│  ╚══════════════════════════════════╝   │
├─────────────────────────────────────────┤
│  [🕐 Group by time] [⚡ Focus]          │ ← quick actions
├─────────────────────────────────────────┤
│  ✓ Closed 3 tabs              ↩ Undo   │ ← result bar
└─────────────────────────────────────────┘
```

### Suggestion cards

Cards appear automatically when there is something to act on. Each is **one click** to execute.

| Card | What triggers it | Action |
|---|---|---|
| **N tabs can be closed** | Duplicates, errors, auth-expired, stale searches, YouTube dupes, discarded, transient, orphaned, or stuck tabs detected | **Fix** — closes all in one go |
| **N stale tabs** | Tabs not accessed within your configured threshold | **Save & close** — saves URLs to the Saved queue then closes |
| **N domain groups possible** | 2+ tabs from the same domain | **Group** — groups them into a Chrome tab group |

Hover the **ⓘ** icon on any card to preview exactly which tabs will be affected before clicking.

### Quick actions row

| Button | What it does |
|---|---|
| **🕐 Group by time** | Groups tabs by the time slot they were last accessed: Morning / Afternoon / Evening / Night |
| **⚡ Focus** | Keeps only the N most recently used tabs and closes everything else (pinned + audible always kept) |

### Age bar

The three segments at the top show how many tabs fall into each age bucket:
- **Today** (green) — accessed today
- **Week** (yellow) — accessed this week but not today
- **Older** (red) — not accessed in over a week

### Scope toggle

Switch between **Window** (current window only) and **All** (all windows) to control which tabs each action affects.

### Undo

Every destructive action saves a snapshot first. After any close or group action, an **↩ Undo** button appears in the result bar. Click it to restore.

- Close actions: reopens the tabs (uses Chrome's session history where possible)
- Group actions: ungroups the tabs that were just grouped

### Saved tabs queue

When you use **Save & close** on stale tabs, their URLs are saved here. The queue persists across browser restarts.

- Click the **saved tabs** pill at the bottom of the popup to expand it
- **Open** any saved tab to reopen it (removes it from the queue)
- **✕** removes a tab from the queue without reopening

### Context menu

Right-click any webpage tab for two quick actions:

- **Find & close duplicates of this tab** — runs duplicate removal
- **Group all tabs from this domain** — groups all tabs matching the right-clicked tab's domain

### Settings (⚙)

Click the **⚙** icon in the header to open inline settings. All changes save automatically.

| Setting | Default | Description |
|---|---|---|
| Default scope | This window | Whether actions apply to the current window or all windows |
| Skip pinned tabs | On | Pinned tabs are never closed or moved |
| Skip audible tabs | On | Tabs playing audio are left untouched |
| Close blank tabs | Off | Optionally close untitled about:blank tabs |
| Strip tracking params | On | Removes utm_*, gclid, fbclid etc. before comparing URLs |
| Stale after (days) | 3 | Tabs not accessed in this many days appear in the stale card |
| Focus keeps (tabs) | 4 | Number of most-recent tabs to keep when Focus Mode runs |
| Orange badge at | 20 | Toolbar badge turns orange above this tab count |
| Red badge at | 30 | Toolbar badge turns red above this tab count |

---

## What gets detected

| Type | Signal |
|---|---|
| **Duplicate tabs** | Same URL (tracking params stripped, http/https and www normalised). Keeps the most recently accessed copy |
| **Error tabs** | Chrome error pages, crashed tabs, network errors (ERR_*) |
| **Auth-expired tabs** | Title patterns like "Session Expired", "Logged out", "Unauthorized"; URL patterns like `/session-expired`, `?reason=token_expired` |
| **Search duplicates** | Multiple tabs with the same Google search query — keeps the most recent |
| **YouTube duplicates** | Multiple tabs with the same `?v=` video ID |
| **Discarded tabs** | Tabs Chrome evicted from memory (`tab.discarded === true`) |
| **Transient tabs** | One-time-use pages: OAuth callbacks, order confirmations, download-complete, unsubscribe pages |
| **Orphaned tabs** | Tabs opened by another tab whose opener no longer exists |
| **Stuck tabs** | Tabs stuck in `loading` state for more than 5 minutes |
| **New tab pages** | Empty `chrome://newtab/` pages |

---

## Releasing a new version

Tag a commit and the GitHub Actions workflow builds and publishes the ZIP automatically:

```bash
# 1. bump "version" in manifest.json
# 2. commit
git add .
git commit -m "v1.0.1"

# 3. tag — triggers the release workflow
git tag v1.0.1
git push origin main --tags
```

The workflow creates a GitHub Release with `tab-organiser.zip` attached and installation instructions.

---

## File structure

```
├── manifest.json           MV3 manifest
├── background.js           Service worker — badge, message routing, context menus
├── popup.html/css/js       Popup UI
├── settings.html/js        Options page (accessible via chrome://extensions)
└── lib/
    ├── actions.js          Central message dispatcher
    ├── analyze.js          Read-only tab analysis (all detection types)
    ├── cleanup.js          Destructive cleanup actions
    ├── constants.js        Shared constants, patterns, and default settings
    ├── grouping.js         Domain grouping and time-based grouping
    ├── normalize.js        URL normalisation and search query parsing
    ├── settings.js         chrome.storage.sync read/write helpers
    ├── stale.js            Stale detection, age breakdown, focus mode, save-and-close
    └── undo.js             Snapshot and restore logic
```

---

## Permissions used

| Permission | Why |
|---|---|
| `tabs` | Read tab URLs, titles, and state |
| `tabGroups` | Create and manage Chrome tab groups |
| `storage` | Save settings, saved-tab queue, and undo history |
| `sessions` | Restore recently closed tabs on undo |
| `contextMenus` | Right-click menu actions on tabs |

No data is sent anywhere. Everything stays in your browser.
