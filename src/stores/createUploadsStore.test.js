import { describe, expect, it } from 'bun:test';

import { normalize_uploads, upload_to_asset } from './createUploadsStore';

describe('normalize_uploads', () => {
  it('keeps photos and videos with posters and skips the rest', () => {
    const uploads = normalize_uploads([
      { url: 'https://vincent.blog/uploads/a.jpg', alt: 'Sea' },
      { url: 'https://vincent.blog/uploads/b.mov', poster: 'https://vincent.blog/uploads/b.jpg' },
      { url: 'https://vincent.blog/uploads/c.mp4' },
      { url: '' },
    ]);

    expect(uploads).toEqual([
      { url: 'https://vincent.blog/uploads/a.jpg', poster: null, alt: 'Sea', kind: 'image' },
      { url: 'https://vincent.blog/uploads/b.mov', poster: 'https://vincent.blog/uploads/b.jpg', alt: '', kind: 'video' },
    ]);
  });
});

describe('upload_to_asset', () => {
  it('marks an upload as already on the server', () => {
    expect(upload_to_asset({ url: 'https://vincent.blog/uploads/a.jpg', poster: null, alt: 'Sea', kind: 'image' })).toEqual({
      kind: 'image',
      uri: 'https://vincent.blog/uploads/a.jpg',
      alt: 'Sea',
      remote_url: 'https://vincent.blog/uploads/a.jpg',
      poster_url: null,
    });
  });
});
