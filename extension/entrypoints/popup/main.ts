import '@/assets/ui.css';
import './style.css';
import { browser } from 'wxt/browser';
import { episodeLine } from '@/lib/activity';
import { BRIDGE_VERSION, RELEASES_URL, bridgeDownload, olderThan } from '@/lib/config';
import { getSettings, saveSettings, siteConf, type Settings } from '@/lib/settings';
import { SITES, siteById } from '@/lib/sites';
import type { Status, UiMessage, UpdateInfo } from '@/lib/types';
import { bg, cat, clock, el, siteTiles } from '@/lib/ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = (msg: UiMessage) => browser.runtime.sendMessage(msg).catch(() => {});

let settings: Settings;
let status: Status | undefined;
let tab: 'now' | 'sites' | 'settings' = 'now';
let release: UpdateInfo | undefined;
const VERSION = browser.runtime.getManifest().version;
const hasUpdate = () => !!release?.latest && olderThan(VERSION, release.latest);

const snoozed = () => settings.snoozeUntil > Date.now();
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// --- header ---

function renderHeader() {
  const shown = status?.showing;
  const site = shown ? siteById(shown.media.site) : undefined;
  let air: 'live' | 'paused' | 'off' = 'off';
  let text = 'Off air';

  if (!settings.enabled) text = 'Sharing is off';
  else if (snoozed()) text = `Snoozed until ${timeOf(settings.snoozeUntil)}`;
  else if (shown && site) {
    air = shown.media.playing ? 'live' : 'paused';
    text = `${shown.media.playing ? 'On air' : 'Paused'} · ${site.name}`;
  }
  document.body.dataset.air = air;
  $('air').textContent = text;
  $<HTMLInputElement>('enabled').checked = settings.enabled;
}

// --- now tab ---

function setupCard(): HTMLElement {
  const downloads = bridgeDownload();
  return el(
    'div',
    { className: 'card empty setup' },
    el('strong', { textContent: 'Connect to Discord' }),
    el('p', { textContent: 'Xpresence needs its small helper app to talk to Discord. It takes a few seconds.' }),
    el(
      'ol',
      {},
      el('li', {}, el('span', {}, 'Download the helper', el('small', { textContent: 'About 300 KB, no installer' }))),
      el('li', {}, el('span', {}, 'Open it once', el('small', { textContent: 'It sets itself up and closes' }))),
      el('li', {}, el('span', {}, 'Come back here', el('small', { textContent: 'This page updates on its own' }))),
    ),
    el(
      'div',
      { className: 'actions' },
      ...downloads.map((d, i) => el('a', { className: `btn${i ? '' : ' primary'}`, href: d.url, textContent: d.label })),
    ),
  );
}

function emptyCard(): HTMLElement {
  let head = 'Nothing playing';
  let body = 'Play something on a site you share and it shows up here.';
  if (!settings.enabled) {
    head = 'Sharing is off';
    body = 'Flip the switch up top to go back on air.';
  } else if (snoozed()) {
    head = 'Snoozed';
    body = `Nothing is shared until ${timeOf(settings.snoozeUntil)}.`;
  } else if (!SITES.some((s) => siteConf(settings, s.id).on)) {
    head = 'Pick your sites';
    body = 'Choose which sites Xpresence is allowed to share.';
  }

  const card = el('div', { className: 'card empty' }, el('strong', { textContent: head }), el('p', { textContent: body }));

  const on = SITES.filter((s) => siteConf(settings, s.id).on);
  if (on.length && settings.enabled && !snoozed()) {
    const row = el('div', { className: 'onsites', title: 'Sites you share' });
    for (const s of on) {
      const m = el('span', { className: 'mono', textContent: s.name.charAt(0), title: s.name });
      m.style.setProperty('--c', s.color ?? 'var(--raise)');
      if (s.color === '#f5f5f7') m.style.color = '#111';
      row.append(m);
    }
    card.append(row);
  }
  if (!on.length) {
    const go = el('button', { className: 'btn primary', type: 'button', textContent: 'Choose sites' });
    go.onclick = () => openTab('sites');
    card.append(el('div', { className: 'actions' }, go));
  }
  return card;
}

