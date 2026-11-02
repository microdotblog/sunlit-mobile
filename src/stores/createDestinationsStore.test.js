import { describe, expect, it, mock } from 'bun:test';

import { create_destinations_store } from './createDestinationsStore';

const CONFIG = {
  'media-endpoint': 'https://micro.blog/micropub/media',
  destination: [
    { uid: 'https://photos.vincent.blog/', name: 'photos.vincent.blog' },
    { uid: 'https://vincent.blog/', name: 'vincent.blog', 'microblog-default': true },
  ],
};

function build_store(saved = null) {
  const storage = { load: mock(async () => saved), save: mock(async () => {}) };
  const api = { fetch_config: mock(async () => CONFIG) };
  const store = create_destinations_store({ api, get_token: () => 'token-1', storage });

  return { api, storage, store };
}

describe('create_destinations_store', () => {
  it('lists external blogs as targets and keeps XML-RPC blogs out of check-ins', async () => {
    const storage = { load: mock(async () => null), save: mock(async () => {}) };
    const external_blogs = {
      blogs: [
        { id: 'wp', name: 'wp.example', kind: 'xmlrpc' },
        { id: 'mp', name: 'me.example', kind: 'micropub' },
      ],
    };
    const store = create_destinations_store({ api: { fetch_config: mock(async () => CONFIG) }, get_token: () => 't', storage, external_blogs });
    await store.load();

    expect(store.targets().map(target => target.key)).toEqual(['https://photos.vincent.blog/', 'https://vincent.blog/', 'external:wp', 'external:mp']);
    expect(store.check_in_targets().map(target => target.key)).not.toContain('external:wp');

    await store.select('external:wp');
    expect(store.selected_target().kind).toBe('xmlrpc');
    expect(store.selected_check_in_target().key).toBe('https://vincent.blog/');
  });

  it('uses the Micro.blog default blog until one is chosen', async () => {
    const { store } = build_store();

    await store.load();

    expect(store.media_endpoint).toBe('https://micro.blog/micropub/media');
    expect(store.selected().name).toBe('vincent.blog');
  });

  it('remembers the chosen blog', async () => {
    const { storage, store } = build_store();
    await store.load();

    await store.select('https://photos.vincent.blog/');

    expect(storage.save).toHaveBeenCalledWith({ destination_uid: 'https://photos.vincent.blog/', check_in_uid: null });
    expect(store.selected().name).toBe('photos.vincent.blog');
  });

  it('keeps a separate blog for check-ins that follows posts until chosen', async () => {
    const { storage, store } = build_store();
    await store.load();

    expect(store.selected_check_in_target().uid).toBe('https://vincent.blog/');

    await store.select_for_check_ins('https://photos.vincent.blog/');

    expect(store.selected_check_in_target().uid).toBe('https://photos.vincent.blog/');
    expect(store.selected().uid).toBe('https://vincent.blog/');
    expect(storage.save).toHaveBeenLastCalledWith({ destination_uid: null, check_in_uid: 'https://photos.vincent.blog/' });
  });

  it('restores the chosen blog on launch', async () => {
    const { store } = build_store({ destination_uid: 'https://photos.vincent.blog/' });

    await store.hydrate();
    await store.load();

    expect(store.selected().uid).toBe('https://photos.vincent.blog/');
  });

  it('shares one request between callers that load at the same time', async () => {
    const { api, store } = build_store();

    await Promise.all([store.load(), store.load(), store.refresh()]);

    expect(api.fetch_config).toHaveBeenCalledTimes(1);
    expect(store.did_load).toBe(true);
  });

  it('ignores blogs that arrive after a sign out', async () => {
    let resolve_config;
    const { api, store } = build_store();
    api.fetch_config.mockImplementationOnce(() => new Promise(resolve => {
      resolve_config = resolve;
    }));

    const loading = store.load();
    store.reset();
    resolve_config(CONFIG);
    await loading;

    expect(store.did_load).toBe(false);
    expect(store.destinations).toHaveLength(0);
  });

  it('falls back to the default when the saved blog is gone', async () => {
    const { store } = build_store({ destination_uid: 'https://old.blog/' });

    await store.hydrate();
    await store.load();

    expect(store.selected().uid).toBe('https://vincent.blog/');
  });
});
