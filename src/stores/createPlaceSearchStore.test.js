import { describe, expect, it, mock } from 'bun:test';

import { create_place_search_store } from './createPlaceSearchStore';

const ORIGIN = { latitude: 45.5231, longitude: -122.6765 };
function feature(name, latitude, longitude) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties: { name } };
}

const ELEMENTS = [feature('Coava Coffee', 45.5232, -122.6766), feature('Lardo', 45.524, -122.6766)];

function build_store(overrides = {}) {
  const dependencies = {
    get_location: mock(async () => ORIGIN),
    fetch_nearby: mock(async () => ELEMENTS),
    search_places: mock(async () => [feature('Powell’s City of Books', 45.5231, -122.6813)]),
    ...overrides,
  };

  return { dependencies, store: create_place_search_store(dependencies) };
}

describe('create_place_search_store', () => {
  it('finds nearby places from the current location', async () => {
    const { dependencies, store } = build_store();

    await store.start();

    expect(dependencies.fetch_nearby).toHaveBeenCalledWith(ORIGIN);
    expect(store.status).toBe('ready');
    expect(store.visible_places().map(place => place.name)).toEqual(['Coava Coffee', 'Lardo']);
  });

  it('filters nearby places straight away while typing', async () => {
    const { dependencies, store } = build_store();
    await store.start();

    store.set_query('lar');

    expect(store.visible_places().map(place => place.name)).toEqual(['Lardo']);
    expect(dependencies.search_places).not.toHaveBeenCalled();
  });

  it('searches further away and keeps nearby matches first', async () => {
    const { dependencies, store } = build_store();
    await store.start();
    store.set_query('powell');

    await store.search();

    expect(dependencies.search_places).toHaveBeenCalledWith({ query: 'powell', ...ORIGIN });
    expect(store.visible_places().map(place => place.name)).toEqual(['Powell’s City of Books']);

    store.set_query('powel');
    expect(store.visible_places().map(place => place.name)).toEqual(['Powell’s City of Books']);
    expect(store.is_searching).toBe(true);

    store.set_query('p');
    expect(store.visible_places()).toEqual([]);
    expect(store.is_searching).toBe(false);
  });

  it('drops results for a query that has since changed', async () => {
    let resolve_search;
    const { dependencies, store } = build_store();
    dependencies.search_places.mockImplementationOnce(() => new Promise(resolve => {
      resolve_search = resolve;
    }));
    await store.start();
    store.set_query('powell');

    const searching = store.search();
    store.set_query('lardo');
    resolve_search([feature('Powell’s City of Books', 45.5231, -122.6813)]);
    await searching;

    expect(store.visible_places().map(place => place.name)).toEqual(['Lardo']);
  });

  it('falls back to nearby matches when the search fails', async () => {
    const { store } = build_store({
      search_places: mock(async () => {
        throw new Error('offline');
      }),
    });
    await store.start();
    store.set_query('coava');

    await store.search();

    expect(store.visible_places().map(place => place.name)).toEqual(['Coava Coffee']);
    expect(store.is_searching).toBe(false);
  });

  it('explains when location is not available', async () => {
    const { store } = build_store({
      get_location: mock(async () => {
        const error = new Error('Allow location access for Sunlit to find nearby places.');
        error.code = 'permission';
        throw error;
      }),
    });

    await store.start();

    expect(store.status).toBe('error');
    expect(store.error_message).toBe('Allow location access for Sunlit to find nearby places.');
    expect(store.error_code).toBe('permission');
  });

  it('ignores places from a search that was started again', async () => {
    let resolve_first;
    const { dependencies, store } = build_store();
    dependencies.fetch_nearby.mockImplementationOnce(() => new Promise(resolve => {
      resolve_first = resolve;
    }));

    const first = store.start();
    while (!resolve_first) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    const second = store.start();
    resolve_first([feature('Stale', 45.5232, -122.6766)]);
    await Promise.all([first, second]);

    expect(store.visible_places().map(place => place.name)).toEqual(['Coava Coffee', 'Lardo']);
  });
});
