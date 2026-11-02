import { Platform, ToastAndroid } from 'react-native';
import { flow, types } from 'mobx-state-tree';

import Auth from './Auth';
import Destinations from './Destinations';
import ExternalBlogs from './ExternalBlogs';
import Places from './Places';
import ReplyDrafts from './ReplyDrafts';
import Session from './Session';

const TOAST_DURATION_MS = 1800;

const AppStore = types
  .model('App', {
    is_hydrating: types.optional(types.boolean, true),
    toast_key: types.optional(types.number, 0),
    toast_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    did_start: false,
    toast_timeout_id: null,
  }))
  .actions(self => ({
    start: flow(function* () {
      if (self.did_start) {
        return;
      }

      self.did_start = true;
      Session.start();
      self.is_hydrating = true;

      try {
        yield ReplyDrafts.hydrate();
        yield ExternalBlogs.hydrate();
        yield Destinations.hydrate();
        yield Places.hydrate();
        yield Auth.hydrate();

        if (!Auth.is_signed_in()) {
          ReplyDrafts.reset();
        }
      } finally {
        self.is_hydrating = false;
      }
    }),

    stop() {
      self.did_start = false;
      Session.stop();
      self.clear_toast();
    },

    show_toast(message = '') {
      const trimmed_message = `${message || ''}`.trim();

      if (!trimmed_message) {
        return;
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show(trimmed_message, ToastAndroid.SHORT);
        return;
      }

      self.clear_toast();
      self.toast_key += 1;
      self.toast_message = trimmed_message;
      self.toast_timeout_id = setTimeout(() => {
        self.clear_toast();
      }, TOAST_DURATION_MS);
    },

    clear_toast() {
      if (self.toast_timeout_id) {
        clearTimeout(self.toast_timeout_id);
        self.toast_timeout_id = null;
      }

      self.toast_message = null;
    },
  }))
  .create();

export default AppStore;
