import '@/assets/ui.css';
import './style.css';
import { browser } from 'wxt/browser';
import { bridgeDownload } from '@/lib/config';
import { getSettings, siteConf, type Settings } from '@/lib/settings';
import { SITES } from '@/lib/sites';
import type { Status } from '@/lib/types';
import { cat, el, siteTiles } from '@/lib/ui';

const $ = (id: string) => document.getElementById(id)!;

let settings: Settings;
let status: Status | undefined;

function render() {
  const helper = status?.bridge === 'connected';
  const discord = helper && status?.discord === 'connected';
  const sites = SITES.some((s) => siteConf(settings, s.id).on);

  $('step-helper').dataset.ok = String(helper);
  $('step-discord').dataset.ok = String(discord);
  $('step-sites').dataset.ok = String(sites);
  $('downloads').hidden = helper;

  $('helper-note').textContent = helper
    ? `Found it, version ${status?.version ?? ''}.`
    : status?.bridge === 'missing'
      ? 'Waiting for the helper… after downloading, open the file once. If Windows warns about it, choose More info, then Run anyway.'
      : '';
  $('discord-note').textContent = discord
    ? `Connected${status?.user ? ` as ${status.user}` : ''}.`
    : helper
      ? 'Waiting for Discord to open…'
      : '';

  document.body.dataset.air = helper && discord && sites ? 'live' : helper ? 'paused' : 'off';
  $('done').hidden = !(helper && discord && sites);

  $('tiles').replaceChildren(
    siteTiles(settings, (s) => {
      settings = s;
      render();
    }),
  );
}

async function start() {
  $('cat').append(cat());
  $('downloads').append(
    ...bridgeDownload().map((d, i) => el('a', { className: `btn${i ? '' : ' primary'}`, href: d.url, textContent: d.label })),
  );

  settings = await getSettings();
  ({ status } = (await browser.storage.session.get('status')) as { status?: Status });
  render();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.status) {
      status = changes.status.newValue as Status | undefined;
      render();
    }
    if (area === 'sync' && changes.settings) void getSettings().then((s) => ((settings = s), render()));
  });

  // keep checking until the helper and Discord are both there
  const check = () => {
    if (status?.bridge === 'connected' && status.discord === 'connected') return;
    void browser.runtime.sendMessage({ type: 'probe' }).catch(() => {});
  };
  check();
  setInterval(check, 3000);
}

void start();
