import { describe, expect, it } from 'bun:test';

import { conversation_uri, list_row_count, normalize_widget_config, posts_to_widget_items, widget_error_message, widget_layout, widget_title } from './widgetModel';

describe('widget_layout', () => {
  it('shows one photo, a featured post, or a list depending on size', () => {
    expect(widget_layout(110, 110)).toBe('single');
    expect(widget_layout(320, 160)).toBe('feature');
    expect(widget_layout(320, 320)).toBe('list');
  });
});

describe('normalize_widget_config', () => {
  it('falls back to the timeline and photos', () => {
    expect(normalize_widget_config(null)).toEqual({ feed: 'timeline', category: 'photos' });
    expect(normalize_widget_config({ feed: 'discover', category: 'cats' })).toEqual({ feed: 'discover', category: 'cats' });
    expect(normalize_widget_config({ feed: 'discover', category: 'nope' })).toEqual({ feed: 'discover', category: 'photos' });
  });
});

describe('widget_title', () => {
  it('names the feed', () => {
    expect(widget_title({ feed: 'timeline' })).toBe('Timeline');
    expect(widget_title({ feed: 'discover', category: 'dogs' })).toBe('Discover · Dogs');
  });
});

describe('posts_to_widget_items', () => {
  it('keeps up to four posts with photos', () => {
    const post = id => ({
      id: `${id}`,
      media: [{ url: `https://example.com/${id}.jpg` }],
      author: { username: 'jean', name: 'Jean' },
      paragraphs: [[{ text: 'Hello' }, { text: ' there' }]],
    });
    const items = posts_to_widget_items([{ ...post(0), media: [] }, post(1), post(2), post(3), post(4), post(5)]);

    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ id: '1', image_url: 'https://example.com/1.jpg', username: 'jean', name: 'Jean', text: 'Hello there' });
    expect(conversation_uri(items[0])).toBe('sunlit://show?id=1');
  });
});

describe('list_row_count', () => {
  it('shows only the rows that fit, up to four', () => {
    expect(list_row_count(250)).toBe(3);
    expect(list_row_count(320)).toBe(4);
    expect(list_row_count(600)).toBe(4);
  });
});

describe('widget_error_message', () => {
  it('asks to sign in again for an expired token and stays calm otherwise', () => {
    expect(widget_error_message({ status: 401 })).toBe('Open Sunlit and sign in again to see your photos.');
    expect(widget_error_message(new TypeError('Network request failed'))).toBe('Couldn’t load photos. Sunlit will try again soon.');
  });
});
