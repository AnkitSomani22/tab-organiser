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
┌─────────────────────────────────────────────────────┐
│  Tab Organiser                   12 tabs  ↻  ⚙      │
├──────────┬──────────┬──────────┬─────────────────────┤
│  6 TODAY │  4 WEEK  │  2 OLDER │ Window │ All        │ ← age bar + scope
├──────────┴──────────┴──────────┴─────────────────────┤
│  ╔═══════════════════════════════════════════════╗   │
│  ║ 3 tabs can be closed                       ⓘ ║   │ ← suggestion card
│  ║ 2 duplicates, 1 error/auth                   ║   │
│  ║                                        [Fix] ║   │
│  ╚═══════════════════════════════════════════════╝   │
│  ╔═══════════════════════════════════════════════╗   │
│  ║ 1 domain group possible                    ⓘ ║   │
│  ║ GitHub (3)                                   ║   │
│  ║                                      [Group] ║   │
│  ╚═══════════════════════════════════════════════╝   │
├─────────────────────────────────────────────────────┤
│  [⚡ Focus] [✨ Smart Clean] [🧠 Smart Grouping]     │ ← quick actions
├─────────────────────────────────────────────────────┤
│  ✓ Closed 3 tabs                          ↩ Undo   │ ← result bar
└─────────────────────────────────────────────────────┘
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
| **⚡ Focus** | Keeps only the N most recently used tabs and closes everything else (pinned + audible always kept) |
| **✨ Smart Clean** | AI analyses all open tabs and recommends which to close. Shows a preview with reasons, then auto-closes after a countdown. Requires an Anthropic API key. |
| **🧠 Smart Grouping** | AI clusters your tabs into named topic groups (e.g. "React Research", "Holiday Planning") and creates Chrome tab groups automatically. Requires an Anthropic API key. |

The **✨ Smart Clean** and **🧠 Smart Grouping** buttons are hidden until an API key is configured (see [AI features](#ai-features) below).

### Age bar

The three segments at the top show how many tabs fall into each age bucket:
- **Today** (green) — accessed today
- **Week** (yellow) — accessed this week but not today
- **Older** (red) — not accessed in over a week

### Scope toggle

Switch between **Window** (current window only) and **All** (all windows) to control which tabs each action affects.

### Undo

Every destructive action saves a snapshot first. After any close or group action, an **↩ Undo** button appears in the result bar. The undo history persists for the duration of your browser session — reopening the popup does not lose it.

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
| Smart Clean countdown (s) | 5 | Seconds before Smart Clean or Smart Grouping auto-applies (1–30) |
| Orange badge at | 20 | Toolbar badge turns orange above this tab count |
| Red badge at | 30 | Toolbar badge turns red above this tab count |

---

## AI features

**Smart Clean** and **Smart Grouping** use the [Anthropic API](https://console.anthropic.com/) (Claude Haiku) to reason about your tabs. Both features are opt-in and only visible when a key is configured.

### Setup

Create a `config.local.json` file in the extension root (already git-ignored):

```json
{
  "apiKey": "sk-ant-...",
  "model": "claude-haiku-4-5-20251001",
  "baseUrl": ""
}
```

- **`apiKey`** — your Anthropic API key
- **`model`** — model to use (defaults to Haiku; change to any Claude model ID)
- **`baseUrl`** — override to point at a local proxy (e.g. `http://localhost:6655/anthropic`)

Reload the extension after creating the file. The two AI buttons appear in the quick row automatically.

### What gets sent

Only minimal, anonymised tab metadata is sent to the API:

- Tab title
- Domain (hostname only — no URL path, query params, or fragments)
- Age in hours since last access
- Pinned / audible flags

No full URLs, no page content, no personal data.

### Smart Clean

Analyses all open tabs and recommends which ones to close, categorised as:

| Category | Meaning |
|---|---|
| **read** | Article or page that has been fully consumed |
| **accidental** | Opened by mistake, no clear purpose |
| **redundant** | Intent already acted upon (search result, docs reference) |
| **low value** | Background reference that is unlikely to be revisited |

After analysis, a preview panel shows the recommended tabs with a reason for each. A countdown begins — the tabs close automatically when it reaches zero. Cancel any time to abort.

### Smart Grouping

Analyses all open tabs and groups them by project or topic intent — not just domain. For example, three GitHub tabs and two Stack Overflow tabs researching the same problem will land in the same cluster rather than two separate domain groups.

The AI assigns each cluster a descriptive name and a Chrome tab group color. A preview shows the proposed clusters before anything is applied. The same countdown applies — groups are created when it reaches zero.

Both AI features support **Undo** via the standard ↩ Undo button.

### Cost

A typical invocation across 20–50 tabs costs approximately **$0.001–$0.005** using Claude Haiku.

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
git commit -m "v1.1.0"

# 3. tag — triggers the release workflow
git tag v1.1.0
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
├── config.local.json       Local AI config — git-ignored, create manually
└── lib/
    ├── actions.js          Central message dispatcher
    ├── ai.js               Anthropic API calls (Smart Clean + Smart Grouping prompts)
    ├── aicleanup.js        Smart Clean orchestration
    ├── aigrouping.js       Smart Grouping orchestration
    ├── analyze.js          Read-only tab analysis (all detection types)
    ├── cleanup.js          Destructive cleanup actions
    ├── constants.js        Shared constants, patterns, and default settings
    ├── grouping.js         Domain-based tab grouping
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

The extension also requests `http://localhost:*/` host permissions to support AI features. These are only used when `config.local.json` is present.

No browsing history, page content, or full URLs ever leave your browser.
