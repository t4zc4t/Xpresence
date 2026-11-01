import { describe, expect, it } from 'vitest';
import { findArt, sameTitle } from './posters';

const art = (w: number, h: number) => ({ template: 'https://is1-ssl.mzstatic.com/image/thumb/x/{w}x{h}CA.TVA23C01.{f}', width: w, height: h });

describe('posters', () => {
  it('matches titles loosely', () => {
    expect(sameTitle('Miami vs. Cincinnati', 'Inter Miami vs. FC Cincinnati')).toBe(true);
    expect(sameTitle('F1 The Movie', 'F1® The Movie')).toBe(true);
    expect(sameTitle('Ghosted', 'F1 The Movie')).toBe(false);
  });

  it('picks the matching result', () => {
    const page = { shelves: [{ items: [{ title: 'Ghosted', artwork: art(2000, 3000) }, { title: 'F1 The Movie', artwork: art(2000, 3000) }] }] };
    expect(findArt(page, 'F1 The Movie')).toBe('https://is1-ssl.mzstatic.com/image/thumb/x/600x900CA.TVA23C01.jpg');
    expect(findArt(page, 'Severance')).toBeUndefined();
  });

  it('keeps wide art for matches', () => {
    const page = { items: [{ title: 'Miami vs. Cincinnati', artwork: art(3840, 2160) }] };
    expect(findArt(page, 'Inter Miami vs. FC Cincinnati')).toContain('/600x338CA');
  });
});
