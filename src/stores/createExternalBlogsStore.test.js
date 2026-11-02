import { describe, expect, it, mock } from 'bun:test';

import { create_external_blogs_store } from './createExternalBlogsStore';

function build_store(overrides = {}) {
  let next_id = 0;
  const storage = {
    load_blogs: mock(async () => []),
    save_blogs: mock(async () => {}),
    save_secret: mock(async () => {}),
    delete_secret: mock(async () => {}),
  };
  const dependencies = {
    storage,
    discover_blog: mock(async () => ({
      url: 'https://me.example/',
      name: 'me.example',
      micropub: 'https://me.example/micropub',
      authorization_endpoint: 'https://indieauth.example/auth',
      token_endpoint: 'https://indieauth.example/token',
      edit_uri: null,
    })),
    fetch_rsd: mock(async () => ({ endpoint: 'https://wp.example/xmlrpc.php', blog_id: '1' })),
    get_users_blogs: mock(async () => [{ blogid: '1' }]),
    build_auth_url: mock(({ state }) => `https://indieauth.example/auth?state=${state}`),
    open_auth_session: mock(async auth_url => ({ type: 'success', url: `sunlit://micropub?code=abc&state=${new URL(auth_url).searchParams.get('state')}` })),
    parse_callback: url => ({ code: new URL(url).searchParams.get('code'), state: new URL(url).searchParams.get('state') }),
    exchange_code: mock(async () => ({ access_token: 'external-token', me: 'https://me.example/' })),
    fetch_config: mock(async () => ({ 'media-endpoint': 'https://me.example/media' })),
    create_pkce: async () => ({ verifier: 'verifier', challenge: 'challenge' }),
    callback_url: 'sunlit://micropub',
    make_id: () => `id-${(next_id += 1)}`,
    ...overrides,
  };

  return { dependencies, storage, store: create_external_blogs_store(dependencies) };
}

describe('create_external_blogs_store', () => {
  it('connects a Micropub blog through IndieAuth and keeps the token out of the blog list', async () => {
    const { dependencies, storage, store } = build_store();

    const result = await store.discover('me.example');

    expect(result).toEqual({ kind: 'micropub', blog_id: 'id-2' });
    expect(dependencies.build_auth_url.mock.calls[0][0].code_challenge).toBe('challenge');
    expect(dependencies.exchange_code).toHaveBeenCalledWith({
      token_endpoint: 'https://indieauth.example/token',
      code: 'abc',
      me: 'https://me.example/',
      code_verifier: 'verifier',
    });
    expect(storage.save_secret).toHaveBeenCalledWith('id-2', { token: 'external-token' });
    expect(store.blogs[0]).toMatchObject({ kind: 'micropub', micropub_endpoint: 'https://me.example/micropub', media_endpoint: 'https://me.example/media' });
    expect(JSON.stringify(storage.save_blogs.mock.calls[0][0])).not.toContain('external-token');
  });

  it('refuses a sign in whose state does not match', async () => {
    const { store } = build_store({ open_auth_session: mock(async () => ({ type: 'success', url: 'sunlit://micropub?code=abc&state=forged' })) });

    const result = await store.discover('me.example');

    expect(result).toBe(null);
    expect(store.blogs).toHaveLength(0);
    expect(store.error_message).toBe('The blog sign in could not be verified. Please try again.');
  });

  it('asks for a password for XML-RPC blogs and verifies it before saving', async () => {
    const { dependencies, storage, store } = build_store({
      discover_blog: mock(async () => ({ url: 'https://wp.example/', name: 'wp.example', micropub: null, edit_uri: 'https://wp.example/xmlrpc.php?rsd' })),
    });

    const result = await store.discover('wp.example');
    expect(result).toEqual({ kind: 'xmlrpc', blog_id: null });
    expect(store.needs_password()).toBe(true);

    const blog_id = await store.connect_xmlrpc('vincent', 'secret');

    expect(dependencies.get_users_blogs).toHaveBeenCalledWith({ endpoint: 'https://wp.example/xmlrpc.php', username: 'vincent', password: 'secret' });
    expect(storage.save_secret).toHaveBeenCalledWith(blog_id, { password: 'secret' });
    expect(store.get_blog(blog_id)).toMatchObject({ kind: 'xmlrpc', is_wordpress: true, blog_id: '1', username: 'vincent' });
    expect(store.needs_password()).toBe(false);
  });

  it('keeps nothing when the password is wrong', async () => {
    const { storage, store } = build_store({
      discover_blog: mock(async () => ({ url: 'https://wp.example/', name: 'wp.example', edit_uri: 'https://wp.example/xmlrpc.php?rsd' })),
      get_users_blogs: mock(async () => {
        throw new Error('Incorrect username or password. (error 403)');
      }),
    });
    await store.discover('wp.example');

    const blog_id = await store.connect_xmlrpc('vincent', 'wrong');

    expect(blog_id).toBe(null);
    expect(storage.save_secret).not.toHaveBeenCalled();
    expect(store.error_message).toBe('Incorrect username or password. (error 403)');
  });

  it('refuses a token issued for a different site', async () => {
    const { store } = build_store({ exchange_code: mock(async () => ({ access_token: 't', me: 'https://someone-else.example/' })) });

    const result = await store.discover('me.example');

    expect(result).toBe(null);
    expect(store.blogs).toHaveLength(0);
    expect(store.error_message).toBe('The blog signed in as a different site. Please try again.');
  });

  it('won’t send a password to an XML-RPC endpoint without https', async () => {
    const { dependencies, store } = build_store({
      discover_blog: mock(async () => ({ url: 'https://wp.example/', name: 'wp.example', edit_uri: 'https://wp.example/xmlrpc.php?rsd' })),
      fetch_rsd: mock(async () => ({ endpoint: 'http://wp.example/xmlrpc.php', blog_id: '1' })),
    });
    await store.discover('wp.example');

    const blog_id = await store.connect_xmlrpc('vincent', 'secret');

    expect(blog_id).toBe(null);
    expect(dependencies.get_users_blogs).not.toHaveBeenCalled();
  });

  it('forgets a discovery that finishes after the screen was closed', async () => {
    let finish_discovery;
    const { store } = build_store({
      discover_blog: mock(
        () =>
          new Promise(resolve => {
            finish_discovery = () => resolve({ url: 'https://wp.example/', name: 'wp.example', edit_uri: 'https://wp.example/xmlrpc.php?rsd' });
          }),
      ),
    });

    const discovering = store.discover('wp.example');
    store.cancel_discovery();
    finish_discovery();

    expect(await discovering).toBe(null);
    expect(store.needs_password()).toBe(false);
    expect(store.is_working).toBe(false);
  });

  it('forgets every blog and secret on sign out', async () => {
    const { storage, store } = build_store();
    await store.discover('me.example');

    await store.reset();

    expect(store.blogs).toHaveLength(0);
    expect(storage.delete_secret).toHaveBeenCalledWith('id-2');
  });
});
