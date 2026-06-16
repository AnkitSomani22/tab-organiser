// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([refreshTabCount(), refreshAgeBar()]);
  await restoreScope();
  await refreshAll();
  wireUp();
});

async function refreshAll() {
  renderLoading();
  try {
    const [analysis, stale, saved] = await Promise.all([
      msg('getAnalysis'),
      msg('getStaleTabs'),
      msg('getSavedTabs'),
    ]);
    renderSuggestions(analysis, stale);
    renderSavedPill(saved);
  } catch {
    renderError();
  }
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function renderLoading() {
  document.getElementById('suggestions').innerHTML =
    '<div class="loading-row">Analysing tabs…</div>';
}

function renderError() {
  document.getElementById('suggestions').innerHTML =
    '<div class="loading-row">Could not analyse tabs.</div>';
}

function renderSuggestions(analysis, stale) {
  const cards = [
    ...buildCleanCards(analysis),
    ...buildStaleCards(stale),
    ...buildGroupCards(analysis),
  ];

  const el = document.getElementById('suggestions');
  if (cards.length === 0) {
    el.innerHTML = '<div class="no-issues">✓ Tabs look clean</div>';
    return;
  }

  el.innerHTML = '';
  for (const { html, id, action, analysis: a, stale: s, instant } of cards) {
    el.insertAdjacentHTML('beforeend', html);
    wireCard(id, action, a, s, instant);
  }
}

function buildCleanCards(analysis) {
  const dupCount      = analysis.duplicates?.count    ?? 0;
  const errCount      = analysis.errorTabs?.count     ?? 0;
  const sdCount       = analysis.searchDupes?.count   ?? 0;
  const ytCount       = analysis.youtubeDupes?.count  ?? 0;
  const discCount     = analysis.discarded?.count     ?? 0;
  const transCount    = analysis.transient?.count     ?? 0;
  const orphanCount   = analysis.orphaned?.count      ?? 0;
  const stuckCount    = analysis.stuck?.count         ?? 0;
  const cleanTotal    = dupCount + errCount + sdCount + ytCount + discCount + transCount + orphanCount + stuckCount;
  if (cleanTotal === 0) return [];

  const parts = [];
  if (dupCount    > 0) parts.push(`${dupCount} duplicate${dupCount !== 1 ? 's' : ''}`);
  if (errCount    > 0) parts.push(`${errCount} error/auth`);
  if (sdCount     > 0) parts.push(`${sdCount} search dupe${sdCount !== 1 ? 's' : ''}`);
  if (ytCount     > 0) parts.push(`${ytCount} YouTube dupe${ytCount !== 1 ? 's' : ''}`);
  if (discCount   > 0) parts.push(`${discCount} discarded`);
  if (transCount  > 0) parts.push(`${transCount} transient`);
  if (orphanCount > 0) parts.push(`${orphanCount} orphaned`);
  if (stuckCount  > 0) parts.push(`${stuckCount} stuck`);

  const allTabs = [
    ...(analysis.duplicates?.preview   ?? []),
    ...(analysis.errorTabs?.preview    ?? []),
    ...(analysis.searchDupes?.preview  ?? []),
    ...(analysis.youtubeDupes?.preview ?? []),
    ...(analysis.discarded?.preview    ?? []),
    ...(analysis.transient?.preview    ?? []),
    ...(analysis.orphaned?.preview     ?? []),
    ...(analysis.stuck?.preview        ?? []),
  ];
  const tooltipLines = allTabs.slice(0, 15).map(t => '• ' + (t.title || '(no title)'));
  if (allTabs.length > 15) tooltipLines.push(`  …and ${allTabs.length - 15} more`);

  const tabWord = cleanTotal !== 1 ? 's' : '';
  return [makeCard({
    id: 'card-clean', action: 'runAll', analysis,
    title: `${cleanTotal} tab${tabWord} can be closed`,
    sub: parts.join(', '), fixLabel: 'Fix', fixClass: 'fix-clean',
    instant: true, tooltip: tooltipLines.join('\n'),
  })];
}

function buildStaleCards(stale) {
  const staleCount = stale?.count ?? 0;
  if (staleCount === 0) return [];

  const preview  = stale.tabs.slice(0, 3).map(t => t.title || t.url).join(', ');
  const overflow = staleCount > 3 ? ` +${staleCount - 3} more` : '';
  const tabWord  = staleCount !== 1 ? 's' : '';
  return [makeCard({
    id: 'card-stale', action: 'saveAndClose', stale,
    title: `${staleCount} stale tab${tabWord} (not used recently)`,
    sub: preview + overflow, fixLabel: 'Save & close', fixClass: 'fix-stale',
  })];
}

function buildGroupCards(analysis) {
  const grpCount = analysis.grouping?.count ?? 0;
  if (grpCount === 0) return [];

  const grpWord  = grpCount !== 1 ? 's' : '';
  const sub      = analysis.grouping?.preview?.slice(0, 3)
    .map(g => `${g.label} (${g.tabCount})`).join(', ') ?? '';

  const tooltipLines = (analysis.grouping?.preview ?? []).flatMap(g => {
    const tabWord = g.tabCount !== 1 ? 's' : '';
    return [`▸ ${g.label} (${g.tabCount} tab${tabWord})`,
            ...g.tabs.slice(0, 4).map(t => '  • ' + (t.title || '(no title)'))];
  });

  return [makeCard({
    id: 'card-group', action: 'groupByDomain', analysis,
    title: `${grpCount} domain group${grpWord} possible`,
    sub, fixLabel: 'Group', fixClass: 'fix-group',
    instant: true, tooltip: tooltipLines.join('\n'),
  })];
}

function makeCard({ id, title, sub, fixLabel, fixClass, action, analysis, stale, instant = false, tooltip = '' }) {
  const infoHtml = tooltip
    ? `<span class="info-icon" tabindex="0" aria-label="Preview">ⓘ<span class="info-tip">${escHtml(tooltip)}</span></span>`
    : '';
  const isDanger = action === 'saveAndClose' || action === 'closeStaleTabs';
  const doClass  = isDanger ? 'btn-do danger' : 'btn-do';
  const confirmSection = instant ? '' : `
      <div class="scard-confirm" id="${id}-confirm">
        ${buildConfirmHtml(action, analysis, stale)}
        <div class="confirm-actions">
          <button class="${doClass}" id="${id}-do">Run now</button>
          <button class="btn-cancel-inline" id="${id}-cancel">Cancel</button>
        </div>
      </div>`;
  return {
    id, action, analysis, stale, instant,
    html: `
    <div class="scard" id="${id}">
      <div class="scard-body">
        <div class="scard-title">${escHtml(title)} ${infoHtml}</div>
        <div class="scard-sub">${escHtml(sub)}</div>
      </div>
      <button class="scard-fix ${fixClass}" data-card="${id}">${escHtml(fixLabel)}</button>
      ${confirmSection}
    </div>`
  };
}

function buildConfirmHtml(action, analysis, stale) {
  if (action === 'runAll')      return confirmCleanHtml(analysis);
  if (action === 'saveAndClose' || action === 'closeStaleTabs') return confirmStaleHtml(action, stale);
  if (action === 'groupByDomain') return confirmGroupHtml(analysis);
  return '';
}

function confirmCleanHtml(analysis) {
  const tabs = [
    ...(analysis.duplicates?.preview    ?? []),
    ...(analysis.errorTabs?.preview     ?? []),
    ...(analysis.searchDupes?.preview   ?? []),
    ...(analysis.youtubeDupes?.preview  ?? []),
    ...(analysis.discarded?.preview     ?? []),
    ...(analysis.transient?.preview     ?? []),
    ...(analysis.orphaned?.preview      ?? []),
    ...(analysis.stuck?.preview         ?? []),
  ];
  const listItems = tabs.slice(0, 15).map(t => tabLi(t.title || shortenUrl(t.url))).join('');
  const more      = overflowLi(tabs.length, 15);
  return '<div class="confirm-desc">These tabs will be closed:</div>'
    + `<ul class="confirm-tab-list">${listItems}${more}</ul>`;
}

function confirmStaleHtml(action, stale) {
  const tabs    = stale?.tabs ?? [];
  const verb    = action === 'saveAndClose' ? 'Saved & closed' : 'Closed';
  const tabWord = tabs.length !== 1 ? 's' : '';
  const listItems = tabs.slice(0, 12).map(t => {
    const age = `<span style="color:#c0392b;font-size:10px">${escHtml(t.ageLabel)}</span>`;
    return `<li>${escHtml(t.title || t.url)} ${age}</li>`;
  }).join('');
  const more = overflowLi(tabs.length, 12);
  return `<div class="confirm-desc">${escHtml(verb)}: ${tabs.length} stale tab${tabWord}</div>`
    + `<ul class="confirm-tab-list">${listItems}${more}</ul>`;
}

function confirmGroupHtml(analysis) {
  const groups    = analysis.grouping?.preview ?? [];
  const listItems = groups.slice(0, 8).map(g => {
    const tabWord  = g.tabCount !== 1 ? 's' : '';
    const header   = `<li class="ctl-group">${escHtml(g.label)} — ${g.tabCount} tab${tabWord}</li>`;
    const children = g.tabs.slice(0, 4).map(t => tabLi(t.title || shortenUrl(t.url))).join('');
    return header + children;
  }).join('');
  return '<div class="confirm-desc">Groups to be created:</div>'
    + `<ul class="confirm-tab-list">${listItems}</ul>`;
}

function tabLi(text) {
  return `<li>${escHtml(text)}</li>`;
}

function overflowLi(total, shown) {
  return total > shown ? `<li style="color:#888">…and ${total - shown} more</li>` : '';
}

function wireCard(id, action, analysis, stale, instant) {
  const card   = document.getElementById(id);
  if (!card) return;
  const fixBtn = card.querySelector('.scard-fix');

  if (instant) {
    const originalLabel = fixBtn.textContent;
    fixBtn.addEventListener('click', async () => {
      fixBtn.disabled = true;
      fixBtn.textContent = '…';
      try {
        const result = await msg(action);
        showBottom(result);
        await Promise.all([refreshTabCount(), refreshAgeBar()]);
        await refreshAll();
      } catch (err) {
        showBottom({ success: false, error: err.message });
        fixBtn.disabled = false;
        fixBtn.textContent = originalLabel;
      }
    });
    return;
  }

  const doBtn     = document.getElementById(`${id}-do`);
  const cancelBtn = document.getElementById(`${id}-cancel`);

  fixBtn.addEventListener('click', () => {
    const expanded = card.classList.toggle('expanded');
    if (!expanded) collapseCard(card);
  });

  cancelBtn.addEventListener('click', () => collapseCard(card));

  doBtn.addEventListener('click', async () => {
    doBtn.disabled = true;
    doBtn.textContent = 'Running…';
    try {
      const result = await msg(action);
      collapseCard(card);
      showBottom(result);
      await Promise.all([refreshTabCount(), refreshAgeBar()]);
      await refreshAll();
    } catch (err) {
      showBottom({ success: false, error: err.message });
      doBtn.disabled = false;
      doBtn.textContent = 'Run now';
    }
  });
}

function collapseCard(card) {
  card.classList.remove('expanded');
}

// ---------------------------------------------------------------------------
// Age bar + tab count
// ---------------------------------------------------------------------------

async function refreshAgeBar() {
  try {
    const age = await msg('getTabAge');
    document.getElementById('age-today-n').textContent = age.todayCount;
    document.getElementById('age-week-n').textContent  = age.weekCount;
    document.getElementById('age-old-n').textContent   = age.olderCount;
  } catch { /* non-fatal */ }
}

async function refreshTabCount() {
  const tabs = await chrome.tabs.query({});
  document.getElementById('tab-count').textContent = `${tabs.length} tabs`;
}

// ---------------------------------------------------------------------------
// Saved pill
// ---------------------------------------------------------------------------

function renderSavedPill(saved) {
  const pill   = document.getElementById('saved-pill');
  const label  = document.getElementById('saved-pill-label');
  const drop   = document.getElementById('saved-drop');
  const arrow  = document.getElementById('saved-arrow');

  if (!saved || saved.length === 0) {
    pill.hidden = true;
    return;
  }

  pill.hidden = false;
  label.textContent = `${saved.length} saved tab${saved.length !== 1 ? 's' : ''}`;

  drop.innerHTML = '';
  for (const entry of saved) {
    const li   = document.createElement('li');
    const date = new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    li.innerHTML =
      `<span class="saved-t" title="${escHtml(entry.url)}">${escHtml(entry.title || entry.url)}</span>`
      + `<span style="font-size:10px;color:#aaa;flex-shrink:0">${escHtml(date)}</span>`
      + `<button class="open-saved-btn" data-url="${escHtml(entry.url)}">Open</button>`
      + `<button class="saved-clear-btn" data-url="${escHtml(entry.url)}" title="Remove">✕</button>`;
    drop.appendChild(li);
  }

  drop.querySelectorAll('.open-saved-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await msg('reopenSavedTab', { url: btn.dataset.url });
      const saved2 = await msg('getSavedTabs');
      renderSavedPill(saved2);
    });
  });
  drop.querySelectorAll('.saved-clear-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await msg('removeSavedTab', { url: btn.dataset.url });
      const saved2 = await msg('getSavedTabs');
      renderSavedPill(saved2);
    });
  });

  document.getElementById('saved-toggle').onclick = () => {
    const open = drop.hidden;
    drop.hidden  = !open;
    arrow.textContent = open ? '▾' : '▸';
  };
}