function mediaCard(): HTMLElement {
  const shown = status!.showing!;
  const m = shown.media;
  const site = siteById(m.site);
  const pic = shown.hidden ? m.siteIcon : (m.poster ?? m.siteIcon);

  const card = el('div', { className: 'card' });
  card.style.setProperty('--art', bg(pic));

  const art = el('div', { className: 'art' });
  art.style.backgroundImage = bg(pic);
  if (!shown.hidden && m.poster && m.siteIcon) {
    const badge = el('span', { className: 'badge' });
    badge.style.backgroundImage = bg(m.siteIcon);
    art.append(badge);
  }

  const line = shown.hidden ? 'Title hidden on Discord' : m.kind === 'live' ? 'Live' : episodeLine(m);
  card.append(
    el(
      'div',
      { className: 'media' },
      art,
      el(
        'div',
        {},
        el('div', { className: 'where', textContent: `${m.playing ? 'Watching' : 'Paused'} on ${site?.name ?? 'the web'}` }),
        el('div', { className: 'title', textContent: shown.hidden ? (site?.name ?? '') : m.title }),
        line ? el('div', { className: 'state', textContent: line }) : null,
      ),
    ),
  );

  if (!shown.hidden && m.duration && m.position != null && m.kind !== 'live') {
    const pos = Math.min(m.duration, m.playing && status ? m.position + (Date.now() - status.updatedAt) / 1000 : m.position);
    const fill = el('span');
    fill.style.width = `${(pos / m.duration) * 100}%`;
    card.append(
      el(
        'div',
        { className: 'bar' },
        el('span', { textContent: clock(pos) }),
        el('div', { className: 'fill' }, fill),
        el('span', { textContent: clock(m.duration) }),
      ),
    );
  }

  const actions = el('div', { className: 'actions' });
  const open = el('button', { className: 'btn', type: 'button', textContent: 'Go to tab' });
  open.onclick = async () => {
    const t = await browser.tabs.update(shown.tabId, { active: true }).catch(() => undefined);
    if (t?.windowId != null) await browser.windows.update(t.windowId, { focused: true });
    window.close();
  };
  actions.append(open);
  if (!shown.hidden) {
    const hide = el('button', { className: 'btn', type: 'button', textContent: 'Keep this one private' });
    hide.title = 'Adds it to your private titles, so Discord only shows the site';
    hide.onclick = () => void send({ type: 'hideTitle', title: m.title });
    actions.append(hide);
  }
  card.append(actions);
  return card;
}

function snoozeRow(): HTMLElement | null {
  if (!settings.enabled) return null;
  const row = el('div', { className: 'row' });
  if (snoozed()) {
    const resume = el('button', { className: 'btn', type: 'button', textContent: 'Resume now' });
    resume.onclick = () => update((s) => (s.snoozeUntil = 0));
    row.append(el('span', { className: 'note', textContent: `Snoozed until ${timeOf(settings.snoozeUntil)}` }), resume);
    return row;
  }
  const hour = el('button', { className: 'btn', type: 'button', textContent: '1 hour' });
  hour.onclick = () => update((s) => (s.snoozeUntil = Date.now() + 3_600_000));
  const night = el('button', { className: 'btn', type: 'button', textContent: 'Until midnight' });
  night.onclick = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    void update((s) => (s.snoozeUntil = d.getTime()));
  };
  row.append(el('span', { className: 'label', textContent: 'Snooze' }), hour, night);
  return row;
}

