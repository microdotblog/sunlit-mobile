import { describe, expect, it, mock } from 'bun:test';

import { create_places_store, SOURCE_PAGE_SIZE } from './createPlacesStore';

function check_in_item(index) {
  return {
    type: ['h-entry'],
    properties: {
      url: [`https://vincent.blog/${index}.html`],
      published: ['2026-11-02T10:00:00Z'],
      content: [''],
      checkin: [{ type: ['h-card'], properties: { name: [`Place ${index}`], latitude: [45.5], longitude: [-122.6] } }],
    },
  };
}

function note_item(index) {
  return { type: ['h-entry'], properties: { url: [`https://vincent.blog/n${index}.html`], published: ['2026-11-02T10:00:00Z'], content: ['Hi'] } };
}

const PLACE = { id: 'coava', name: 'Coava Coffee', latitude: 45.5232, longitude: -122.6766, url: 'https://maps.apple.com/?q=Coava%20Coffee&ll=45.5232,-122.6766' };

function build_store(overrides = {}) {
  const micropub = {
    fetch_source: mock(async () => [check_in_item(1), note_item(1)]),
    create_post: mock(async () => 'https://vincent.blog/2026/11/02/coava.html'),
    delete_post: mock(async () => null),
    ...overrides.micropub,
  };
  const destinations = {
    did_load: true,
    check_in_uid: 'https://checkins.vincent.blog/',
    load: mock(async () => {}),
    selected_for_check_ins() {
      return { uid: this.check_in_uid, name: 'checkins' };
    },
    ...overrides.destinations,
  };
  const storage = { load: mock(async () => overrides.saved || null), save: mock(async () => {}) };
  const store = create_places_store({
    micropub,
    destinations,
    get_token: () => 'token-1',
    storage,
    now: () => new Date('2026-11-02T10:00:00Z'),
  });

  return { destinations, micropub, storage, store };
}

describe('create_places_store', () => {
  it('lists only posts with a check-in from the check-in blog', async () => {
    const { micropub, store } = build_store();

    await store.load();

    expect(micropub.fetch_source).toHaveBeenCalledWith({
      token: 'token-1',
      destination_uid: 'https://checkins.vincent.blog/',
      offset: 0,
      limit: SOURCE_PAGE_SIZE,
    });
    expect(store.check_ins.map(check_in => check_in.name)).toEqual(['Place 1']);
  });

  it('pages through at most 500 posts', async () => {
    const full_page = Array.from({ length: SOURCE_PAGE_SIZE }, (_, index) => check_in_item(index));
    const { micropub, store } = build_store({ micropub: { fetch_source: mock(async () => full_page) } });

    await store.refresh();

    expect(micropub.fetch_source).toHaveBeenCalledTimes(5);
    expect(micropub.fetch_source.mock.calls[4][0].offset).toBe(400);
  });

  it('posts a delayed check-in to the check-in blog and shows it first', async () => {
    const { micropub, store } = build_store({ saved: { delay_id: 'one_hour' } });
    await store.hydrate();
    await store.load();

    const location = await store.check_in(PLACE, ' Flat white. ');

    const { json } = micropub.create_post.mock.calls[0][0];
    expect(location).toBe('https://vincent.blog/2026/11/02/coava.html');
    expect(json['mp-destination']).toBe('https://checkins.vincent.blog/');
    expect(json.properties.published).toEqual(['2026-11-02T11:00:00Z']);
    expect(json.properties.checkin[0].properties.name).toEqual(['Coava Coffee']);
    expect(store.check_ins[0]).toMatchObject({ name: 'Coava Coffee', note: 'Flat white.' });
  });

  it('refuses to check in while the blogs could not be loaded', async () => {
    const { micropub, store } = build_store({ destinations: { did_load: false } });

    await expect(store.check_in(PLACE, '')).rejects.toThrow('Could not load your blogs');

    expect(micropub.create_post).not.toHaveBeenCalled();
    expect(store.is_posting).toBe(false);
  });

  it('deletes a check-in by its post URL on the check-in blog', async () => {
    const { micropub, store } = build_store();
    await store.load();

    await store.delete_check_in('https://vincent.blog/1.html');

    expect(micropub.delete_post).toHaveBeenCalledWith({
      token: 'token-1',
      url: 'https://vincent.blog/1.html',
      destination_uid: 'https://checkins.vincent.blog/',
    });
    expect(store.check_ins).toHaveLength(0);
  });

  it('reloads when the check-in blog changes and deletes on the blog the list came from', async () => {
    const { destinations, micropub, store } = build_store();
    await store.load();

    destinations.check_in_uid = 'https://photos.vincent.blog/';

    expect(store.is_current()).toBe(false);
    await store.delete_check_in('https://vincent.blog/1.html');
    expect(micropub.delete_post.mock.calls[0][0].destination_uid).toBe('https://checkins.vincent.blog/');

    await store.load();
    expect(micropub.fetch_source.mock.calls.at(-1)[0].destination_uid).toBe('https://photos.vincent.blog/');
    expect(store.is_current()).toBe(true);
  });

  it('does not show a new check-in in the list of another blog', async () => {
    const { destinations, store } = build_store();
    await store.load();
    destinations.check_in_uid = 'https://photos.vincent.blog/';

    await store.check_in(PLACE, '');

    expect(store.check_ins.map(check_in => check_in.name)).toEqual(['Place 1']);
    expect(store.did_load).toBe(false);
  });

  it('does not bring back a deleted check-in from a refresh that started earlier', async () => {
    let resolve_page;
    const { micropub, store } = build_store();
    await store.load();
    micropub.fetch_source.mockImplementationOnce(() => new Promise(resolve => {
      resolve_page = resolve;
    }));

    const refreshing = store.refresh();
    while (!resolve_page) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    await store.delete_check_in('https://vincent.blog/1.html');
    resolve_page([check_in_item(1)]);
    await refreshing;

    expect(store.check_ins).toHaveLength(0);
    expect(store.is_loading).toBe(false);
  });

  it('keeps the latest of two overlapping refreshes', async () => {
    let resolve_first;
    const { micropub, store } = build_store();
    micropub.fetch_source.mockImplementationOnce(() => new Promise(resolve => {
      resolve_first = resolve;
    }));

    const first = store.refresh();
    while (!resolve_first) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    const second = store.refresh();
    resolve_first([check_in_item(9)]);
    await Promise.all([first, second]);

    expect(store.check_ins.map(check_in => check_in.name)).toEqual(['Place 1']);
    expect(store.is_loading).toBe(false);
  });

  it('remembers the delay', async () => {
    const { storage, store } = build_store();

    await store.set_delay('one_day');

    expect(store.delay().title).toBe('1 day');
    expect(storage.save).toHaveBeenCalledWith({ delay_id: 'one_day' });
  });
});
