import * as SecureStore from 'expo-secure-store';

import { create_places_store } from './createPlacesStore';
import Publishing from './Publishing';
import { notify_session_expired } from './sessionEvents';

const CHECK_IN_PREFERENCES_KEY = 'CheckInPreferences';

const Places = create_places_store({
  publishing: Publishing,
  on_auth_error: notify_session_expired,
  storage: {
    async load() {
      try {
        const data = await SecureStore.getItemAsync(CHECK_IN_PREFERENCES_KEY);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        return null;
      }
    },

    save(preferences) {
      return SecureStore.setItemAsync(CHECK_IN_PREFERENCES_KEY, JSON.stringify(preferences));
    },
  },
});

export default Places;