function healthLine(): HTMLElement | null {
  if (!status) return null;
  const item = (good: boolean | null, text: string) =>
    el('span', { className: good == null ? '' : good ? 'good' : 'bad' }, el('i', { className: 'dot' }), text);
  const box = el('div', { className: 'health' });
  const b = status.bridge;

  if (b === 'idle' || b === 'connecting') box.append(item(null, 'Checking the helper app…'));
  else if (b === 'connected') {
    box.append(item(true, 'Helper running'));
    box.append(
      item(
        status.discord === 'connected',
        status.discord === 'connected' ? `Discord${status.user ? ` · ${status.user}` : ''}` : 'Discord not open',
      ),
    );
    if (status.discord !== 'connected') {
      box.append(el('span', { className: 'fix', textContent: 'Open the Discord desktop app, Xpresence finds it by itself.' }));
    }
    if (olderThan(status.version, BRIDGE_VERSION)) {
      box.append(
        el(
          'span',
          { className: 'fix' },
          'A newer helper is out. ',
          el('a', { href: bridgeDownload()[0]!.url, textContent: 'Download it' }),
          ' and open it once to update.',
        ),
      );
    }
  } else if (b === 'error') {
    box.append(item(false, 'Helper stopped'), el('span', { className: 'fix', textContent: status.error ?? '' }));
  }
  return box;
}

function updateBanner(): HTMLElement | null {
  if (!hasUpdate()) return null;
  return el(
    'div',
    { className: 'banner' },
    el('span', {}, el('strong', { textContent: `Xpresence ${release!.latest} is out` }), el('small', { textContent: 'Download it, then reload Xpresence' })),
    el('a', { className: 'btn primary', href: release!.url ?? RELEASES_URL, target: '_blank', textContent: 'Get it' }),
  );
}

function renderNow() {
  const box = $('now');
  const card =
    status?.bridge === 'missing' ? setupCard() : status?.showing && settings.enabled ? mediaCard() : emptyCard();
  box.replaceChildren(updateBanner() ?? '', card, snoozeRow() ?? '', healthLine() ?? '');
}

// --- sites tab ---

function renderSites() {
  $('sites').replaceChildren(
    siteTiles(settings, (s) => {
      settings = s;
      render();
    }),
    el('p', {
      className: 'hint',
      textContent: 'Tap a site to share it. The eye hides titles for that site, so Discord only shows its name.',
    }),
  );
}

// --- settings tab ---

let armed: ReturnType<typeof setTimeout> | undefined;

