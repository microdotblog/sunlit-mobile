import { flow, types } from 'mobx-state-tree';

import { is_auth_error } from '../api/request';

export const SESSION_EXPIRED_MESSAGE = 'Your Micro.blog session expired. Please sign in again.';

export function create_auth_store({
  build_micro_blog_auth_url,
  create_oauth_state,
  exchange_micro_blog_code,
  extract_micro_blog_callback_params,
  get_initial_url,
  get_micro_blog_redirect_uri,
  is_micro_blog_callback_url,
  open_auth_session,
  tokens,
  verify_micro_blog_token,
} = {}) {
  return types
    .model('Auth', {
      is_hydrating: types.optional(types.boolean, false),
      is_signing_in: types.optional(types.boolean, false),
      loading_phase: types.optional(types.string, 'idle'),
      error_message: types.maybeNull(types.string),
      profile_username: types.maybeNull(types.string),
      profile_name: types.maybeNull(types.string),
      profile_photo: types.maybeNull(types.string),
      profile_url: types.maybeNull(types.string),
    })
    .actions(self => ({
      clear_error() {
        self.error_message = null;
      },

      set_error(message = null) {
        self.error_message = message;
      },

      set_loading_phase(phase = 'idle') {
        if (phase === 'connecting' || phase === 'verifying') {
          self.loading_phase = phase;
        } else {
          self.loading_phase = 'idle';
        }
      },

      clear_session_data() {
        self.profile_username = null;
        self.profile_name = null;
        self.profile_photo = null;
        self.profile_url = null;
      },

      apply_session_payloads(token_payload = null, verify_payload = null) {
        self.apply_profile(normalize_session(token_payload, verify_payload));
      },

      apply_profile(profile = null) {
        self.profile_username = profile?.profile_username || null;
        self.profile_name = profile?.profile_name || null;
        self.profile_photo = profile?.profile_photo || null;
        self.profile_url = profile?.profile_url || null;
      },

      remember_session: flow(function* (token_payload = null, verify_payload = null) {
        self.apply_session_payloads(token_payload, verify_payload);
        yield tokens.set_profile(self.current_profile());
      }),

      hydrate: flow(function* () {
        if (self.is_hydrating) {
          return;
        }

        self.is_hydrating = true;
        self.clear_error();

        try {
          yield tokens.hydrate();

          const initial_url = yield get_initial_url();
          if (self.can_handle_auth_callback(initial_url) && tokens.has_pending_oauth_state()) {
            yield self.complete_sign_in_callback(initial_url);
            return;
          }

          const stored_token = tokens.get_user_token();
          if (!stored_token) {
            self.clear_session_data();
            return;
          }

          self.apply_profile(tokens.get_profile());

          try {
            self.set_loading_phase('verifying');
            const verify_payload = yield verify_micro_blog_token(stored_token);
            yield self.store_verified_token(stored_token, verify_payload);
            yield self.remember_session(null, verify_payload);
          } catch (error) {
            if (is_auth_error(error)) {
              yield self.clear_invalid_session(SESSION_EXPIRED_MESSAGE);
            }
          }
        } finally {
          self.is_hydrating = false;
          self.set_loading_phase();
        }
      }),

      sign_in_with_micro_blog: flow(function* () {
        if (self.is_loading()) {
          return false;
        }

        self.clear_error();
        self.is_signing_in = true;
        self.set_loading_phase('connecting');

        try {
          yield tokens.hydrate();

          const oauth_state = yield create_oauth_state();
          if (!oauth_state) {
            self.set_error('We could not prepare Micro.blog sign in. Please try again.');
            return false;
          }

          yield tokens.set_pending_oauth_state(oauth_state);

          const redirect_uri = get_micro_blog_redirect_uri();
          const auth_url = build_micro_blog_auth_url({ state: oauth_state, redirect_uri });
          const auth_result = yield open_auth_session(auth_url, redirect_uri);

          if (auth_result?.type === 'success' && auth_result?.url) {
            return yield self.complete_sign_in_callback(auth_result.url);
          }

          yield tokens.clear_pending_oauth_state();

          if (auth_result?.type !== 'cancel' && auth_result?.type !== 'dismiss') {
            self.set_error('Micro.blog sign in did not complete. Please try again.');
          }

          return false;
        } catch (error) {
          yield tokens.clear_pending_oauth_state();
          self.set_error('We could not open Micro.blog sign in. Please try again.');
          return false;
        } finally {
          self.finish_sign_in();
        }
      }),

      sign_in_with_token: flow(function* (token = '') {
        if (self.is_loading()) {
          return false;
        }

        const trimmed_token = `${token || ''}`.trim();
        self.clear_error();

        if (!trimmed_token) {
          self.set_error('Enter a Micro.blog app token to sign in.');
          return false;
        }

        self.is_signing_in = true;
        self.set_loading_phase('verifying');

        try {
          yield tokens.hydrate();
          const verify_payload = yield verify_micro_blog_token(trimmed_token);
          yield self.store_verified_token(trimmed_token, verify_payload);
          yield self.remember_session(null, verify_payload);
          return true;
        } catch (error) {
          yield tokens.clear_user_token();
          self.clear_session_data();

          if (is_auth_error(error)) {
            self.set_error('That Micro.blog token is not valid. Please try again.');
          } else {
            self.set_error('We could not sign you in with that token. Please try again.');
          }

          return false;
        } finally {
          self.finish_sign_in();
        }
      }),

      complete_sign_in_callback: flow(function* (raw_url = '') {
        self.set_loading_phase('verifying');
        const { code, state } = extract_micro_blog_callback_params(raw_url);
        const expected_state = tokens.get_pending_oauth_state();

        yield tokens.clear_pending_oauth_state();

        if (!code) {
          self.set_error('Micro.blog did not return an authorization code. Please try again.');
          return false;
        }

        if (!state || !expected_state || state !== expected_state) {
          self.set_error('Micro.blog sign in could not be verified. Please try again.');
          return false;
        }

        try {
          const token_payload = yield exchange_micro_blog_code({ code });
          const access_token = `${token_payload?.access_token || ''}`.trim();

          if (!access_token) {
            throw new Error('Micro.blog did not return an access token.');
          }

          yield tokens.set_user_token(access_token);
          self.apply_session_payloads(token_payload, null);

          try {
            const verify_payload = yield verify_micro_blog_token(access_token);
            yield self.store_verified_token(access_token, verify_payload);
            yield self.remember_session(token_payload, verify_payload);
          } catch (error) {
            if (is_auth_error(error)) {
              yield self.clear_invalid_session(SESSION_EXPIRED_MESSAGE);
              return false;
            }
          }

          self.clear_error();
          return true;
        } catch (error) {
          yield tokens.clear_user_token();
          self.clear_session_data();
          self.set_error('We could not finish signing you in. Please try again.');
          return false;
        }
      }),

      store_verified_token: flow(function* (token, verify_payload) {
        const verified_token = `${verify_payload?.token || ''}`.trim() || token;

        if (verified_token !== tokens.get_user_token()) {
          yield tokens.set_user_token(verified_token);
        }
      }),

      clear_invalid_session: flow(function* (message = null) {
        yield tokens.clear_all();
        self.clear_session_data();
        self.set_error(message);
        self.set_loading_phase();
      }),

      sign_out: flow(function* () {
        yield tokens.clear_all();
        self.clear_session_data();
        self.clear_error();
        self.set_loading_phase();
      }),

      finish_sign_in() {
        self.is_signing_in = false;
        self.set_loading_phase();
      },
    }))
    .views(self => ({
      is_loading() {
        return self.is_hydrating || self.is_signing_in;
      },

      is_signed_in() {
        return tokens.has_user_token();
      },

      get_token() {
        return tokens.get_user_token();
      },

      current_profile() {
        return {
          profile_username: self.profile_username,
          profile_name: self.profile_name,
          profile_photo: self.profile_photo,
          profile_url: self.profile_url,
        };
      },

      can_handle_auth_callback(raw_url = '') {
        return is_micro_blog_callback_url(raw_url);
      },
    }))
    .create();
}

export function normalize_session(token_payload = null, verify_payload = null) {
  const profile = token_payload?.profile || {};

  return {
    profile_username: `${verify_payload?.username || ''}`.trim() || null,
    profile_name: `${verify_payload?.name || profile?.name || ''}`.trim() || null,
    profile_photo: `${verify_payload?.avatar || profile?.photo || ''}`.trim() || null,
    profile_url: `${verify_payload?.url || profile?.url || token_payload?.me || ''}`.trim() || null,
  };
}
