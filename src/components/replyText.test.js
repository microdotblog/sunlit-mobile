import { describe, expect, it } from 'bun:test';

import { build_reply_text, resolve_recipients } from './replyText';

describe('resolve_recipients', () => {
  it('collects everyone in the thread except you', () => {
    const posts = [
      { mentioned_usernames: () => ['manton', 'vincent'] },
      { mentioned_usernames: () => ['jean', 'manton'] },
    ];

    expect(resolve_recipients(posts, 'vincent')).toEqual(['manton', 'jean']);
  });
});

describe('build_reply_text', () => {
  it('prefixes the selected recipients', () => {
    expect(build_reply_text(['manton', 'jean'], ' Lovely light! ')).toBe('@manton @jean Lovely light!');
  });

  it('sends the text alone when nobody is selected', () => {
    expect(build_reply_text([], 'Lovely')).toBe('Lovely');
  });
});
