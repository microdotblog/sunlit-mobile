import { describe, expect, it, mock } from 'bun:test';

import { create_users_store, following_key, SEARCH_KEY } from './createUsersStore';

function build_store(api_overrides = {}) {
  const api = {
    fetch_user_posts: mock(async ({ username }) => ({
      _microblog: { username, bio: 'Photos.', is_following: false, is_you: false, following_count: 12 },
      author: { name: 'Jean', avatar: 'https://example.com/jean.jpg', url: 'https://jean.blog' },
      items: [],
    })),
    follow_user: mock(async () => null),
    unfollow_user: mock(async () => null),
    fetch_following: mock(async () => [{ username: 'manton', name: 'Manton Reece' }]),
    search_users: mock(async () => [{ username: 'manton' }, { username: 'jean' }]),
    ...api_overrides,
  };
  const on_auth_error = mock(() => {});
  const store = create_users_store({ api, get_token: () => 'token-1', on_auth_error });

  return { api, on_auth_error, store };
}

describe('create_users_store', () => {
  it('loads a profile into the user map', async () => {
    const { store } = build_store();

    await store.load_profile('jean');

    const user = store.get_user('jean');
    expect(user.display_name()).toBe('Jean');
    expect(user.bio).toBe('Photos.');
    expect(user.is_following).toBe(false);
    expect(user.following_count).toBe(12);
    expect(store.get_profile_status('jean').is_loading).toBe(false);
  });

  it('keeps profile details when the same person appears in a list later', async () => {
    const { store } = build_store({
      fetch_following: mock(async () => [{ username: 'jean', name: '' }]),
    });
    await store.load_profile('jean');

    await store.load_following('vincent');

    expect(store.get_user('jean').bio).toBe('Photos.');
    expect(store.get_list(following_key('vincent')).users()).toHaveLength(1);
  });

  it('follows optimistically and rolls back on failure', async () => {
    const { api, store } = build_store({
      follow_user: mock(async () => {
        throw new Error('offline');
      }),
    });
    await store.load_profile('jean');

    await expect(store.toggle_follow('jean')).rejects.toThrow('offline');

    expect(api.follow_user).toHaveBeenCalledWith({ token: 'token-1', username: 'jean' });
    expect(store.get_user('jean').is_following).toBe(false);
  });

  it('does not search until there are two characters', async () => {
    const { api, store } = build_store();

    await store.search('m');
    expect(api.search_users).not.toHaveBeenCalled();

    await store.search(' ma ');
    expect(api.search_users).toHaveBeenCalledWith({ token: 'token-1', query: 'ma' });
    expect(store.get_list(SEARCH_KEY).users().map(user => user.username)).toEqual(['manton', 'jean']);
  });

  it('tells the session when the token is rejected', async () => {
    const error = new Error('Unauthorized');
    error.status = 403;
    const { on_auth_error, store } = build_store({
      fetch_following: mock(async () => {
        throw error;
      }),
    });

    await store.load_following('vincent');

    expect(on_auth_error).toHaveBeenCalledTimes(1);
    expect(store.get_list(following_key('vincent')).error_message).toBe('Could not load people. Please try again.');
  });
});
