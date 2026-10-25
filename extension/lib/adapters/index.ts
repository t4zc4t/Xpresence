import type { SiteId } from '../sites';
import type { Media } from '../types';
import { appletv } from './appletv';
import { hotstar } from './hotstar';
import { netflix } from './netflix';
import { primevideo } from './primevideo';
import { youtube } from './youtube';

// what an adapter knows about the page, the watcher fills in the rest
export type Reading = Partial<Pick<Media, 'kind' | 'title' | 'subtitle' | 'season' | 'episode' | 'poster' | 'url'>> & {
  // an ad is playing, keep the last card instead
  ad?: boolean;
};

// null means the page isn't a player (browse pages, search and so on)
export type Adapter = () => Reading | null;

export const ADAPTERS: Record<SiteId, Adapter> = {
  netflix,
  appletv,
  youtube,
  primevideo,
  hotstar,
};
