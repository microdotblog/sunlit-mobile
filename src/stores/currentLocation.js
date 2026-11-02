import * as ExpoLocation from 'expo-location';

const LAST_KNOWN_MAX_AGE_MS = 60000;
const LOCATION_TIMEOUT_MS = 20000;
const MAX_ACCURACY_METERS = 500;

export const LOCATION_MESSAGES = {
  permission: 'Allow location access for Sunlit in Settings to find nearby places.',
  approximate: 'Sunlit needs your precise location to find places near you. Turn on Precise location for Sunlit in Settings, or search for a place.',
  services_off: 'Turn on location services to find nearby places.',
  unavailable: 'Unable to find your current location. Please try again.',
};

export function create_location_reader(Location, { timeout_ms = LOCATION_TIMEOUT_MS } = {}) {
  return async function get_current_location() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw location_error('permission');
    }

    if (permission.android?.accuracy === 'coarse') {
      throw location_error('approximate');
    }

    const last_known = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: MAX_ACCURACY_METERS,
    });

    if (last_known) {
      return to_coordinate(last_known);
    }

    let position;

    try {
      position = await with_timeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout_ms);
    } catch (error) {
      if (error?.code === 'unavailable') {
        throw error;
      }

      const services_enabled = await Location.hasServicesEnabledAsync().catch(() => true);
      throw location_error(services_enabled ? 'unavailable' : 'services_off');
    }

    if (position.coords.accuracy > MAX_ACCURACY_METERS) {
      throw location_error('approximate');
    }

    return to_coordinate(position);
  };
}

export const get_current_location = create_location_reader(ExpoLocation);

function location_error(code) {
  const error = new Error(LOCATION_MESSAGES[code]);
  error.code = code;
  return error;
}

function to_coordinate(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function with_timeout(promise, timeout_ms) {
  let timeout_id;
  const timeout = new Promise((_, reject) => {
    timeout_id = setTimeout(() => {
      reject(location_error('unavailable'));
    }, timeout_ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeout_id));
}
