import { applySnapshot, flow, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';

const Destination = types.model('Destination', {
  uid: types.string,
  name: types.string,
  is_default: types.optional(types.boolean, false),
});

export function create_destinations_store({ api, get_token, storage, on_auth_error = () => {} } = {}) {
  return types
    .model('Destinations', {
      destinations: types.array(Destination),
      media_endpoint: types.maybeNull(types.string),
      selected_uid: types.maybeNull(types.string),
      is_loading: types.optional(types.boolean, false),
      did_load: types.optional(types.boolean, false),
      error_message: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
      loading: null,
    }))
    .actions(self => ({
      hydrate: flow(function* () {
        const preferences = yield storage.load();
        self.selected_uid = preferences?.destination_uid || null;
      }),

      load() {
        if (self.did_load) {
          return Promise.resolve();
        }

        return self.refresh();
      },

      refresh() {
        if (!self.loading) {
          self.loading = self.fetch_config().finally(() => self.clear_loading());
        }

        return self.loading;
      },

      clear_loading() {
        self.loading = null;
      },

      fetch_config: flow(function* () {
        const generation = self.generation;
        self.is_loading = true;
        self.error_message = null;

        try {
          const config = yield api.fetch_config({ token: get_token() });

          if (generation !== self.generation) {
            return;
          }

          self.media_endpoint = `${config?.['media-endpoint'] || ''}`.trim() || null;
          self.destinations.replace(normalize_destinations(config?.destination));
          self.did_load = true;
        } catch (error) {
          if (generation === self.generation) {
            self.error_message = 'Could not load your blogs.';
          }

          if (is_auth_error(error)) {
            yield Promise.resolve(on_auth_error(error));
          }
        } finally {
          if (generation === self.generation) {
            self.is_loading = false;
          }
        }
      }),

      select: flow(function* (uid) {
        self.selected_uid = uid;
        yield storage.save({ destination_uid: uid });
      }),

      reset() {
        self.generation += 1;
        self.loading = null;
        applySnapshot(self, {});
        storage.save({ destination_uid: null }).catch(error => {
          console.error('Could not clear the publishing blog.', error);
        });
      },
    }))
    .views(self => ({
      selected() {
        const remembered = self.destinations.find(destination => destination.uid === self.selected_uid);

        if (remembered) {
          return remembered;
        }

        return self.destinations.find(destination => destination.is_default) || self.destinations[0] || null;
      },

      has_choice() {
        return self.destinations.length > 1;
      },
    }))
    .create();
}

function normalize_destinations(destinations) {
  if (!Array.isArray(destinations)) {
    return [];
  }

  return destinations
    .map(destination => ({
      uid: `${destination?.uid || ''}`.trim(),
      name: `${destination?.name || destination?.uid || ''}`.trim(),
      is_default: destination?.['microblog-default'] === true,
    }))
    .filter(destination => destination.uid);
}
