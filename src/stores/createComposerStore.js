import { applySnapshot, flow, getSnapshot, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';
import { build_html_post, build_micropub_form, uses_micropub_form } from './models/composition';

export const MAX_PARALLEL_UPLOADS = 4;
const MAX_UPLOAD_PASSES = 2;

const ComposerMedia = types
  .model('ComposerMedia', {
    id: types.identifier,
    kind: types.enumeration('MediaKind', ['image', 'video']),
    uri: types.string,
    width: types.optional(types.number, 0),
    height: types.optional(types.number, 0),
    mime: types.maybeNull(types.string),
    alt: types.optional(types.string, ''),
    remote_url: types.maybeNull(types.string),
    poster_url: types.maybeNull(types.string),
  })
  .views(self => ({
    is_uploaded() {
      return Boolean(self.remote_url);
    },

    preview_uri() {
      if (self.kind === 'video' && self.poster_url) {
        return self.poster_url;
      } else {
        return self.uri;
      }
    },
  }));

const Section = types.model('Section', {
  id: types.identifier,
  text: types.optional(types.string, ''),
  media: types.array(ComposerMedia),
});

export function create_composer_store({
  micropub,
  destinations,
  get_token,
  prepare_media,
  make_id,
  on_auth_error = () => {},
} = {}) {
  return types
    .model('Composer', {
      sections: types.array(Section),
      title: types.optional(types.string, ''),
      is_posting: types.optional(types.boolean, false),
      uploaded_count: types.optional(types.number, 0),
      upload_total: types.optional(types.number, 0),
      error_message: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
    }))
    .actions(self => ({
      start(assets = []) {
        self.generation += 1;
        applySnapshot(self, { sections: [build_section(assets)] });
      },

      add_media(section_id, assets = []) {
        const section = self.sections.find(item => item.id === section_id);
        const media = assets.map(build_media);

        if (section) {
          section.media.push(...media);
        } else {
          self.sections.push({ id: make_id(), media });
        }
      },

      remove_media(media_id) {
        const section = self.sections.find(item => item.media.some(media => media.id === media_id));

        if (!section) {
          return;
        }

        section.media.splice(section.media.findIndex(media => media.id === media_id), 1);

        if (section.media.length === 0) {
          self.sections.remove(section);
        }
      },

      reorder_media(section_id, ordered_ids = []) {
        const section = self.sections.find(item => item.id === section_id);

        if (!section) {
          return;
        }

        const by_id = new Map(section.media.map(media => [media.id, getSnapshot(media)]));
        const reordered = ordered_ids.map(id => by_id.get(id)).filter(Boolean);

        if (reordered.length === section.media.length) {
          section.media.replace(reordered);
        }
      },

      set_text(section_id, text) {
        const section = self.sections.find(item => item.id === section_id);

        if (section) {
          section.text = text;
        }
      },

      set_title(title) {
        self.title = title;
      },

      set_alt(media_id, alt) {
        const media = self.find_media(media_id);

        if (media) {
          media.alt = alt;
        }
      },

      replace_media_file(media_id, { uri, width, height, mime = null }) {
        const media = self.find_media(media_id);

        if (!media) {
          return;
        }

        media.uri = uri;
        media.width = width;
        media.height = height;
        media.mime = mime || media.mime;
        media.remote_url = null;
        media.poster_url = null;
      },

      mark_uploaded(generation, uploaded, { url, poster }) {
        if (generation !== self.generation) {
          return;
        }

        const media = self.find_media(uploaded.id);

        if (media && media.uri === uploaded.uri) {
          media.remote_url = url;
          media.poster_url = poster || null;
          self.uploaded_count += 1;
        }
      },

      add_to_upload_total(count) {
        self.upload_total += count;
      },

      begin_posting(pending_count) {
        self.generation += 1;
        self.is_posting = true;
        self.error_message = null;
        self.uploaded_count = 0;
        self.upload_total = pending_count;
        return self.generation;
      },

      finish_posting(generation, error_message = null) {
        if (generation !== self.generation) {
          return;
        }

        self.generation += 1;
        self.is_posting = false;
        self.error_message = error_message;
      },

      post: flow(function* () {
        if (self.is_posting || !self.can_post()) {
          return null;
        }

        const pending = self.pending_media();
        const generation = self.begin_posting(pending.length);
        const token = get_token();
        const is_current = () => generation === self.generation;

        try {
          yield destinations.load();

          if (!is_current()) {
            return null;
          }

          if (!destinations.did_load) {
            throw new Error('Could not load your blogs. Check your connection and try again.');
          }

          const destination = destinations.selected();
          const destination_uid = destination ? destination.uid : null;

          const upload = async media => {
            const file = await prepare_media(media);
            const result = await micropub.upload_media({
              token,
              media_endpoint: destinations.media_endpoint || undefined,
              destination_uid,
              file,
            });

            if (!result.url) {
              throw new Error('The server did not return a URL for the uploaded media.');
            }

            self.mark_uploaded(generation, media, result);
          };

          let remaining = pending;

          for (let pass = 0; pass < MAX_UPLOAD_PASSES && remaining.length > 0; pass += 1) {
            yield run_with_limit(remaining, MAX_PARALLEL_UPLOADS, is_current, upload);

            if (!is_current()) {
              return null;
            }

            remaining = self.pending_media();
            self.add_to_upload_total(remaining.length);
          }

          if (remaining.length > 0) {
            throw new Error('A photo changed while it was uploading. Please try posting again.');
          }

          const payload = self.build_payload(destination_uid);
          const location = yield micropub.create_post({ token, ...payload });

          if (!is_current()) {
            return null;
          }

          self.reset();
          return location || '';
        } catch (error) {
          self.finish_posting(generation, resolve_error_message(error));

          if (is_auth_error(error)) {
            yield Promise.resolve(on_auth_error(error));
          }

          return null;
        }
      }),

      cancel_posting() {
        self.generation += 1;
        self.is_posting = false;
      },

      reset() {
        self.generation += 1;
        applySnapshot(self, {});
      },
    }))
    .views(self => ({
      find_media(media_id) {
        for (const section of self.sections) {
          const media = section.media.find(item => item.id === media_id);

          if (media) {
            return media;
          }
        }

        return null;
      },

      all_media() {
        return self.sections.flatMap(section => section.media);
      },

      pending_media() {
        return self.all_media()
          .filter(media => !media.is_uploaded())
          .map(media => getSnapshot(media));
      },

      needs_title() {
        return self.sections.length > 1;
      },

      has_content() {
        return self.sections.some(section => section.media.length > 0 || section.text.trim().length > 0);
      },

      can_post() {
        return self.all_media().length > 0;
      },

      is_publishing() {
        return self.is_posting && self.uploaded_count >= self.upload_total;
      },

      build_payload(destination_uid) {
        const sections = getSnapshot(self.sections);
        const locations = Object.fromEntries(
          self.all_media().map(media => [media.id, { url: media.remote_url, poster: media.poster_url }]),
        );

        if (uses_micropub_form(sections)) {
          return {
            form: build_micropub_form({ section: sections[0], destination_uid, locations }),
          };
        } else {
          return {
            json: build_html_post({ title: self.title, sections, destination_uid, locations }),
          };
        }
      },
    }))
    .create();

  function build_section(assets) {
    return { id: make_id(), media: assets.map(build_media) };
  }

  function build_media(asset) {
    return {
      id: make_id(),
      kind: asset.kind === 'video' ? 'video' : 'image',
      uri: asset.uri,
      width: asset.width || 0,
      height: asset.height || 0,
      mime: asset.mime || null,
      alt: asset.alt || '',
      remote_url: asset.remote_url || null,
      poster_url: asset.poster_url || null,
    };
  }
}

async function run_with_limit(items, limit, should_continue, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0 && should_continue()) {
      await worker(queue.shift());
    }
  });

  await Promise.all(runners);
}

function resolve_error_message(error) {
  if (is_auth_error(error)) {
    return 'Your Micro.blog session expired. Please sign in again.';
  } else if (error?.status) {
    return `Micro.blog could not publish this post (${error.status}).`;
  } else {
    return error?.message || 'Could not publish this post. Please try again.';
  }
}
