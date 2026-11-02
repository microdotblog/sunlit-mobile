import { describe, expect, it } from 'bun:test';

import { afterEach, mock } from 'bun:test';

import { build_bbox, fetch_nearby_features, search_place_features, tiles_around, TILE_SIZE } from './OpenStreetMap';

describe('build_bbox', () => {
  it('spans about ten kilometres in each direction', () => {
    const [west, south, east, north] = build_bbox({ latitude: 0, longitude: 0 }, 10000).split(',').map(Number);

    expect(north).toBeCloseTo(0.0898, 3);
    expect(south).toBeCloseTo(-0.0898, 3);
    expect(east).toBeCloseTo(0.0898, 3);
    expect(west).toBeCloseTo(-0.0898, 3);
  });
});

describe('tiles_around', () => {
  it('uses one tile when the point sits in the middle of it', () => {
    const tiles = tiles_around({ latitude: 45.52345, longitude: -122.67725 }, { zoom: 16 });

    expect(tiles.length).toBeGreaterThanOrEqual(1);
    tiles.forEach(tile => {
      expect(tile.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/);
      expect(tile.left).toBeLessThanOrEqual(0.25 * TILE_SIZE);
      expect(tile.left).toBeGreaterThan(-1.25 * TILE_SIZE);
    });
  });

  it('never needs more than four tiles', () => {
    expect(tiles_around({ latitude: 0.0001, longitude: 0.0001 }, { zoom: 16 }).length).toBeLessThanOrEqual(4);
  });
});

describe('fetch_nearby_features', () => {
  const original_fetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original_fetch;
  });

  it('asks Photon for named places within a kilometre and identifies the app', async () => {
    const fetch_mock = mock(async () => new Response('{"features":[{"type":"Feature"}]}'));
    globalThis.fetch = fetch_mock;

    const features = await fetch_nearby_features({ latitude: 45.5, longitude: -122.6 });

    const [url, options] = fetch_mock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(features).toHaveLength(1);
    expect(url.startsWith('https://photon.komoot.io/reverse?')).toBe(true);
    expect(params.get('radius')).toBe('1');
    expect(params.getAll('osm_tag')).toContain('amenity');
    expect(params.getAll('osm_tag')).toContain('!amenity:parking');
    expect(options.headers['User-Agent']).toMatch(/^Sunlit\/\d+\.\d+\.\d+ \(Android/);
  });

  it('turns a dropped connection into a friendly error', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(fetch_nearby_features({ latitude: 45.5, longitude: -122.6 })).rejects.toThrow('Nearby places could not be loaded.');
  });
});

describe('search_place_features', () => {
  const original_fetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original_fetch;
  });

  it('only searches places, within ten kilometres', async () => {
    const fetch_mock = mock(async () => new Response('{"features":[]}'));
    globalThis.fetch = fetch_mock;

    await search_place_features({ query: 'coava', latitude: 45.5, longitude: -122.6 });

    const params = new URL(fetch_mock.mock.calls[0][0]).searchParams;
    expect(params.get('q')).toBe('coava');
    expect(params.getAll('osm_tag')).toContain('shop');
    expect(params.get('bbox').split(',')).toHaveLength(4);
  });
});
