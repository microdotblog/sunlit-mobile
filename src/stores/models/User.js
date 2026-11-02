import { types } from 'mobx-state-tree';

import { paragraphs_to_plain_text, parse_post_html } from './postContent';

const User = types
  .model('User', {
    username: types.identifier,
    name: types.optional(types.string, ''),
    avatar: types.optional(types.string, ''),
    url: types.optional(types.string, ''),
    bio: types.optional(types.string, ''),
    is_following: types.maybeNull(types.boolean),
    is_you: types.maybeNull(types.boolean),
    following_count: types.maybeNull(types.number),
  })
  .actions(self => ({
    merge(snapshot = {}) {
      Object.entries(snapshot).forEach(([key, value]) => {
        if (key === 'username' || value == null || value === '') {
          return;
        }

        self[key] = value;
      });
    },

    set_is_following(is_following) {
      self.is_following = is_following;
    },
  }))
  .views(self => ({
    display_name() {
      if (self.name) {
        return self.name;
      } else {
        return self.username;
      }
    },

    site_host() {
      try {
        return new URL(self.url).host.replace(/^www\./, '');
      } catch (error) {
        return '';
      }
    },
  }));

export function normalize_user(payload = {}) {
  const microblog = payload?._microblog || {};

  return {
    username: `${payload?.username || microblog.username || ''}`.trim(),
    name: `${payload?.full_name || payload?.name || ''}`.trim(),
    avatar: `${payload?.avatar || payload?.gravatar_url || ''}`.trim(),
    url: `${payload?.url || ''}`.trim(),
    bio: html_to_text(payload?.bio || microblog.bio),
    is_following: normalize_flag(payload?.is_following ?? microblog.is_following),
    is_you: normalize_flag(payload?.is_you ?? microblog.is_you),
    following_count: normalize_count(payload?.following_count ?? microblog.following_count),
  };
}

export function normalize_profile(feed = {}) {
  const microblog = feed?._microblog || {};
  const author = feed?.author || {};

  return normalize_user({
    ...microblog,
    name: author.name,
    avatar: author.avatar,
    url: author.url,
  });
}

function html_to_text(html) {
  return paragraphs_to_plain_text(parse_post_html(`${html || ''}`).paragraphs).trim();
}

function normalize_flag(value) {
  if (value == null) {
    return null;
  }

  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalize_count(value) {
  const parsed_value = Number(value);

  if (Number.isFinite(parsed_value) && parsed_value >= 0) {
    return parsed_value;
  } else {
    return null;
  }
}

export default User;
