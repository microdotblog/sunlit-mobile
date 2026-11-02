import { types } from 'mobx-state-tree';

import { parse_post_html, paragraphs_to_plain_text, resolve_aspect_ratio } from './postContent';

export const PostAuthor = types
  .model('PostAuthor', {
    username: types.optional(types.string, ''),
    name: types.optional(types.string, ''),
    avatar: types.optional(types.string, ''),
    url: types.optional(types.string, ''),
  })
  .views(self => ({
    display_name() {
      if (self.name) {
        return self.name;
      } else {
        return self.username;
      }
    },
  }));

const Post = types
  .model('Post', {
    id: types.identifier,
    url: types.optional(types.string, ''),
    date_published: types.maybeNull(types.string),
    author: PostAuthor,
    media: types.frozen([]),
    paragraphs: types.frozen([]),
    aspect_ratio: types.optional(types.number, 1),
    blurhash: types.maybeNull(types.string),
    is_bookmark: types.optional(types.boolean, false),
    is_deletable: types.optional(types.boolean, false),
    is_conversation: types.optional(types.boolean, false),
  })
  .actions(self => ({
    set_is_bookmark(is_bookmark) {
      self.is_bookmark = is_bookmark;
    },
  }))
  .views(self => ({
    has_media() {
      return self.media.length > 0;
    },

    has_text() {
      return self.paragraphs.length > 0;
    },

    plain_text() {
      return paragraphs_to_plain_text(self.paragraphs);
    },

    first_image_url() {
      const first_media = self.media.find(item => item.url);

      if (first_media) {
        return first_media.url;
      } else {
        return null;
      }
    },

    mentioned_usernames() {
      const text = self.plain_text();
      const mentioned = [...text.matchAll(/@([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g)].map(match => match[1]);

      return [...new Set([self.author.username, ...mentioned].filter(Boolean))];
    },
  }));

export function normalize_post(item = {}) {
  const microblog = item?._microblog || {};
  const author = item?.author || {};
  const default_photo = microblog.default_photo || null;
  const { media, paragraphs } = parse_post_html(item?.content_html || '');

  return {
    id: `${item?.id || ''}`,
    url: `${item?.url || ''}`,
    date_published: item?.date_published || null,
    author: {
      username: `${author?._microblog?.username || author?.username || ''}`,
      name: `${author?.name || ''}`,
      avatar: `${author?.avatar || ''}`,
      url: `${author?.url || ''}`,
    },
    media: media.filter(item => item.url),
    paragraphs,
    aspect_ratio: resolve_aspect_ratio(media, default_photo),
    blurhash: `${default_photo?.blurhash || ''}`.trim() || null,
    is_bookmark: Boolean(microblog.is_bookmark),
    is_deletable: Boolean(microblog.is_deletable),
    is_conversation: Boolean(microblog.is_conversation),
  };
}

export function normalize_posts(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalize_post).filter(post => post.id);
}

export default Post;