// ---------------------------------------------------------------------------
// Quick row
// ---------------------------------------------------------------------------

function wireUp() {
  // Scope
  document.querySelectorAll('.stog').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.stog').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await chrome.storage.sync.set({ scope: btn.dataset.scope });
      await refreshAll();
    });
  });

  // Refresh
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await Promise.all([refreshTabCount(), refreshAgeBar()]);
    await refreshAll();
  });

  // Settings
  document.getElementById('settings-btn').addEventListener('click', () => openSettingsView());
  document.getElementById('settings-back').addEventListener('click', () => closeSettingsView());

  // Group by time
  document.getElementById('group-time-btn').addEventListener('click', async () => {
    const result = await msg('groupByTime');
    showBottom(result);
    await refreshAll();
  });

  // Focus mode
  document.getElementById('focus-btn').addEventListener('click', async () => {
    const { focusKeepCount = 4 } = await chrome.storage.sync.get('focusKeepCount');
    const word = focusKeepCount !== 1 ? 'tabs' : 'tab';
    if (!confirm(`Keep only the ${focusKeepCount} most recent ${word}? Everything else will be closed.`)) return;
    const result = await msg('focusMode');
    showBottom(result);
    await Promise.all([refreshTabCount(), refreshAgeBar()]);
    await refreshAll();
  });

  // Undo
  document.getElementById('undo-btn').addEventListener('click', async () => {
    const result = await msg('undoLast');
    showBottom(result);
    await Promise.all([refreshTabCount(), refreshAgeBar()]);
    await refreshAll();
  });
}

