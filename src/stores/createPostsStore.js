import { applySnapshot, flow, isAlive, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';
import Post, { normalize_posts } from './models/Post';

const PostList = types
  .model('PostList', {
    key: types.identifier,
    items: types.array(types.safeReference(Post)),
    is_loading: types.optional(types.boolean, false),
    is_refreshing: types.optional(types.boolean, false),
    is_loading_more: types.optional(types.boolean, false),
    has_more: types.optional(types.boolean, true),
    did_load: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    request_token: 0,
  }))
  .actions(self => ({
    begin_request(is_refresh) {
      self.request_token += 1;
      self.error_message = null;

      if (is_refresh) {
        self.is_loading = self.items.length === 0;
        self.is_refreshing = self.items.length > 0;
      } else {
        self.is_loading_more = true;
      }

      return self.request_token;
    },

    finish_request() {
      self.is_loading = false;
      self.is_refreshing = false;
      self.is_loading_more = false;
    },

    replace_items(ids, has_more) {
      self.items.replace(ids);
      self.has_more = has_more;
      self.did_load = true;
    },

    append_items(ids, has_more) {
      const known_ids = new Set(self.items.filter(Boolean).map(post => post.id));
      const new_ids = ids.filter(id => !known_ids.has(id));
      self.items.push(...new_ids);
      self.has_more = has_more && new_ids.length > 0;
    },

    set_error(message) {
      self.error_message = message;
    },
  }))
  .views(self => ({
    posts() {
      return self.items.filter(Boolean);
    },

    last_id() {
      const posts = self.posts();

      if (posts.length > 0) {
        return posts[posts.length - 1].id;
      } else {
        return null;
      }
    },
  }));

export function create_posts_store({ api, get_token, on_auth_error = () => {} } = {}) {
  return types
    .model('Posts', {
      posts: types.map(Post),
      lists: types.map(PostList),
    })
    .volatile(() => ({
      pending_bookmark_ids: new Set(),
    }))
    .actions(self => ({
      ensure_list(key) {
        if (!self.lists.has(key)) {
          self.lists.put({ key });
        }

        return self.lists.get(key);
      },

      upsert_posts(snapshots = []) {
        return snapshots.map(snapshot => {
          self.posts.put(snapshot);
          return snapshot.id;
        });
      },

      upsert_post(snapshot) {
        self.posts.put(snapshot);
        return self.posts.get(snapshot.id);
      },

      load: flow(function* (key) {
        const list = self.ensure_list(key);

        if (list.did_load || list.is_loading) {
          return;
        }

        yield self.refresh(key);
      }),

      refresh: flow(function* (key) {
        const list = self.ensure_list(key);
        const source = resolve_list_source(api, key);
        const request_token = list.begin_request(true);

        try {
          const payload = yield source.fetch({ token: get_token() });

          if (!isAlive(list) || list.request_token !== request_token) {
            return;
          }

          const snapshots = order_snapshots(normalize_posts(payload?.items), source);
          list.replace_items(self.upsert_posts(snapshots), source.paginates && snapshots.length > 0);
        } catch (error) {
          if (isAlive(list) && list.request_token === request_token) {
            list.set_error(resolve_error_message(error));
          }

          yield handle_error(error);
        } finally {
          if (isAlive(list) && list.request_token === request_token) {
            list.finish_request();
          }
        }
      }),

      load_more: flow(function* (key) {
        const list = self.ensure_list(key);
        const source = resolve_list_source(api, key);
        const before_id = list.last_id();

        if (!source.paginates || !list.has_more || list.is_loading || list.is_refreshing || list.is_loading_more || !before_id) {
          return;
        }

        const request_token = list.begin_request(false);

        try {
          const payload = yield source.fetch({ token: get_token(), before_id });

          if (!isAlive(list) || list.request_token !== request_token) {
            return;
          }

          const snapshots = normalize_posts(payload?.items);
          list.append_items(self.upsert_posts(snapshots), snapshots.length > 0);
        } catch (error) {
          yield handle_error(error);
        } finally {
          if (isAlive(list) && list.request_token === request_token) {
            list.finish_request();
          }
        }
      }),

      toggle_bookmark: flow(function* (id) {
        const post = self.posts.get(id);

        if (!post) {
          throw new Error('That post is no longer loaded.');
        }

        if (self.pending_bookmark_ids.has(id)) {
          return post.is_bookmark;
        }

        self.pending_bookmark_ids.add(id);

        const next_is_bookmark = !post.is_bookmark;
        post.set_is_bookmark(next_is_bookmark);

        try {
          if (next_is_bookmark) {
            yield api.add_bookmark({ token: get_token(), id });
          } else {
            yield api.remove_bookmark({ token: get_token(), id });
          }

          return next_is_bookmark;
        } catch (error) {
          if (isAlive(post)) {
            post.set_is_bookmark(!next_is_bookmark);
          }

          yield handle_error(error);
          throw error;
        } finally {
          self.pending_bookmark_ids.delete(id);
        }
      }),

      send_reply: flow(function* (id, text) {
        const trimmed_text = `${text || ''}`.trim();

        if (!trimmed_text) {
          return false;
        }

        try {
          yield api.send_reply({ token: get_token(), id, text: trimmed_text });
        } catch (error) {
          yield handle_error(error);
          throw error;
        }

        yield self.refresh(conversation_key(id));
        return true;
      }),

      reset() {
        applySnapshot(self, {});
      },
    }))
    .views(self => ({
      get_post(id) {
        return self.posts.get(id) || null;
      },

      get_list(key) {
        return self.lists.get(key) || null;
      },
    }))
    .create();

  function handle_error(error) {
    if (is_auth_error(error)) {
      return Promise.resolve(on_auth_error(error));
    } else {
      return Promise.resolve();
    }
  }
}

export function photos_key(username) {
  return `photos:${username}`;
}

export function conversation_key(id) {
  return `conversation:${id}`;
}

function resolve_list_source(api, key) {
  if (key === 'timeline') {
    return { fetch: api.fetch_timeline, paginates: true };
  }

  if (key === 'discover') {
    return { fetch: api.fetch_discover, paginates: true };
  }

  if (key === 'mentions') {
    return { fetch: api.fetch_mentions, paginates: true };
  }

  if (key.startsWith('photos:')) {
    const username = key.slice('photos:'.length);
    return {
      fetch: params => api.fetch_user_photos({ ...params, username }),
      paginates: true,
    };
  }

  if (key.startsWith('conversation:')) {
    const id = key.slice('conversation:'.length);
    return {
      fetch: params => api.fetch_conversation({ ...params, id }),
      paginates: false,
      oldest_first: true,
    };
  }

  throw new Error(`Unknown post list: ${key}`);
}

function order_snapshots(snapshots, source) {
  if (source.oldest_first) {
    return [...snapshots].reverse();
  } else {
    return snapshots;
  }
}

function resolve_error_message(error) {
  if (is_auth_error(error)) {
    return 'Your Micro.blog session expired. Please sign in again.';
  } else {
    return 'Could not load posts. Pull to try again.';
  }
}
