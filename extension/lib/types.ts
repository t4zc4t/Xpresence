import type { SiteId } from './sites';

// what a content script reports about the tab
export interface Media {
  site: SiteId;
  kind: 'episode' | 'movie' | 'video' | 'live';
  title: string;
  // episode title, or the channel for videos
  subtitle?: string;
  season?: number;
  episode?: number;
  playing: boolean;
  // seconds
  position?: number;
  duration?: number;
  poster?: string;
  siteIcon?: string;
  url: string;
}

export type BridgeState = 'idle' | 'connecting' | 'connected' | 'missing' | 'error';

export interface Status {
  bridge: BridgeState;
  discord: 'connected' | 'offline' | 'unknown';
  user?: string;
  error?: string;
  // what we last sent, for the popup preview
  showing?: { media: Media; tabId: number; hidden: boolean } | null;
  reason?: string;
  updatedAt: number;
}

export type ContentMessage =
  | { type: 'media'; media: Media }
  | { type: 'gone' };
