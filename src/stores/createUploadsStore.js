import { applySnapshot, flow, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';

const VIDEO_PATTERN = /\.(mp4|mov|m4v)(\?|$)/i;

export function create_uploads_store({ api, destinations, get_token, on_auth_error = () => {} } = {}) {
  return types
    .model('Uploads', {
      items: types.frozen([]),
      is_loading: types.optional(types.boolean, false),
      did_load: types.optional(types.boolean, false),
      error_message: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
    }))
    .actions(self => ({
      refresh: flow(function* () {
        const generation = self.generation;
        self.is_loading = true;
        self.error_message = null;

        try {
          yield destinations.load();
          const destination = destinations.selected();
          const items = yield api.fetch_uploads({
            token: get_token(),
            media_endpoint: destinations.media_endpoint || undefined,
            destination_uid: destination ? destination.uid : null,
          });

          if (generation !== self.generation) {
            return;
          }

          self.items = normalize_uploads(items);
          self.did_load = true;
        } catch (error) {
          if (generation === self.generation) {
            self.error_message = 'Could not load your uploads.';
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

      reset() {
        self.generation += 1;
        applySnapshot(self, {});
      },
    }))
    .create();
}

export function normalize_uploads(items = []) {
  return items
    .map(item => {
      const url = `${item?.url || ''}`.trim();
      const poster = `${item?.poster || ''}`.trim() || null;
      const is_video = Boolean(poster) || VIDEO_PATTERN.test(url);

      return {
        url,
        poster,
        alt: `${item?.alt || ''}`.trim(),
        kind: is_video ? 'video' : 'image',
      };
    })
    .filter(item => item.url && (item.kind === 'image' || item.poster));
}

export function upload_to_asset(upload) {
  return {
    kind: upload.kind,
    uri: upload.poster || upload.url,
    alt: upload.alt,
    remote_url: upload.url,
    poster_url: upload.poster,
  };
}
