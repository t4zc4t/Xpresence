// Bits shared by the popup and the setup page.

import { browser } from 'wxt/browser';
import { saveSettings, siteConf, type Settings } from './settings';
import { SITES, type Site } from './sites';

type Kid = Node | string | undefined | null | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { data?: Record<string, string> } = {},
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const { data, ...rest } = props;
  const e = Object.assign(document.createElement(tag), rest);
  if (data) Object.assign(e.dataset, data);
  for (const k of kids) if (k) e.append(k);
  return e;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function bg(url?: string): string {
  return url && url.startsWith('https://') ? `url(${JSON.stringify(url)})` : '';
}

const SVG = 'http://www.w3.org/2000/svg';

// the cat from the icon, its eyes show whether we're on air
export function cat(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '16 10 96 102');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('cat');
  svg.innerHTML = `
    <path class="head" d="M27 50 L31 17 Q32 13 36 15 L57 34 Q64 32 71 34 L92 15 Q96 13 97 17 L101 50 Q108 62 106 76 Q102 106 64 108 Q26 106 22 76 Q20 62 27 50 Z"/>
    <path class="ears" d="M35 24 L50 37 Q42 40 37 45 Z M93 24 L78 37 Q86 40 91 45 Z"/>
    <g class="eyes">
      <path d="M36 70 Q47 57 58 70 Q47 83 36 70 Z"/>
      <path d="M70 70 Q81 57 92 70 Q81 83 70 70 Z"/>
    </g>
    <g class="pupils">
      <ellipse cx="47" cy="70" rx="2.6" ry="8"/>
      <ellipse cx="81" cy="70" rx="2.6" ry="8"/>
    </g>
    <path class="shut" d="M37 71 Q47 76 57 71 M71 71 Q81 76 91 71"/>
    <path class="nose" d="M59 85 L69 85 L64 91 Z"/>`;
  return svg;
}

// true for colours like Kick green where white text would be hard to read
export function isLight(hex: string | undefined): boolean {
  const m = hex?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

export function monogram(site: Site): HTMLElement {
  const m = el('span', { className: 'mono', textContent: site.name.replace(/^the\s+/i, '').charAt(0) });
  m.style.setProperty('--c', site.color ?? `hsl(${[...site.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 70% 55%)`);
  if (isLight(site.color)) m.style.color = '#111';
  return m;
}

// site switches as tiles, the whole tile toggles sharing
export function siteTiles(settings: Settings, onSaved: (s: Settings) => void): HTMLElement {
  const grid = el('div', { className: 'tiles' });

  for (const site of SITES) {
    const conf = siteConf(settings, site.id);
    const state = conf.on ? (conf.hideTitle ? 'Title hidden' : 'Sharing') : 'Off';

    const tile = el(
      'button',
      { className: 'tile', type: 'button', data: { on: String(conf.on) } },
      monogram(site),
      el('span', { className: 'tname', textContent: site.name }),
      el('span', { className: 'tstate', textContent: state }),
    );
    tile.setAttribute('aria-pressed', String(conf.on));
    tile.setAttribute('aria-label', `${site.name}: ${state}. Click to ${conf.on ? 'stop sharing' : 'share'}`);

    tile.onclick = () => {
      if (conf.on) {
        void saveSettings((s) => (siteConf(s, site.id).on = false)).then(onSaved);
        return;
      }
      // has to run straight from the click for the browser to show its prompt
      browser.permissions.request({ origins: site.matches }).then((ok) => {
        if (ok) void saveSettings((s) => (siteConf(s, site.id).on = true)).then(onSaved);
      });
    };

    const eye = el('button', {
      className: 'eye',
      type: 'button',
      title: conf.hideTitle ? 'Show titles for this site' : 'Hide titles for this site',
    });
    eye.innerHTML = conf.hideTitle
      ? '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a12.6 12.6 0 01-3.1 4.2M6.1 6.1C3.9 7.6 2.5 9.8 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    eye.setAttribute('aria-pressed', String(conf.hideTitle));
    eye.setAttribute('aria-label', `Hide titles on ${site.name}`);
    eye.hidden = !conf.on;
    eye.onclick = () =>
      void saveSettings((s) => {
        const c = siteConf(s, site.id);
        c.hideTitle = !c.hideTitle;
      }).then(onSaved);

    grid.append(el('div', { className: 'tilewrap' }, tile, eye));
  }
  return grid;
}
