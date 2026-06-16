import { getSettings, saveSettings } from './lib/settings.js';

const FIELDS = [
  { id: 'scope',                type: 'select'   },
  { id: 'skipPinnedTabs',       type: 'checkbox' },
  { id: 'skipAudibleTabs',      type: 'checkbox' },
  { id: 'closeBlankTabs',       type: 'checkbox' },
  { id: 'removeTrackingParams', type: 'checkbox' },
  { id: 'staleDays',            type: 'number'   },
  { id: 'focusKeepCount',       type: 'number'   },
  { id: 'tabLimitYellow',       type: 'number'   },
  { id: 'tabLimitRed',          type: 'number'   },
];

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getSettings();
  for (const field of FIELDS) {
    const el = document.getElementById(field.id);
    if (!el) continue;
    if (field.type === 'checkbox') el.checked = settings[field.id];
    else el.value = settings[field.id];
  }
  document.getElementById('save-btn').addEventListener('click', saveAll);
});

async function saveAll() {
  const partial = {};
  for (const field of FIELDS) {
    const el = document.getElementById(field.id);
    if (!el) continue;
    if (field.type === 'checkbox')    partial[field.id] = el.checked;
    else if (field.type === 'number') partial[field.id] = parseInt(el.value, 10);
    else                              partial[field.id] = el.value;
  }
  await saveSettings(partial);
  const status = document.getElementById('save-status');
  status.hidden = false;
  setTimeout(() => { status.hidden = true; }, 1800);
}
