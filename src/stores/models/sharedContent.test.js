import { describe, expect, it } from 'bun:test';

import { is_glass_url, parse_glass_page, shared_files_to_assets, shared_url } from './sharedContent';

describe('shared_files_to_assets', () => {
  it('keeps photos and videos and drops other files', () => {
    const assets = shared_files_to_assets([
      { path: 'file:///a.jpg', mimeType: 'image/jpeg', width: 800, height: 600 },
      { path: 'file:///b.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
      { path: 'file:///c.pdf', mimeType: 'application/pdf' },
    ]);

    expect(assets).toEqual([
      { kind: 'image', uri: 'file:///a.jpg', width: 800, height: 600, mime: 'image/jpeg' },
      { kind: 'video', uri: 'file:///b.mp4', width: 1920, height: 1080, mime: 'video/mp4' },
    ]);
  });

  it('takes at most ten files, like the iOS share extension', () => {
    const files = Array.from({ length: 12 }, (_, index) => ({ path: `file:///${index}.jpg`, mimeType: 'image/jpeg' }));

    expect(shared_files_to_assets(files)).toHaveLength(10);
  });
});

describe('shared_url', () => {
  it('finds a web link in shared text', () => {
    expect(shared_url({ webUrl: 'https://glass.photo/vincent/abc' })).toBe('https://glass.photo/vincent/abc');
    expect(shared_url({ text: 'not a link' })).toBe(null);
    expect(shared_url({ text: 'javascript:alert(1)' })).toBe(null);
  });
});

describe('glass.photo pages', () => {
  it('recognises Glass links', () => {
    expect(is_glass_url('https://glass.photo/vincent/abc')).toBe(true);
    expect(is_glass_url('https://example.com/photo.jpg')).toBe(false);
  });

  it('reads the first image and the description', () => {
    const page = parse_glass_page(
      '<html><body><img src="/images/photo.jpg"><img src="/other.jpg"><p class="photo-description">Fog over <em>the bay</em> &amp; hills</p></body></html>',
      'https://glass.photo/vincent/abc',
    );

    expect(page).toEqual({
      image_url: 'https://glass.photo/images/photo.jpg',
      description: 'Fog over the bay & hills',
    });
  });
});
