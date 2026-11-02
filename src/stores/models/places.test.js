import { describe, expect, it } from 'bun:test';

import {
  build_check_in_post,
  filter_places,
  format_distance,
  is_scheduled,
  maps_url,
  normalize_check_ins,
  normalize_photon_features,
  published_date,
} from './places';

const ORIGIN = { latitude: 45.5231, longitude: -122.6765 };

function feature(name, latitude, longitude, extra = {}) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties: { name, ...extra } };
}

describe('normalize_photon_features', () => {
  it('turns Photon features into places sorted by distance', () => {
    const places = normalize_photon_features(
      [
        feature('Far Park', 45.53, -122.6765),
        feature('Coava Coffee', 45.5232, -122.6766, { housenumber: '1300', street: 'SE Grand Ave', city: 'Portland' }),
        feature('', 45.5233, -122.6766),
      ],
      ORIGIN,
    );

    expect(places.map(place => place.name)).toEqual(['Coava Coffee', 'Far Park']);
    expect(places[0].address).toBe('1300 SE Grand Ave, Portland');
    expect(places[0].url).toBe('https://maps.apple.com/?q=Coava%20Coffee&ll=45.5232,-122.6766');
    expect(format_distance(places[1].distance)).toBe('770 m');
  });

  it('merges duplicates of one venue but keeps branches apart', () => {
    const places = normalize_photon_features(
      [feature('Stumptown', 45.5232, -122.6766), feature('Stumptown', 45.5233, -122.6766), feature('Stumptown', 45.529, -122.6766)],
      ORIGIN,
    );

    expect(places).toHaveLength(2);
  });
});

describe('filter_places', () => {
  it('matches names and addresses without caring about case', () => {
    const places = [
      { name: 'Coava Coffee', address: 'SE Grand Ave' },
      { name: 'Powell’s', address: 'Burnside' },
    ];

    expect(filter_places(places, 'grand')).toHaveLength(1);
    expect(filter_places(places, '  ')).toHaveLength(2);
  });
});

describe('build_check_in_post', () => {
  it('matches the iOS check-in h-entry', () => {
    const post = build_check_in_post({
      place: { name: 'Coava Coffee', latitude: 45.5232, longitude: -122.6766, url: maps_url('Coava Coffee', 45.5232, -122.6766) },
      note: ' Flat white. ',
      published: new Date('2026-11-02T10:00:00.000Z'),
      destination_uid: 'https://vincent.blog/',
    });

    expect(post).toEqual({
      type: ['h-entry'],
      properties: {
        published: ['2026-11-02T10:00:00Z'],
        content: ['Flat white.'],
        checkin: [
          {
            type: ['h-card'],
            properties: {
              name: ['Coava Coffee'],
              latitude: [45.5232],
              longitude: [-122.6766],
              url: ['https://maps.apple.com/?q=Coava%20Coffee&ll=45.5232,-122.6766'],
            },
          },
        ],
      },
      'mp-destination': 'https://vincent.blog/',
    });
  });
});

describe('published_date', () => {
  it('schedules check-ins with the chosen delay', () => {
    const now = new Date('2026-11-02T10:00:00Z');

    expect(published_date('two_hours', now).toISOString()).toBe('2026-11-02T12:00:00.000Z');
    expect(published_date('unknown', now).toISOString()).toBe('2026-11-02T10:00:00.000Z');
  });
});

describe('normalize_check_ins edge cases', () => {
  it('reads flat locations, rich content and uid ids, newest first', () => {
    const check_ins = normalize_check_ins([
      {
        properties: {
          uid: [42],
          published: ['2026-11-01T10:00:00Z'],
          content: [{ value: 'Old one', html: '<p>Old one</p>' }],
          location: [{ name: ['Pier'], latitude: [45.1], longitude: ['-122.2'] }],
        },
      },
      {
        properties: {
          url: ['https://vincent.blog/new.html'],
          published: ['2026-11-02T10:00:00Z'],
          checkin: [{ properties: { name: ['Cafe'], latitude: [45.2], longitude: [-122.3] } }],
        },
      },
    ]);

    expect(check_ins.map(check_in => check_in.name)).toEqual(['Cafe', 'Pier']);
    expect(check_ins[1]).toMatchObject({ id: '42', note: 'Old one', longitude: -122.2 });
  });

  it('ignores venues with empty or made-up coordinates', () => {
    const check_ins = normalize_check_ins([
      { properties: { published: ['2026-11-02T10:00:00Z'], checkin: [{ properties: { name: ['Nowhere'], latitude: [''], longitude: [null] } }] } },
      { properties: { published: ['2026-11-02T10:00:00Z'], checkin: [{ properties: { name: [{}], latitude: [1], longitude: [2] } }] } },
      { properties: { published: ['2026-11-02T10:00:00Z'], checkin: [{ properties: { name: ['Bool'], latitude: [true], longitude: [true] } }] } },
    ]);

    expect(check_ins).toEqual([]);
  });
});

describe('is_scheduled', () => {
  it('flags check-ins published in the future', () => {
    const now = new Date('2026-11-02T10:00:00Z');

    expect(is_scheduled({ published: '2026-11-02T11:00:00.000Z' }, now)).toBe(true);
    expect(is_scheduled({ published: '2026-11-02T09:00:00.000Z' }, now)).toBe(false);
  });
});

describe('normalize_check_ins', () => {
  it('keeps posts with a check-in or location and skips the rest', () => {
    const check_ins = normalize_check_ins([
      {
        type: ['h-entry'],
        properties: {
          url: ['https://vincent.blog/2026/11/02/coffee.html'],
          published: ['2026-11-02T10:00:00+00:00'],
          content: ['Flat white.'],
          checkin: [{ type: ['h-card'], properties: { name: ['Coava Coffee'], latitude: ['45.5232'], longitude: [-122.6766] } }],
        },
      },
      { type: ['h-entry'], properties: { url: ['https://vincent.blog/p.html'], published: ['2026-11-01T10:00:00Z'], content: ['Hello'] } },
    ]);

    expect(check_ins).toEqual([
      {
        id: 'https://vincent.blog/2026/11/02/coffee.html',
        name: 'Coava Coffee',
        latitude: 45.5232,
        longitude: -122.6766,
        place_url: null,
        note: 'Flat white.',
        published: '2026-11-02T10:00:00.000Z',
        post_url: 'https://vincent.blog/2026/11/02/coffee.html',
      },
    ]);
  });
});