function renderSettings() {
  const box = $('settings');
  if (box.contains(document.activeElement) && document.activeElement?.tagName === 'TEXTAREA') return;

  const buttons = el('input', { type: 'checkbox', checked: settings.buttons });
  buttons.onchange = () => update((s) => (s.buttons = buttons.checked));

  const seg = el('div', { className: 'seg', role: 'group' });
  seg.setAttribute('aria-label', 'Keep paused titles for');
  for (const [mins, label] of [
    [0, 'Off'],
    [2, '2m'],
    [5, '5m'],
    [15, '15m'],
  ] as const) {
    const b = el('button', { type: 'button', textContent: label });
    b.setAttribute('aria-pressed', String(settings.pausedMinutes === mins));
    b.onclick = () => update((s) => (s.pausedMinutes = mins));
    seg.append(b);
  }

  const area = el('textarea', { rows: 3, spellcheck: false, value: settings.blocklist.join('\n') });
  area.setAttribute('aria-label', 'Private titles');
  area.onchange = () =>
    update((s) => {
      s.blocklist = area.value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    });

  // removing takes two clicks, no browser dialogs
  const removeBridge = el('button', { className: 'btn danger', type: 'button', textContent: 'Remove helper app' });
  removeBridge.onclick = () => {
    if (removeBridge.dataset.armed !== 'true') {
      removeBridge.dataset.armed = 'true';
      removeBridge.textContent = 'Click again to remove';
      clearTimeout(armed);
      armed = setTimeout(renderSettings, 4000);
      return;
    }
    void send({ type: 'removeBridge' });
    removeBridge.textContent = 'Removing…';
  };

  const removeAll = el('button', { className: 'btn danger', type: 'button', textContent: 'Remove Xpresence' });
  removeAll.title = 'Removes the helper app, then asks the browser to remove the extension';
  removeAll.onclick = async () => {
    if (status?.bridge !== 'missing') {
      void send({ type: 'removeBridge' });
      await new Promise((r) => setTimeout(r, 1500));
    }
    await browser.management.uninstallSelf({ showConfirmDialog: true }).catch(() => {});
  };

  const b = status?.bridge;
  const bridgeText =
    b === 'missing'
      ? 'Not installed on this computer'
      : b === 'connected'
        ? `Installed, version ${status?.version ?? '?'}`
        : 'Checking…';

  const check = el('button', { className: 'btn', type: 'button', textContent: 'Check now' });
  check.onclick = () => {
    check.textContent = 'Checking…';
    void send({ type: 'checkUpdate' });
  };
  const versionText = hasUpdate()
    ? `Version ${VERSION}, ${release!.latest} is available`
    : release?.latest
      ? `Version ${VERSION}, up to date`
      : `Version ${VERSION}`;

  box.replaceChildren(
    el(
      'div',
      { className: 'set' },
      el('span', {}, 'Xpresence', el('small', { textContent: versionText })),
      hasUpdate() ? el('a', { className: 'btn primary', href: release!.url ?? RELEASES_URL, target: '_blank', textContent: 'Get update' }) : check,
    ),
    el(
      'label',
      { className: 'set' },
      el('span', {}, 'Show a "Watch" button', el('small', { textContent: 'Friends can open what you are watching' })),
      el('span', { className: 'switch' }, buttons, el('span', { className: 'track' })),
    ),
    el(
      'div',
      { className: 'set' },
      el('span', {}, 'Keep paused titles', el('small', { textContent: 'How long a pause stays on Discord' })),
      seg,
    ),
    el(
      'label',
      { className: 'block' },
      el('span', { textContent: 'Private titles' }),
      el('small', { textContent: 'One per line. These only show the site name, never the title.' }),
      area,
    ),
    el(
      'div',
      { className: 'bridge' },
      el('span', {}, 'Helper app ', el('small', { className: 'muted', textContent: `· ${bridgeText}` })),
      el(
        'div',
        { className: 'actions' },
        b === 'missing'
          ? el('a', { className: 'btn primary', href: bridgeDownload()[0]!.url, textContent: 'Download helper' })
          : removeBridge,
        removeAll,
      ),
    ),
  );
}

// --- tabs ---

function openTab(name: typeof tab) {
  tab = name;
  for (const t of ['now', 'sites', 'settings'] as const) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(t).hidden = t !== name;
  }
}

function render() {
  renderHeader();
  renderNow();
  renderSites();
  renderSettings();
}

async function update(change: (s: Settings) => void) {
  settings = await saveSettings(change);
  render();
}

async function start() {
  $('cat').append(cat());
  settings = await getSettings();
  ({ status } = (await browser.storage.session.get('status')) as { status?: Status });
  ({ update: release } = (await browser.storage.local.get('update')) as { update?: UpdateInfo });
  render();

  for (const t of ['now', 'sites', 'settings'] as const) $(`tab-${t}`).onclick = () => openTab(t);
  // arrow keys move between tabs
  document.querySelector('.tabs')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    const order = ['now', 'sites', 'settings'] as const;
    const next = order[(order.indexOf(tab) + (k === 'ArrowRight' ? 1 : 2)) % 3]!;
    openTab(next);
    $(`tab-${next}`).focus();
  });

  $<HTMLInputElement>('enabled').onchange = (e) => update((s) => (s.enabled = (e.target as HTMLInputElement).checked));

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.status) {
      status = changes.status.newValue as Status | undefined;
      renderHeader();
      renderNow();
      renderSettings();
    }
    if (area === 'sync' && changes.settings) {
      void getSettings().then((s) => {
        settings = s;
        render();
      });
    }
    if (area === 'local' && changes.update) {
      release = changes.update.newValue as UpdateInfo | undefined;
      renderNow();
      renderSettings();
    }
  });

  // wakes the background, which checks on the helper app
  browser.runtime.connect({ name: 'popup' });

  // keeps the progress bar moving
  setInterval(() => {
    if (status?.showing?.media.playing) renderNow();
  }, 1000);
}

void start();
