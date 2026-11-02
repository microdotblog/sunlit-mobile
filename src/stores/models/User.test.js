import { describe, expect, it } from 'bun:test';

import { normalize_profile, normalize_user } from './User';

describe('normalize_profile', () => {
  it('reads the author and _microblog fields of a /posts/{username} feed', () => {
    const profile = normalize_profile({
      _microblog: {
        username: 'manton',
        bio: 'I created Micro.blog.',
        is_following: false,
        is_you: false,
        following_count: 919,
      },
      author: { name: 'Manton Reece', url: 'https://manton.org', avatar: 'https://avatars.micro.blog/3.jpg' },
    });

    expect(profile).toEqual({
      username: 'manton',
      name: 'Manton Reece',
      avatar: 'https://avatars.micro.blog/3.jpg',
      url: 'https://manton.org',
      bio: 'I created Micro.blog.',
      is_following: false,
      is_you: false,
      following_count: 919,
    });
  });
});

describe('normalize_user', () => {
  it('decodes HTML entities in the bio', () => {
    expect(normalize_user({ username: 'kaa', bio: 'Watches &amp; Technology.' }).bio).toBe('Watches & Technology.');
  });

  it('accepts the following and search list shapes', () => {
    const user = normalize_user({ username: 'jean', full_name: 'Jean', gravatar_url: 'https://g/jean.png', is_following: 1 });

    expect(user.name).toBe('Jean');
    expect(user.avatar).toBe('https://g/jean.png');
    expect(user.is_following).toBe(true);
    expect(user.is_you).toBe(null);
  });
});