// ---------------------------------------------------------------------------
// Bottom bar
// ---------------------------------------------------------------------------

function showBottom(result) {
  const bar    = document.getElementById('bottom-bar');
  const msgEl  = document.getElementById('bottom-msg');
  const undoBtn= document.getElementById('undo-btn');
  bar.hidden   = false;

  if (!result || !result.success) {
    bar.className = 'bottom-bar error';
    msgEl.textContent = result?.error ?? 'Something went wrong.';
    undoBtn.hidden = true;
    return;
  }

  bar.className = 'bottom-bar success';
  msgEl.textContent = buildResultText(result);
  undoBtn.hidden = !isUndoable(result.action);
}

function buildResultText(r) {
  if (r.action === 'undo')        return textUndo(r);
  if (r.action === 'runAll')      return textRunAll(r);
  if (r.action === 'groupByDomain' || r.action === 'groupByTime') return textGroup(r);
  if (r.action === 'closeGroup')  return textCloseGroup(r);
  if (r.action === 'focusMode')   return textFocusMode(r);
  if (r.action === 'saveAndClose' || r.action === 'closeStaleTabs') return textStale(r);
  if (r.closed > 0) {
    const tabWord = r.closed !== 1 ? 's' : '';
    return `✓ Closed ${r.closed} tab${tabWord}`;
  }
  return '✓ Done';
}

