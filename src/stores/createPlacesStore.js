import { applySnapshot, flow, types } from 'mobx-state-tree';

import { create_request_error, is_auth_error } from '../api/request';
import { describe_publish_error } from './publishers';
import { build_check_in_post, find_delay, normalize_check_ins, published_date, sort_check_ins } from './models/places';

export const SOURCE_PAGE_SIZE = 100;
export const SOURCE_POST_LIMIT = 500;

export function create_places_store({ publishing, storage, now = () => new Date(), on_auth_error = () => {} } = {}) {
  return types
    .model('Places', {
      check_ins: types.frozen([]),
      loaded_uid: types.maybeNull(types.string),
      delay_id: types.optional(types.string, 'none'),
      is_loading: types.optional(types.boolean, false),
      did_load: types.optional(types.boolean, false),
      is_posting: types.optional(types.boolean, false),
      error_message: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
      deleting_ids: new Set(),
    }))
    .actions(self => ({
      hydrate: flow(function* () {
        const preferences = yield storage.load();
        self.delay_id = find_delay(preferences?.delay_id).id;
      }),

      set_delay: flow(function* (delay_id) {
        self.delay_id = find_delay(delay_id).id;
        yield storage.save({ delay_id: self.delay_id });
      }),

      load: flow(function* () {
        yield publishing.load();

        if (self.is_current() || self.is_loading) {
          return;
        }

        yield self.refresh();
      }),

      refresh: flow(function* () {
        const generation = self.begin_loading();
        let publisher = null;

        try {
          yield publishing.load();
          const key = publishing.check_in_key();
          publisher = yield publishing.for_check_ins();

          if (!publisher) {
            throw new Error('Choose a blog for check-ins in Settings.');
          }

          const items = [];

          for (let offset = 0; offset < SOURCE_POST_LIMIT; offset += SOURCE_PAGE_SIZE) {
            const page = yield publisher.fetch_source({ offset, limit: SOURCE_PAGE_SIZE });

            if (generation !== self.generation) {
              return;
            }

            items.push(...page.slice(0, SOURCE_PAGE_SIZE));

            if (page.length < SOURCE_PAGE_SIZE) {
              break;
            }
          }

          self.check_ins = normalize_check_ins(items);
          self.loaded_uid = key;
          self.did_load = true;
        } catch (error) {
          if (generation === self.generation) {
            self.error_message = 'Could not load your check-ins.';
          }

          yield handle_error(error, publisher);
        } finally {
          if (generation === self.generation) {
            self.is_loading = false;
          }
        }
      }),

      check_in: flow(function* (place, note = '') {
        if (self.is_posting) {
          return null;
        }

        self.is_posting = true;
        self.error_message = null;
        let publisher = null;

        try {
          yield publishing.load();

          if (!publishing.is_ready()) {
            throw new Error('Could not load your blogs. Check your connection and try again.');
          }

          const uid = publishing.check_in_key();
          publisher = yield publishing.for_check_ins();

          if (!publisher) {
            throw new Error('Choose a blog for check-ins in Settings.');
          }

          const published = published_date(self.delay_id, now());
          const location = yield publisher.create_json(
            build_check_in_post({ place, note, published, destination_uid: publisher.destination_uid }),
          );

          self.stop_loading();

          if (self.loaded_uid === uid) {
            self.add_check_in({
              id: location || `${place.id}-${published.toISOString()}`,
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude,
              place_url: place.url,
              note: note.trim(),
              published: published.toISOString(),
              post_url: location || null,
            });
          } else {
            self.did_load = false;
          }

          return location || '';
        } catch (error) {
          yield handle_error(error, publisher);
          throw create_request_error(describe_publish_error(error, publisher, 'post this check-in'), error?.status);
        } finally {
          self.is_posting = false;
        }
      }),

      delete_check_in: flow(function* (check_in_id) {
        const check_in = self.check_ins.find(item => item.id === check_in_id);

        if (!check_in || !check_in.post_url) {
          throw new Error('This check-in does not have a post to delete.');
        }

        if (self.deleting_ids.has(check_in_id)) {
          return;
        }

        if (self.loaded_uid !== publishing.check_in_key()) {
          throw new Error('Your check-in blog changed. Pull to refresh and try again.');
        }

        self.deleting_ids.add(check_in_id);
        let publisher = null;

        try {
          publisher = yield publishing.for_check_ins();
          yield publisher.delete_post(check_in.post_url);

          self.stop_loading();
          self.remove_check_in(check_in_id);
        } catch (error) {
          yield handle_error(error, publisher);
          throw create_request_error(describe_publish_error(error, publisher, 'delete this check-in'), error?.status);
        } finally {
          self.deleting_ids.delete(check_in_id);
        }
      }),

      begin_loading() {
        self.generation += 1;
        self.is_loading = true;
        self.error_message = null;
        return self.generation;
      },

      stop_loading() {
        self.generation += 1;
        self.is_loading = false;
      },

      add_check_in(check_in) {
        self.check_ins = sort_check_ins([check_in, ...self.check_ins.filter(item => item.id !== check_in.id)]);
      },

      remove_check_in(check_in_id) {
        self.check_ins = self.check_ins.filter(item => item.id !== check_in_id);
      },

      reset() {
        self.generation += 1;
        applySnapshot(self, { delay_id: self.delay_id });
      },
    }))
    .views(self => ({
      delay() {
        return find_delay(self.delay_id);
      },

      is_current() {
        return self.did_load && self.loaded_uid === publishing.check_in_key();
      },
    }))
    .create();

  function handle_error(error, publisher) {
    if (is_auth_error(error) && publisher?.is_microblog) {
      return Promise.resolve(on_auth_error(error));
    } else {
      return Promise.resolve();
    }
  }
}
