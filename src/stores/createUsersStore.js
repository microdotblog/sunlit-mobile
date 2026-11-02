import { applySnapshot, flow, isAlive, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';
import User, { normalize_profile, normalize_user } from './models/User';

const UserList = types
  .model('UserList', {
    key: types.identifier,
    items: types.array(types.safeReference(User)),
    is_loading: types.optional(types.boolean, false),
    did_load: types.optional(types.boolean, false),
    error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    request_token: 0,
  }))
  .actions(self => ({
    begin_request() {
      self.request_token += 1;
      self.is_loading = true;
      self.error_message = null;
      return self.request_token;
    },

    finish_request(usernames, error_message = null) {
      if (usernames) {
        self.items.replace(usernames);
        self.did_load = true;
      }

      self.error_message = error_message;
      self.is_loading = false;
    },

    clear() {
      self.request_token += 1;
      self.items.clear();
      self.is_loading = false;
      self.did_load = false;
      self.error_message = null;
    },
  }))
  .views(self => ({
    users() {
      return self.items.filter(Boolean);
    },
  }));

const ProfileStatus = types.model('ProfileStatus', {
  username: types.identifier,
  is_loading: types.optional(types.boolean, false),
  error_message: types.maybeNull(types.string),
});

export function create_users_store({ api, get_token, on_auth_error = () => {} } = {}) {
  return types
    .model('Users', {
      users: types.map(User),
      lists: types.map(UserList),
      profile_statuses: types.map(ProfileStatus),
    })
    .actions(self => ({
      upsert_user(snapshot) {
        if (!snapshot?.username) {
          return null;
        }

        const existing_user = self.users.get(snapshot.username);

        if (existing_user) {
          existing_user.merge(snapshot);
        } else {
          self.users.put(snapshot);
        }

        return snapshot.username;
      },

      ensure_list(key) {
        if (!self.lists.has(key)) {
          self.lists.put({ key });
        }

        return self.lists.get(key);
      },

      ensure_profile_status(username) {
        if (!self.profile_statuses.has(username)) {
          self.profile_statuses.put({ username });
        }

        return self.profile_statuses.get(username);
      },

      load_profile: flow(function* (username) {
        const status = self.ensure_profile_status(username);

        if (status.is_loading) {
          return;
        }

        status.is_loading = true;
        status.error_message = null;

        try {
          const payload = yield api.fetch_user_posts({ token: get_token(), username });

          if (!isAlive(status)) {
            return;
          }

          self.upsert_user({ ...normalize_profile(payload), username });
        } catch (error) {
          if (isAlive(status)) {
            status.error_message = 'Could not load this profile.';
          }

          yield handle_error(error);
        } finally {
          if (isAlive(status)) {
            status.is_loading = false;
          }
        }
      }),

      toggle_follow: flow(function* (username) {
        const user = self.users.get(username);

        if (!user || user.is_following == null) {
          return null;
        }

        const next_is_following = !user.is_following;
        user.set_is_following(next_is_following);

        try {
          if (next_is_following) {
            yield api.follow_user({ token: get_token(), username });
          } else {
            yield api.unfollow_user({ token: get_token(), username });
          }

          return next_is_following;
        } catch (error) {
          if (isAlive(user)) {
            user.set_is_following(!next_is_following);
          }

          yield handle_error(error);
          throw error;
        }
      }),

      load_following: flow(function* (username) {
        yield self.load_list(following_key(username), () => {
          return api.fetch_following({ token: get_token(), username });
        });
      }),

      search: flow(function* (query) {
        const trimmed_query = `${query || ''}`.trim();
        const list = self.ensure_list(SEARCH_KEY);

        if (trimmed_query.length < 2) {
          list.clear();
          return;
        }

        yield self.load_list(SEARCH_KEY, () => {
          return api.search_users({ token: get_token(), query: trimmed_query });
        });
      }),

      load_list: flow(function* (key, fetch_users) {
        const list = self.ensure_list(key);
        const request_token = list.begin_request();

        try {
          const payload = yield fetch_users();

          if (!isAlive(list) || list.request_token !== request_token) {
            return;
          }

          const usernames = normalize_user_list(payload)
            .map(snapshot => self.upsert_user(snapshot))
            .filter(Boolean);
          list.finish_request(usernames);
        } catch (error) {
          if (isAlive(list) && list.request_token === request_token) {
            list.finish_request(null, 'Could not load people. Please try again.');
          }

          yield handle_error(error);
        }
      }),

      reset() {
        applySnapshot(self, {});
      },
    }))
    .views(self => ({
      get_user(username) {
        return self.users.get(username) || null;
      },

      get_list(key) {
        return self.lists.get(key) || null;
      },

      get_profile_status(username) {
        return self.profile_statuses.get(username) || null;
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

export const SEARCH_KEY = 'search';

export function following_key(username) {
  return `following:${username}`;
}

function normalize_user_list(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalize_user).filter(user => user.username);
}
