/* ============================================================
   SETTINGS.JS — Global Settings Panel
   Auto-injects a settings button + popup into every page.
   Settings are persisted in localStorage and shared across pages.
   Include after utility.js, before any page-specific scripts.
   ============================================================ */

/* ════════════════════════════════════════
   THEME MAP
   Maps setting values to stylesheet filenames.
   The script finds the current theme <link> by its
   data-theme-sheet attribute and swaps its href.
   ════════════════════════════════════════ */

const THEME_SHEETS = {
  dark:  'dark.css',
  light: 'light.css',
};

/* ════════════════════════════════════════
   SETTING DEFINITIONS
   Each entry drives the UI automatically.
   Add new settings here — no other changes needed.
   ════════════════════════════════════════ */

const SETTINGS_SCHEMA = [
  {
    id: 'theme',
    label: 'Theme',
    type: 'segmented',
    options: [
      { value: 'dark',  label: 'Dark'  },
      { value: 'light', label: 'Light' },
    ],
    default: 'dark',
    apply(value) {
      applyTheme(value);
    },
  },
];


/* ════════════════════════════════════════
   THEME SWITCHER
   Finds the theme <link> tag by its
   data-theme-sheet attribute and replaces
   the filename portion of the href.
   ════════════════════════════════════════ */

function applyTheme(value) {
  const sheet = THEME_SHEETS[value];
  if (!sheet) return;

  const link = document.querySelector('link[data-theme-sheet]');
  if (!link) return;

  // Swap only the filename, preserve the path prefix
  const href = link.getAttribute('href');
  const newHref = href.replace(/[^/]+\.css$/, sheet);
  link.setAttribute('href', newHref);
}


/* ════════════════════════════════════════
   STORAGE
   ════════════════════════════════════════ */

const SETTINGS_KEY = 'app-settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getSetting(id) {
  const schema = SETTINGS_SCHEMA.find(s => s.id === id);
  const stored = loadSettings();
  return stored[id] ?? schema?.default;
}

function setSetting(id, value) {
  const settings = loadSettings();
  settings[id] = value;
  saveSettings(settings);

  const schema = SETTINGS_SCHEMA.find(s => s.id === id);
  if (schema?.apply) schema.apply(value);
}


/* ════════════════════════════════════════
   APPLY ALL — called on page load
   ════════════════════════════════════════ */

function applyAllSettings() {
  const settings = loadSettings();
  SETTINGS_SCHEMA.forEach(schema => {
    const value = settings[schema.id] ?? schema.default;
    if (schema.apply) schema.apply(value);
  });
}


/* ════════════════════════════════════════
   INJECT HTML
   ════════════════════════════════════════ */

function injectSettingsUI() {
  const btn = document.createElement('button');
  btn.id = 'settings-btn';
  btn.className = 'settings-btn';
  btn.setAttribute('aria-label', 'Open settings');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  `;

  const popup = document.createElement('div');
  popup.id = 'settings-popup';
  popup.className = 'settings-popup';
  popup.setAttribute('aria-hidden', 'true');

  const header = document.createElement('div');
  header.className = 'settings-popup__header';
  header.innerHTML = `<span class="settings-popup__title">Settings</span>`;

  const body = document.createElement('div');
  body.className = 'settings-popup__body';

  SETTINGS_SCHEMA.forEach(schema => {
    const current = getSetting(schema.id);
    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label';
    label.textContent = schema.label;

    const control = buildControl(schema, current);
    row.appendChild(label);
    row.appendChild(control);
    body.appendChild(row);
  });

  popup.appendChild(header);
  popup.appendChild(body);
  document.body.appendChild(btn);
  document.body.appendChild(popup);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.contains('settings-popup--open')
      ? closeSettingsPopup()
      : openSettingsPopup();
  });

  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && e.target !== btn) closeSettingsPopup();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettingsPopup();
  });
}

function openSettingsPopup() {
  document.getElementById('settings-popup')?.classList.add('settings-popup--open');
  document.getElementById('settings-popup')?.setAttribute('aria-hidden', 'false');
  document.getElementById('settings-btn')?.classList.add('settings-btn--active');
}

function closeSettingsPopup() {
  document.getElementById('settings-popup')?.classList.remove('settings-popup--open');
  document.getElementById('settings-popup')?.setAttribute('aria-hidden', 'true');
  document.getElementById('settings-btn')?.classList.remove('settings-btn--active');
}


/* ════════════════════════════════════════
   CONTROL BUILDERS
   ════════════════════════════════════════ */

function buildControl(schema, currentValue) {
  switch (schema.type) {
    case 'segmented': return buildSegmented(schema, currentValue);
    default:          return document.createTextNode('');
  }
}

function buildSegmented(schema, currentValue) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-segmented';

  schema.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'settings-segmented__btn' + (opt.value === currentValue ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.settings-segmented__btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setSetting(schema.id, opt.value);
    });
    wrap.appendChild(btn);
  });

  return wrap;
}


/* ════════════════════════════════════════
   INJECT CSS
   ════════════════════════════════════════ */

function injectSettingsCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .settings-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1001;
      width: 34px;
      height: 34px;
      border-radius: var(--radius-lg, 8px);
      border: 1px solid var(--color-border, #2e3448);
      background: var(--color-surface, #1e2230);
      color: var(--color-muted, #6b7299);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      box-shadow: var(--shadow-sm);
    }
    .settings-btn:hover {
      color: var(--color-text, #e8eaf6);
      border-color: var(--color-accent, #3a9faa);
      background: var(--color-surface-2, #252a3a);
    }
    .settings-btn--active {
      color: var(--color-accent, #3a9faa);
      border-color: var(--color-accent, #3a9faa);
      background: var(--color-accent-dim, rgba(58,159,170,0.12));
      transform: rotate(45deg);
    }

    .settings-popup {
      position: fixed;
      top: 58px;
      right: 16px;
      z-index: 1000;
      width: 240px;
      background: var(--color-surface, #1e2230);
      border: 1px solid var(--color-border, #2e3448);
      border-radius: var(--radius-2xl, 12px);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .settings-popup--open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    .settings-popup__header {
      padding: 14px 16px 12px;
      border-bottom: 1px solid var(--color-border, #2e3448);
    }
    .settings-popup__title {
      font-family: var(--font-ui, 'Space Mono', monospace);
      font-size: 9px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--color-muted, #6b7299);
    }

    .settings-popup__body {
      padding: 12px 0 4px;
    }

    .settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 16px 10px;
      gap: 12px;
    }
    .settings-row__label {
      font-family: var(--font-ui, 'Space Mono', monospace);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text, #e8eaf6);
      flex-shrink: 0;
    }

    .settings-segmented {
      display: flex;
      gap: 3px;
      background: var(--color-surface-3, #171a20);
      border: 1px solid var(--color-border, #2e3448);
      border-radius: var(--radius-md, 4px);
      padding: 2px;
    }
    .settings-segmented__btn {
      flex: 1;
      padding: 4px 10px;
      border: none;
      border-radius: calc(var(--radius-md, 4px) - 1px);
      background: transparent;
      color: var(--color-muted, #6b7299);
      font-family: var(--font-ui, 'Space Mono', monospace);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
      white-space: nowrap;
    }
    .settings-segmented__btn:hover {
      color: var(--color-text, #e8eaf6);
    }
    .settings-segmented__btn.active {
      background: var(--color-accent, #3a9faa);
      color: #0e1418;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
}


/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */

(function init() {
  injectSettingsCSS();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyAllSettings();
      injectSettingsUI();
    });
  } else {
    applyAllSettings();
    injectSettingsUI();
  }
})();