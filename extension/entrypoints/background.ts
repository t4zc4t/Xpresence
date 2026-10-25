import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { basicActivity, buildActivity, sameActivity, shouldHide, type Activity } from '@/lib/activity';
import { BRIDGE_HOST, DISCORD_CLIENT_ID } from '@/lib/config';
import { getSettings, siteConf, type Settings } from '@/lib/settings';
import { SITES } from '@/lib/sites';
import type { BridgeState, ContentMessage, Media, Status } from '@/lib/types';

// a tab we haven't heard from in this long is treated as gone
const STALE = 75_000;
// Discord allows about 5 updates per 20 seconds
const MIN_GAP = 4_000;
// close the bridge (which clears Discord) after this long with nothing to show
const IDLE_CLOSE = 30_000;
const RETRY = 15_000;

interface TabState {
  media: Media;
  at: number;
  pausedSince?: number;
}

export default defineBackground(() => {
  const tabs = new Map<number, TabState>();

  let port: Browser.runtime.Port | null = null;
  let bridge: BridgeState = 'idle';
  let discord: Status['discord'] = 'unknown';
  let user: string | undefined;
  let bridgeError: string | undefined;

  // set once Discord rejects the newer fields (site name, links), then we send the plain card
  let basic = false;
  let sent: Activity | null = null;
  let sentAt = 0;
  let wanted: Activity | null = null;
  let showing: Status['showing'] = null;
  let reason: string | undefined;

  let decideTimer: ReturnType<typeof setTimeout> | undefined;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  // --- status for the popup ---

  const publish = () => {
    const status: Status = {
      bridge,
      discord,
      user,
      error: bridgeError,
      showing,
      reason,
      updatedAt: Date.now(),
    };
    browser.storage.session.set({ status }).catch(() => {});
  };

  // --- bridge ---

  const openPort = (): Browser.runtime.Port | null => {
    if (port) return port;
    if (!DISCORD_CLIENT_ID) {
      bridge = 'error';
      bridgeError = 'Discord application ID is not set in this build';
      publish();
      return null;
    }
    try {
      port = browser.runtime.connectNative(BRIDGE_HOST);
    } catch (e) {
      bridge = 'missing';
      bridgeError = String(e);
      publish();
      return null;
    }
    bridge = 'connecting';
    bridgeError = undefined;

    port.onMessage.addListener((msg: any) => {
      if (msg?.type !== 'status') return;
      bridge = 'connected';
      discord = msg.discord === 'connected' ? 'connected' : 'offline';
      user = msg.user ?? undefined;
      bridgeError = msg.error ?? undefined;
      if (!basic && /rejected/i.test(bridgeError ?? '') && sent) {
        basic = true;
        sent = null;
        sentAt = 0;
        push();
      }
      publish();
    });

    port.onDisconnect.addListener(() => {
      const err = browser.runtime.lastError?.message ?? '';
      port = null;
      sent = null;
      discord = 'unknown';
      user = undefined;
      if (/not found|forbidden|no such native/i.test(err)) {
        bridge = 'missing';
        bridgeError = 'The Xpresence bridge is not installed';
      } else {
        bridge = 'error';
        bridgeError = err || 'The bridge stopped';
      }
      publish();
      // try again later if there's still something to show
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => wanted && push(), RETRY);
    });

    port.postMessage({ type: 'hello', clientId: DISCORD_CLIENT_ID });
    publish();
    return port;
  };

  const closePort = () => {
    if (!port) return;
    port.postMessage({ type: 'clear' });
    port.disconnect();
    port = null;
    sent = null;
    bridge = 'idle';
    discord = 'unknown';
    user = undefined;
    publish();
  };

  const push = () => {
    clearTimeout(pushTimer);

    if (!wanted) {
      if (sent && port) port.postMessage({ type: 'clear' });
      sent = null;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(closePort, IDLE_CLOSE);
      return;
    }
    clearTimeout(idleTimer);

    if (port && sameActivity(sent, wanted)) return;

    const wait = MIN_GAP - (Date.now() - sentAt);
    if (wait > 0) {
      pushTimer = setTimeout(push, wait);
      return;
    }

    const p = openPort();
    if (!p) return;
    p.postMessage({ type: 'set', activity: basic ? basicActivity(wanted) : wanted });
    sent = wanted;
    sentAt = Date.now();
  };

  // --- choosing what to show ---

  const pick = async (s: Settings): Promise<[number, TabState] | undefined> => {
    const now = Date.now();
    const live = [...tabs].filter(([, t]) => now - t.at < STALE && s.sites[t.media.site]?.on);

    const playing = live.filter(([, t]) => t.media.playing);
    if (playing.length) {
      const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      return playing.find(([id]) => id === active?.id) ?? playing.sort((a, b) => b[1].at - a[1].at)[0];
    }

    const keep = s.pausedMinutes * 60_000;
    return live
      .filter(([, t]) => keep > 0 && t.pausedSince != null && now - t.pausedSince < keep)
      .sort((a, b) => b[1].at - a[1].at)[0];
  };

  const decide = async () => {
    const s = await getSettings();
    const now = Date.now();
    let next: Activity | null = null;
    showing = null;

    if (!s.enabled) reason = 'Sharing is switched off';
    else if (s.snoozeUntil > now) reason = 'snoozed';
    else if (!SITES.some((site) => siteConf(s, site.id).on)) reason = 'No sites switched on yet';
    else {
      const chosen = await pick(s);
      if (chosen) {
        const [tabId, t] = chosen;
        next = buildActivity(t.media, s, now);
        showing = { media: t.media, tabId, hidden: shouldHide(t.media, s) };
        reason = undefined;
      } else {
        reason = 'Nothing playing right now';
      }
    }

    wanted = next;
    push();
    publish();
  };

  const scheduleDecide = () => {
    clearTimeout(decideTimer);
    decideTimer = setTimeout(() => void decide(), 300);
  };

  // --- content script registration ---

  const scriptId = (id: string) => `watch-${id}`;

  const syncScripts = async () => {
    const s = await getSettings();
    const registered = new Set((await browser.scripting.getRegisteredContentScripts()).map((c) => c.id));

    for (const site of SITES) {
      const id = scriptId(site.id);
      const allowed = await browser.permissions.contains({ origins: site.matches });
      const want = siteConf(s, site.id).on && allowed;

      if (want && !registered.has(id)) {
        await browser.scripting.registerContentScripts([
          {
            id,
            js: ['content-scripts/watcher.js'],
            matches: site.matches,
            runAt: 'document_idle',
            persistAcrossSessions: true,
          },
        ]);
        // tabs that were already open
        const open = await browser.tabs.query({ url: site.matches });
        for (const tab of open) {
          if (tab.id == null || tab.incognito) continue;
          browser.scripting
            .executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/watcher.js'] })
            .catch(() => {});
        }
      } else if (!want && registered.has(id)) {
        await browser.scripting.unregisterContentScripts({ ids: [id] });
      }
    }
  };

  // --- events ---

  browser.runtime.onMessage.addListener((msg: ContentMessage, sender) => {
    const tab = sender.tab;
    if (!tab?.id || tab.incognito) return;

    if (msg.type === 'gone') {
      tabs.delete(tab.id);
    } else if (msg.type === 'media') {
      const prev = tabs.get(tab.id);
      const now = Date.now();
      let pausedSince: number | undefined;
      if (!msg.media.playing) pausedSince = prev && !prev.media.playing ? prev.pausedSince : now;
      tabs.set(tab.id, { media: msg.media, at: now, pausedSince });
    }
    scheduleDecide();
  });

  browser.tabs.onRemoved.addListener((id) => {
    if (tabs.delete(id)) scheduleDecide();
  });
  browser.tabs.onActivated.addListener(scheduleDecide);
  browser.windows.onFocusChanged.addListener(scheduleDecide);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      void syncScripts();
      scheduleDecide();
    }
  });
  browser.permissions.onAdded.addListener(() => void syncScripts());
  browser.permissions.onRemoved.addListener(() => void syncScripts());

  // expire paused titles, snoozes and stale tabs
  browser.alarms.create('tick', { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === 'tick') scheduleDecide();
  });

  // the popup asks for a fresh check when it opens
  browser.runtime.onConnect.addListener((p) => {
    if (p.name !== 'popup') return;
    if (port) port.postMessage({ type: 'ping' });
    scheduleDecide();
  });

  browser.runtime.onInstalled.addListener(() => void syncScripts());
  browser.runtime.onStartup.addListener(() => void syncScripts());
  void syncScripts();
  publish();
});
