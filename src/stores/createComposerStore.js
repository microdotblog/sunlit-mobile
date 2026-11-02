import { applySnapshot, flow, getSnapshot, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';
import { describe_publish_error } from './publishers';

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
    uploaded_key: types.maybeNull(types.string),
  })
  .views(self => ({
    is_uploaded(target_key = null) {
      return Boolean(self.remote_url) && (!self.uploaded_key || self.uploaded_key === target_key);
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
  publishing,
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
        media.uploaded_key = null;
      },

      mark_uploaded(generation, uploaded, { url, poster }, target_key) {
        if (generation !== self.generation) {
          return;
        }

        const media = self.find_media(uploaded.id);

        if (media && media.uri === uploaded.uri) {
          media.remote_url = url;
          media.poster_url = poster || null;
          media.uploaded_key = target_key;
          self.uploaded_count += 1;
        }
      },

      set_upload_total(count) {
        self.upload_total = count;
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

        const generation = self.begin_posting(self.all_media().length);
        const is_current = () => generation === self.generation;
        let publisher = null;

        try {
          yield publishing.load();

          if (!is_current()) {
            return null;
          }

          if (!publishing.is_ready()) {
            throw new Error('Could not load your blogs. Check your connection and try again.');
          }

          publisher = yield publishing.for_posts();

          if (!publisher) {
            throw new Error('Choose a blog to post to in Settings.');
          }

          const target_key = publisher.key;

          if (!publisher.supports_video && self.all_media().some(media => media.kind === 'video' && !media.is_uploaded(target_key))) {
            throw new Error(`${publisher.name} can’t receive videos from Sunlit. Remove the video or choose another blog.`);
          }

          const upload = async media => {
            const file = await prepare_media(media);
            const result = await publisher.upload(file);

            if (!result.url) {
              throw new Error('The server did not return a URL for the uploaded media.');
            }

            self.mark_uploaded(generation, media, result, target_key);
          };

          let remaining = self.pending_media(target_key);
          self.set_upload_total(remaining.length);

          for (let pass = 0; pass < MAX_UPLOAD_PASSES && remaining.length > 0; pass += 1) {
            yield run_with_limit(remaining, MAX_PARALLEL_UPLOADS, is_current, upload);

            if (!is_current()) {
              return null;
            }

            remaining = self.pending_media(target_key);
            self.add_to_upload_total(remaining.length);
          }

          if (remaining.length > 0) {
            throw new Error('A photo changed while it was uploading. Please try posting again.');
          }

          const location = yield publisher.publish(self.post_content());

          if (!is_current()) {
            return null;
          }

          self.reset();
          return location || '';
        } catch (error) {
          self.finish_posting(generation, describe_publish_error(error, publisher));

          if (is_auth_error(error) && publisher?.is_microblog) {
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

      pending_media(target_key = null) {
        return self.all_media()
          .filter(media => !media.is_uploaded(target_key))
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

      post_content() {
        const sections = getSnapshot(self.sections);
        const locations = Object.fromEntries(
          self.all_media().map(media => [media.id, { url: media.remote_url, poster: media.poster_url }]),
        );
        const title = sections.length > 1 ? self.title : '';

        return { sections, title, locations };
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
