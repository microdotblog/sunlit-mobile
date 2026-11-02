import { describe, expect, it } from 'bun:test';

import Post, { normalize_post, normalize_posts } from './Post';

const DISCOVER_ITEM = {
  id: '100302817',
  content_html:
    '<p>Newly occupied mouse house under the shed! @manton<img src="https://cdn.micro.blog/photos/1000x/dscf1301.jpg" alt="Two mice" width="4031" height="2688"></p>',
  url: 'https://www.distortions.net/2026/11/01/newly-occupied-mouse-house-under.html',
  date_published: '2026-11-01T19:50:42+00:00',
  author: {
    name: 'Ryan M.',
    url: 'https://distortions.net/',
    avatar: 'https://cdn.micro.blog/photos/96/avatar.jpg',
    _microblog: { username: 'rpmik' },
  },
  _microblog: {
    is_bookmark: true,
    is_deletable: false,
    is_conversation: true,
    default_photo: { blurhash: 'LEHV6nWB2yk8', width: 1000, height: 1500 },
  },
};

describe('normalize_post', () => {
  it('maps a Micro.blog JSON Feed item into a post snapshot', () => {
    const snapshot = normalize_post(DISCOVER_ITEM);

    expect(snapshot.id).toBe('100302817');
    expect(snapshot.author).toEqual({
      username: 'rpmik',
      name: 'Ryan M.',
      avatar: 'https://cdn.micro.blog/photos/96/avatar.jpg',
      url: 'https://distortions.net/',
    });
    expect(snapshot.media).toHaveLength(1);
    expect(snapshot.media[0].alt).toBe('Two mice');
    expect(snapshot.blurhash).toBe('LEHV6nWB2yk8');
    expect(snapshot.aspect_ratio).toBe(1.5);
    expect(snapshot.is_bookmark).toBe(true);
    expect(snapshot.is_conversation).toBe(true);
  });

  it('drops items without an id', () => {
    expect(normalize_posts([{ content_html: '<p>Hi</p>' }, DISCOVER_ITEM])).toHaveLength(1);
    expect(normalize_posts(null)).toEqual([]);
  });
});

describe('Post', () => {
  it('lists the author and everyone mentioned once', () => {
    const post = Post.create(normalize_post(DISCOVER_ITEM));

    expect(post.mentioned_usernames()).toEqual(['rpmik', 'manton']);
  });
});