function textUndo(r) {
  const n        = r.restored;
  const tabWord  = n !== 1 ? 's' : '';
  const failNote = r.failed > 0 ? ` (${r.failed} failed)` : '';
  const verb     = r.wasGroup ? 'Ungrouped' : 'Restored';
  return `${verb} ${n} tab${tabWord}${failNote}`;
}

function textRunAll(r) {
  const total   = r.totalClosed ?? 0;
  const tabWord = total !== 1 ? 's' : '';
  return total > 0 ? `✓ Closed ${total} tab${tabWord}` : 'Nothing to clean up.';
}

function textGroup(r) {
  const g       = r.groupsCreated ?? 0;
  const grpWord = g !== 1 ? 's' : '';
  return g > 0
    ? `✓ ${r.tabsGrouped} tabs grouped into ${g} group${grpWord}`
    : 'No groups to create.';
}

function textCloseGroup(r) {
  const tabWord = r.closed !== 1 ? 's' : '';
  return `✓ Closed group (${r.closed} tab${tabWord})`;
}

function textFocusMode(r) {
  const pinNote = r.protected > 0 ? ` (${r.protected} pinned/audible kept)` : '';
  return `✓ Kept ${r.kept}, closed ${r.closed}${pinNote}`;
}

function textStale(r) {
  const verb    = r.action === 'saveAndClose' ? 'Saved & closed' : 'Closed';
  const tabWord = r.closed !== 1 ? 's' : '';
  return r.closed > 0 ? `✓ ${verb} ${r.closed} stale tab${tabWord}` : 'No stale tabs.';
}

