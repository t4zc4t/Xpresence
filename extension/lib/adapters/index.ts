import type { SiteId } from '../sites';
import type { Media } from '../types';
import { appletv } from './appletv';
import { dazn } from './dazn';
import { hotstar } from './hotstar';
import { kick } from './kick';
import { lunar } from './lunar';
import { netflix } from './netflix';
import { primevideo } from './primevideo';
import { twitch } from './twitch';
import { youtube } from './youtube';

// what an adapter knows about the page, the watcher fills in the rest
export type Reading = Partial<
  Pick<Media, 'kind' | 'title' | 'subtitle' | 'season' | 'episode' | 'poster' | 'caption' | 'url'>
> & {
  // an ad is playing, keep the last card instead
  ad?: boolean;
  // for live streams, when the stream itself started (ms)
  startedAt?: number;
};

// null means the page isn't a player (browse pages, search and so on)
export type Adapter = () => Reading | null;

// adapters for sites kept only on this machine
const local = import.meta.glob<{ id: string; adapter: Adapter }>('../../local/*/adapter.ts', { eager: true });

export const ADAPTERS: Record<SiteId, Adapter> = {
  netflix,
  appletv,
  youtube,
  primevideo,
  hotstar,
  lunar,
  twitch,
  kick,
  dazn,
  ...Object.fromEntries(Object.values(local).map((m) => [m.id, m.adapter])),
};
