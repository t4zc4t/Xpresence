import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './style.css';
import { browser } from 'wxt/browser';
import { episodeLine } from '@/lib/activity';
import { RELEASES_URL } from '@/lib/config';
import { getSettings, saveSettings, siteConf, type Settings } from '@/lib/settings';
import { SITES, siteById } from '@/lib/sites';
import type { Status } from '@/lib/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;
let status: Status | undefined;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kids: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function bg(url?: string): string {
  return url && url.startsWith('https://') ? `url(${JSON.stringify(url)})` : '';
}

// --- now playing card ---

function renderNow() {
  const box = $('now');
  const tally = $('tally');
  box.replaceChildren();
  tally.className = 'tally';

  const shown = status?.showing;
  if (!shown) {
    let head = 'Nothing on air';
    let body: (Node | string)[] = [status?.reason ?? 'Play something on a site you switched on.'];
    if (settings.snoozeUntil > Date.now()) {
      head = 'Snoozed';
      body = ['Nothing is shared until the snooze ends.'];
    } else if (!settings.enabled) {
      head = 'Sharing is off';
      body = ['Turn on the switch above to share again.'];
    } else if (!SITES.some((s) => siteConf(settings, s.id).on)) {
      head = 'Pick your sites';
      body = ['Switch on the sites you want to share below.'];
    }
    box.append(el('p', { className: 'empty' }, el('strong', { textContent: head }), ...body));
    return;
  }

  const m = shown.media;
  const site = siteById(m.site);
  tally.classList.add(m.playing ? 'live' : 'paused');

  const art = el('div', { className: 'art' });
  const pic = shown.hidden ? m.siteIcon : (m.poster ?? m.siteIcon);
  art.style.backgroundImage = bg(pic);
  if (!shown.hidden && m.poster && m.siteIcon) {
    const badge = el('span', { className: 'badge' });
    badge.style.backgroundImage = bg(m.siteIcon);
    art.append(badge);
  }

  const line = shown.hidden ? 'Title hidden' : m.kind === 'live' ? 'Live' : (episodeLine(m) ?? '');
  const info = el(
    'div',
    {},
    el('div', { className: 'where', textContent: `${m.playing ? 'Watching' : 'Paused'} on ${site?.name ?? 'the web'}` }),
    el('div', { className: 'title', textContent: shown.hidden ? (site?.name ?? '') : m.title }),
    line ? el('div', { className: 'state', textContent: line }) : undefined,
  );

  const card = el('div', { className: 'card' }, art, info);

  if (!shown.hidden && m.duration && m.position != null && m.kind !== 'live') {
    const pos = m.playing && status ? m.position + (Date.now() - status.updatedAt) / 1000 : m.position;
    const fill = el('span');
    fill.style.width = `${Math.min(100, (pos / m.duration) * 100)}%`;
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

  if (!shown.hidden && settings.buttons) {
    card.append(el('a', { className: 'watch', href: m.url, target: '_blank', textContent: `Watch on ${site?.name}` }));
  }
  box.append(card);
}

// --- bridge and discord health ---

function renderHealth() {
  const box = $('health');
  box.replaceChildren();
  if (!status) return;

  const item = (good: boolean | null, text: string) =>
    el('span', { className: good == null ? '' : good ? 'good' : 'bad' }, el('i', { className: 'dot' }), text);

  const b = status.bridge;
  if (b === 'idle') {
    box.append(item(null, 'Bridge sleeps until something plays'));
    return;
  }
  box.append(item(b === 'connected', b === 'connected' ? 'Bridge running' : b === 'connecting' ? 'Starting bridge' : 'Bridge not reachable'));
  if (b === 'connected') {
    box.append(
      item(
        status.discord === 'connected',
        status.discord === 'connected' ? `Discord${status.user ? ` as ${status.user}` : ''}` : 'Discord not found',
      ),
    );
  }

  let fix: (Node | string)[] | undefined;
  if (b === 'missing') {
    fix = ['Install the bridge app to connect to Discord. ', el('a', { href: RELEASES_URL, target: '_blank', textContent: 'Get it here' })];
  } else if (b === 'connected' && status.discord !== 'connected') {
    fix = ['Open the Discord desktop app, Xpresence finds it on its own.'];
  } else if (status.error && b !== 'connecting') {
    fix = [status.error];
  }
  if (fix) box.append(el('span', { className: 'fix' }, ...fix));
}

// --- snooze ---

function renderSnooze() {
  const box = $('snooze');
  box.replaceChildren();
  const until = settings.snoozeUntil;

  if (until > Date.now()) {
    const time = new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const resume = el('button', { textContent: 'Resume now' });
    resume.onclick = () => update((s) => (s.snoozeUntil = 0));
    box.append(el('span', { className: 'note', textContent: `Snoozed until ${time}` }), resume);
    return;
  }

  const hour = el('button', { textContent: 'Snooze 1 hour' });
  hour.onclick = () => update((s) => (s.snoozeUntil = Date.now() + 3_600_000));
  const night = el('button', { textContent: 'Snooze until midnight' });
  night.onclick = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    update((s) => (s.snoozeUntil = d.getTime()));
  };
  box.append(hour, night);
}

