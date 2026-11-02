import { describe, expect, it, mock } from 'bun:test';

import { create_auth_store, SESSION_EXPIRED_MESSAGE } from './createAuthStore';

function build_tokens_double(overrides = {}) {
  return {
    hydrate: mock(async () => {}),
    set_user_token: mock(async token => token),
    clear_user_token: mock(async () => {}),
    set_pending_oauth_state: mock(async state => state),
    clear_pending_oauth_state: mock(async () => {}),
    clear_all: mock(async () => {}),
    get_user_token: () => '',
    has_user_token: () => false,
    get_pending_oauth_state: () => '',
    get_profile: () => null,
    set_profile: mock(async () => {}),
    has_pending_oauth_state: () => false,
    ...overrides,
  };
}

function build_auth_store(overrides = {}) {
  const dependencies = {
    build_micro_blog_auth_url: mock(() => 'https://micro.blog/indieauth/auth'),
    create_oauth_state: mock(async () => 'state-123'),
    exchange_micro_blog_code: mock(async () => ({ access_token: 'oauth-token', me: 'https://vincent.blog/' })),
    extract_micro_blog_callback_params: mock(() => ({ code: 'code-1', state: 'state-123' })),
    get_initial_url: mock(async () => null),
    get_micro_blog_redirect_uri: mock(() => 'sunlit://auth/callback'),
    is_micro_blog_callback_url: mock(() => false),
    open_auth_session: mock(async () => ({ type: 'cancel' })),
    tokens: build_tokens_double(),
    verify_micro_blog_token: mock(async () => ({
      avatar: 'https://micro.blog/vincent/avatar.jpg',
      name: 'Vincent Ritter',
      url: 'https://vincent.blog/',
      username: 'vincent',
    })),
    ...overrides,
  };

  return {
    dependencies,
    store: create_auth_store(dependencies),
    tokens: dependencies.tokens,
  };
}

function auth_error(status = 401) {
  const error = new Error('Unauthorized');
  error.status = status;
  return error;
}

