import { describe, expect, it } from 'bun:test';

import { parse_post_html, resolve_aspect_ratio } from './postContent';

describe('parse_post_html', () => {
  it('separates photos from text and keeps alt text and dimensions', () => {
    const { media, paragraphs } = parse_post_html(
      '<p>🤘 Pumpkins on parade.</p>\n<img src="https://cdn.uploads.micro.blog/2509/img.jpg" width="600" height="450" alt="Pumpkins">',
    );

    expect(media).toEqual([
      { url: 'https://cdn.uploads.micro.blog/2509/img.jpg', video_url: null, alt: 'Pumpkins', width: 600, height: 450 },
    ]);
    expect(paragraphs).toEqual([[{ text: '🤘 Pumpkins on parade.', href: null, bold: false, italic: false }]]);
  });

  it('turns emoji images into their alt text instead of photos', () => {
    const { media, paragraphs } = parse_post_html(
      '<p>Hello <img src="https://micro.blog/images/core/emoji/sun.png" alt="☀️"> world</p>',
    );

    expect(media).toEqual([]);
    expect(paragraphs[0].map(span => span.text).join('')).toBe('Hello ☀️ world');
  });

  it('expands mini thumbnails to the original image', () => {
    const { media } = parse_post_html(
      '<img src="https://micro.blog/photos/50/https%3A%2F%2Fexample.com%2Fphoto.jpg">',
    );

    expect(media[0].url).toBe('https://example.com/photo.jpg');
  });

  it('uses the poster as the image for videos', () => {
    const { media } = parse_post_html(
      '<video src="https://example.com/clip.mp4" poster="https://example.com/poster.jpg" width="640" height="360"></video>',
    );

    expect(media).toEqual([
      {
        url: 'https://example.com/poster.jpg',
        video_url: 'https://example.com/clip.mp4',
        alt: '',
        width: 640,
        height: 360,
      },
    ]);
  });

  it('keeps links, emphasis and paragraph breaks', () => {
    const { paragraphs } = parse_post_html(
      '<p>Hi <a href="https://micro.blog/manton">@manton</a>, <strong>great</strong> shot.</p><p>Second<br>line &amp; more</p>',
    );

    expect(paragraphs).toEqual([
      [
        { text: 'Hi ', href: null, bold: false, italic: false },
        { text: '@manton', href: 'https://micro.blog/manton', bold: false, italic: false },
        { text: ', ', href: null, bold: false, italic: false },
        { text: 'great', href: null, bold: true, italic: false },
        { text: ' shot.', href: null, bold: false, italic: false },
      ],
      [{ text: 'Second', href: null, bold: false, italic: false }],
      [{ text: 'line & more', href: null, bold: false, italic: false }],
    ]);
  });
});

describe('resolve_aspect_ratio', () => {
  it('uses the tallest photo', () => {
    expect(resolve_aspect_ratio([{ width: 600, height: 400 }, { width: 400, height: 600 }])).toBe(1.5);
  });

  it('prefers the default photo when it is taller', () => {
    expect(resolve_aspect_ratio([{ width: 600, height: 300 }], { width: 1000, height: 1000 })).toBe(1);
  });

  it('falls back to square when there are no dimensions', () => {
    expect(resolve_aspect_ratio([{ width: 0, height: 0 }])).toBe(1);
  });
});
