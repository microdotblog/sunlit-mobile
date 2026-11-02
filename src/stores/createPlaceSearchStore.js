import { applySnapshot, flow, types } from 'mobx-state-tree';

import { filter_places, normalize_photon_features } from './models/places';

export const MIN_SEARCH_LENGTH = 2;

export function create_place_search_store({ get_location, fetch_nearby, search_places } = {}) {
  return types
    .model('PlaceSearch', {
      status: types.optional(types.enumeration('PlaceSearchStatus', ['idle', 'locating', 'loading', 'ready', 'error']), 'idle'),
      places: types.frozen([]),
      search_results: types.frozen(null),
      origin: types.frozen(null),
      query: types.optional(types.string, ''),
      is_searching: types.optional(types.boolean, false),
      error_message: types.maybeNull(types.string),
      error_code: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
      search_token: 0,
    }))
    .actions(self => ({
      start: flow(function* () {
        self.generation += 1;
        const generation = self.generation;
        applySnapshot(self, { status: 'locating' });

        try {
          const origin = yield get_location();

          if (generation !== self.generation) {
            return;
          }

          self.origin = origin;
          self.status = 'loading';
          const features = yield fetch_nearby(origin);

          if (generation !== self.generation) {
            return;
          }

          self.places = normalize_photon_features(features, origin);
          self.status = 'ready';
        } catch (error) {
          if (generation === self.generation) {
            self.status = 'error';
            self.error_message = error?.message || 'Could not find nearby places.';
            self.error_code = error?.code || null;
          }
        }
      }),

      set_query(query) {
        self.query = query;
        self.search_token += 1;

        if (query.trim().length < MIN_SEARCH_LENGTH) {
          self.search_results = null;
          self.is_searching = false;
        } else {
          self.is_searching = true;
        }
      },

      search: flow(function* () {
        const query = self.query.trim();

        if (query.length < MIN_SEARCH_LENGTH || !self.origin) {
          self.is_searching = false;
          return;
        }

        self.search_token += 1;
        const search_token = self.search_token;
        self.is_searching = true;

        try {
          const features = yield search_places({ query, ...self.origin });

          if (search_token !== self.search_token) {
            return;
          }

          const nearby_matches = filter_places(self.places, query);
          const found = normalize_photon_features(features, self.origin);
          const known_names = new Set(nearby_matches.map(place => place.name.toLowerCase()));

          self.search_results = [...nearby_matches, ...found.filter(place => !known_names.has(place.name.toLowerCase()))];
        } catch (error) {
          if (search_token === self.search_token) {
            self.search_results = filter_places(self.places, query);
          }
        } finally {
          if (search_token === self.search_token) {
            self.is_searching = false;
          }
        }
      }),

      reset() {
        self.generation += 1;
        self.search_token += 1;
        applySnapshot(self, {});
      },
    }))
    .views(self => ({
      visible_places() {
        if (self.query.trim().length >= MIN_SEARCH_LENGTH && self.search_results) {
          return self.search_results;
        } else {
          return filter_places(self.places, self.query);
        }
      },

      is_search_query() {
        return self.query.trim().length >= MIN_SEARCH_LENGTH;
      },
    }))
    .create();
}