describe('create_auth_store', () => {
  describe('sign_in_with_token', () => {
    it('stores the replacement token from verify and applies the profile', async () => {
      const { dependencies, store, tokens } = build_auth_store();
      dependencies.verify_micro_blog_token.mockImplementation(async () => ({
        avatar: 'https://micro.blog/vincent/avatar.jpg',
        name: 'Vincent Ritter',
        token: 'session-token',
        url: 'https://vincent.blog/',
        username: 'vincent',
      }));

      const did_sign_in = await store.sign_in_with_token('  token-123  ');

      expect(did_sign_in).toBe(true);
      expect(dependencies.verify_micro_blog_token).toHaveBeenCalledWith('token-123');
      expect(tokens.set_user_token).toHaveBeenCalledWith('session-token');
      expect(store.profile_username).toBe('vincent');
      expect(store.profile_name).toBe('Vincent Ritter');
      expect(store.profile_photo).toBe('https://micro.blog/vincent/avatar.jpg');
      expect(store.loading_phase).toBe('idle');
    });

    it('keeps the submitted token when verify returns no replacement', async () => {
      const { store, tokens } = build_auth_store();

      await store.sign_in_with_token('token-123');

      expect(tokens.set_user_token).toHaveBeenCalledWith('token-123');
    });

    it('rejects an invalid token without persisting it', async () => {
      const { store, tokens } = build_auth_store({
        verify_micro_blog_token: mock(async () => {
          throw auth_error();
        }),
      });

      const did_sign_in = await store.sign_in_with_token('bad-token');

      expect(did_sign_in).toBe(false);
      expect(tokens.set_user_token).not.toHaveBeenCalled();
      expect(store.profile_username).toBe(null);
      expect(store.error_message).toBe('That Micro.blog token is not valid. Please try again.');
    });

    it('asks for a token when the field is empty', async () => {
      const { dependencies, store } = build_auth_store();

      const did_sign_in = await store.sign_in_with_token('   ');

      expect(did_sign_in).toBe(false);
      expect(dependencies.verify_micro_blog_token).not.toHaveBeenCalled();
      expect(store.error_message).toBe('Enter a Micro.blog app token to sign in.');
    });
  });

  describe('sign_in_with_micro_blog', () => {
    it('exchanges the IndieAuth code and stores the access token', async () => {
      const { dependencies, store, tokens } = build_auth_store({
        open_auth_session: mock(async () => ({ type: 'success', url: 'sunlit://auth/callback?code=code-1&state=state-123' })),
        tokens: build_tokens_double({ get_pending_oauth_state: () => 'state-123' }),
      });

      const did_sign_in = await store.sign_in_with_micro_blog();

      expect(did_sign_in).toBe(true);
      expect(tokens.set_pending_oauth_state).toHaveBeenCalledWith('state-123');
      expect(dependencies.exchange_micro_blog_code).toHaveBeenCalledWith({ code: 'code-1' });
      expect(tokens.set_user_token).toHaveBeenCalledWith('oauth-token');
      expect(store.profile_username).toBe('vincent');
      expect(store.error_message).toBe(null);
    });

    it('refuses a callback whose state does not match', async () => {
      const { dependencies, store, tokens } = build_auth_store({
        open_auth_session: mock(async () => ({ type: 'success', url: 'sunlit://auth/callback?code=code-1&state=forged' })),
        extract_micro_blog_callback_params: mock(() => ({ code: 'code-1', state: 'forged' })),
        tokens: build_tokens_double({ get_pending_oauth_state: () => 'state-123' }),
      });

      const did_sign_in = await store.sign_in_with_micro_blog();

      expect(did_sign_in).toBe(false);
      expect(dependencies.exchange_micro_blog_code).not.toHaveBeenCalled();
      expect(tokens.set_user_token).not.toHaveBeenCalled();
      expect(store.error_message).toBe('Micro.blog sign in could not be verified. Please try again.');
    });

    it('stays quiet when the person cancels the browser', async () => {
      const { store, tokens } = build_auth_store();

      const did_sign_in = await store.sign_in_with_micro_blog();

      expect(did_sign_in).toBe(false);
      expect(tokens.clear_pending_oauth_state).toHaveBeenCalled();
      expect(store.error_message).toBe(null);
    });
  });

  describe('hydrate', () => {
    it('replaces the stored token when verify returns a newer one', async () => {
      const { store, tokens } = build_auth_store({
        tokens: build_tokens_double({
          get_user_token: () => 'stored-token',
          has_user_token: () => true,
        }),
        verify_micro_blog_token: mock(async () => ({ token: 'fresh-token', username: 'vincent' })),
      });

      await store.hydrate();

      expect(tokens.set_user_token).toHaveBeenCalledWith('fresh-token');
      expect(store.profile_username).toBe('vincent');
      expect(store.is_hydrating).toBe(false);
    });

    it('clears an expired session', async () => {
      const { store, tokens } = build_auth_store({
        tokens: build_tokens_double({
          get_user_token: () => 'stored-token',
          has_user_token: () => true,
        }),
        verify_micro_blog_token: mock(async () => {
          throw auth_error(403);
        }),
      });

      await store.hydrate();

      expect(tokens.clear_all).toHaveBeenCalled();
      expect(store.error_message).toBe(SESSION_EXPIRED_MESSAGE);
    });

    it('restores the saved profile when verify fails offline', async () => {
      const { store } = build_auth_store({
        tokens: build_tokens_double({
          get_user_token: () => 'stored-token',
          has_user_token: () => true,
          get_profile: () => ({ profile_username: 'vincent', profile_photo: 'https://micro.blog/vincent/avatar.jpg' }),
        }),
        verify_micro_blog_token: mock(async () => {
          throw new Error('Network request failed');
        }),
      });

      await store.hydrate();

      expect(store.profile_username).toBe('vincent');
      expect(store.profile_photo).toBe('https://micro.blog/vincent/avatar.jpg');
    });

    it('saves the verified profile for the next launch', async () => {
      const { store, tokens } = build_auth_store();

      await store.sign_in_with_token('token-123');

      expect(tokens.set_profile).toHaveBeenCalledWith({
        profile_username: 'vincent',
        profile_name: 'Vincent Ritter',
        profile_photo: 'https://micro.blog/vincent/avatar.jpg',
        profile_url: 'https://vincent.blog/',
      });
    });

    it('keeps the session when verify fails offline', async () => {
      const { store, tokens } = build_auth_store({
        tokens: build_tokens_double({
          get_user_token: () => 'stored-token',
          has_user_token: () => true,
        }),
        verify_micro_blog_token: mock(async () => {
          throw new Error('Network request failed');
        }),
      });

      await store.hydrate();

      expect(tokens.clear_all).not.toHaveBeenCalled();
      expect(store.error_message).toBe(null);
    });
  });
});