function isUndoable(action) {
  return ['runAll', 'closeStaleTabs', 'saveAndClose', 'closeGroup', 'focusMode',
          'removeDuplicates', 'closeErrorTabs', 'closeSearchDuplicates',
          'groupByDomain', 'groupByTime'].includes(action);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function restoreScope() {
  const { scope = 'currentWindow' } = await chrome.storage.sync.get('scope');
  document.querySelectorAll('.stog').forEach(b => {
    b.classList.toggle('active', b.dataset.scope === scope);
  });
}

function msg(action, extra = {}) {
  return chrome.runtime.sendMessage({ action, ...extra });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortenUrl(url = '') {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch { return url; }
}

// ---------------------------------------------------------------------------
// Settings view
// ---------------------------------------------------------------------------

const SETTINGS_FIELDS = [
  { id: 's-scope',                key: 'scope',                type: 'select'   },
  { id: 's-skipPinnedTabs',       key: 'skipPinnedTabs',       type: 'checkbox' },
  { id: 's-skipAudibleTabs',      key: 'skipAudibleTabs',      type: 'checkbox' },
  { id: 's-closeBlankTabs',       key: 'closeBlankTabs',       type: 'checkbox' },
  { id: 's-removeTrackingParams', key: 'removeTrackingParams', type: 'checkbox' },
  { id: 's-staleDays',            key: 'staleDays',            type: 'number'   },
  { id: 's-focusKeepCount',       key: 'focusKeepCount',       type: 'number'   },
  { id: 's-tabLimitYellow',       key: 'tabLimitYellow',       type: 'number'   },
  { id: 's-tabLimitRed',          key: 'tabLimitRed',          type: 'number'   },
];

let saveFlashTimer = null;

let settingsAbortCtrl = null;

async function openSettingsView() {
  document.getElementById('main-view').hidden          = true;
  document.getElementById('settings-view').hidden      = false;
  document.getElementById('header-main-left').hidden   = true;
  document.getElementById('header-main-right').hidden  = true;
  document.getElementById('header-settings-left').hidden = false;

  if (settingsAbortCtrl) settingsAbortCtrl.abort();
  settingsAbortCtrl = new AbortController();
  const { signal } = settingsAbortCtrl;

  const stored = await chrome.storage.sync.get(SETTINGS_FIELDS.map(f => f.key));
  for (const { id, key, type } of SETTINGS_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (type === 'checkbox') el.checked = stored[key] ?? false;
    else el.value = stored[key] ?? '';

    const evt = type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => saveSettingField(key, type, el), { signal });
  }
}

function closeSettingsView() {
  document.getElementById('main-view').hidden          = false;
  document.getElementById('settings-view').hidden      = true;
  document.getElementById('header-main-left').hidden   = false;
  document.getElementById('header-main-right').hidden  = false;
  document.getElementById('header-settings-left').hidden = true;
}

async function saveSettingField(key, type, el) {
  let value;
  if (type === 'checkbox') value = el.checked;
  else if (type === 'number') value = parseInt(el.value, 10);
  else value = el.value;

  if (type === 'number' && Number.isNaN(value)) return;

  await chrome.storage.sync.set({ [key]: value });
  showSavedFlash();
}

function showSavedFlash() {
  const el = document.getElementById('sv-saved-flash');
  el.hidden = false;
  if (saveFlashTimer) clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => { el.hidden = true; }, 1200);
}