// --- sites ---

function renderSites() {
  const list = $('sites');
  list.replaceChildren();

  for (const site of SITES) {
    const conf = siteConf(settings, site.id);

    const hide = el('button', {
      className: 'hide',
      textContent: 'Hide title',
      title: 'Share the site but not what you are watching',
    });
    hide.setAttribute('aria-pressed', String(conf.hideTitle));
    hide.hidden = !conf.on;
    hide.onclick = () => update((s) => {
      const c = siteConf(s, site.id);
      c.hideTitle = !c.hideTitle;
    });

    const input = el('input', { type: 'checkbox', checked: conf.on });
    input.setAttribute('aria-label', `Share ${site.name}`);
    input.onchange = () => {
      if (!input.checked) {
        void update((s) => (siteConf(s, site.id).on = false));
        return;
      }
      // must be called straight from the click for the browser to allow it
      browser.permissions.request({ origins: site.matches }).then((ok) => {
        if (ok) void update((s) => (siteConf(s, site.id).on = true));
        else input.checked = false;
      });
    };

    list.append(
      el(
        'li',
        {},
        el('span', { className: `name${conf.on ? '' : ' off'}`, textContent: site.name }),
        hide,
        el('label', { className: 'switch' }, input, el('span', { className: 'track' })),
      ),
    );
  }
}

function renderOptions() {
  $<HTMLInputElement>('enabled').checked = settings.enabled;
  $<HTMLInputElement>('buttons').checked = settings.buttons;
  $<HTMLSelectElement>('paused').value = String(settings.pausedMinutes);
  const area = $<HTMLTextAreaElement>('blocklist');
  if (document.activeElement !== area) area.value = settings.blocklist.join('\n');
}

function render() {
  renderNow();
  renderHealth();
  renderSnooze();
  renderSites();
  renderOptions();
}

async function update(change: (s: Settings) => void) {
  settings = await saveSettings(change);
  render();
}

async function start() {
  settings = await getSettings();
  ({ status } = (await browser.storage.session.get('status')) as { status?: Status });
  render();

  $<HTMLInputElement>('enabled').onchange = (e) =>
    update((s) => (s.enabled = (e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('buttons').onchange = (e) =>
    update((s) => (s.buttons = (e.target as HTMLInputElement).checked));
  $<HTMLSelectElement>('paused').onchange = (e) =>
    update((s) => (s.pausedMinutes = Number((e.target as HTMLSelectElement).value)));
  $<HTMLTextAreaElement>('blocklist').onchange = (e) =>
    update((s) => {
      s.blocklist = (e.target as HTMLTextAreaElement).value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.status) {
      status = changes.status.newValue as Status | undefined;
      renderNow();
      renderHealth();
    }
    if (area === 'sync' && changes.settings) {
      void getSettings().then((s) => {
        settings = s;
        render();
      });
    }
  });

  // wakes the background so the card is fresh
  browser.runtime.connect({ name: 'popup' });

  // keep the progress bar moving
  setInterval(renderNow, 1000);
}

void start();
