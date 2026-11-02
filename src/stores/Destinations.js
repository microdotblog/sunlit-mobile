import * as SecureStore from 'expo-secure-store';

import * as Micropub from '../api/Micropub';
import Auth from './Auth';
import { create_destinations_store } from './createDestinationsStore';
import ExternalBlogs from './ExternalBlogs';
import { notify_session_expired } from './sessionEvents';

const PUBLISHING_PREFERENCES_KEY = 'PublishingPreferences';

const Destinations = create_destinations_store({
  api: Micropub,
  get_token: () => Auth.get_token(),
  external_blogs: ExternalBlogs,
  on_auth_error: notify_session_expired,
  storage: {
    async load() {
      try {
        const data = await SecureStore.getItemAsync(PUBLISHING_PREFERENCES_KEY);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        return null;
      }
    },

    save(preferences) {
      return SecureStore.setItemAsync(PUBLISHING_PREFERENCES_KEY, JSON.stringify(preferences));
    },
  },
});

export default Destinations;
