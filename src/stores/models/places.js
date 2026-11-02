const EARTH_RADIUS_METERS = 6371000;
const SAME_VENUE_METERS = 50;

export const CHECK_IN_DELAYS = [
  { id: 'none', seconds: 0, title: 'No delay' },
  { id: 'one_hour', seconds: 3600, title: '1 hour' },
  { id: 'two_hours', seconds: 7200, title: '2 hours' },
  { id: 'one_day', seconds: 86400, title: '1 day' },
];

export function find_delay(delay_id) {
  return CHECK_IN_DELAYS.find(delay => delay.id === delay_id) || CHECK_IN_DELAYS[0];
}

export function published_date(delay_id, now = new Date()) {
  return new Date(now.getTime() + find_delay(delay_id).seconds * 1000);
}

export function normalize_photon_features(features = [], origin) {
  const places = features
    .map(feature => {
      const properties = feature?.properties || {};
      const [longitude, latitude] = feature?.geometry?.coordinates || [];

      return build_place({
        name: properties.name,
        address: join_parts([join_parts([properties.housenumber, properties.street], ' '), properties.city], ', '),
        latitude: Number(latitude),
        longitude: Number(longitude),
        origin,
      });
    })
    .filter(Boolean);

  return sort_and_dedupe(places);
}

export function filter_places(places, query = '') {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return places;
  }

  return places.filter(place => place.name.toLowerCase().includes(needle) || place.address.toLowerCase().includes(needle));
}

export function maps_url(name, latitude, longitude) {
  return `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${latitude},${longitude}`;
}

export function distance_meters(from, to) {
  const to_radians = degrees => (degrees * Math.PI) / 180;
  const latitude_delta = to_radians(to.latitude - from.latitude);
  const longitude_delta = to_radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitude_delta / 2) ** 2 +
    Math.cos(to_radians(from.latitude)) * Math.cos(to_radians(to.latitude)) * Math.sin(longitude_delta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function format_distance(meters) {
  if (meters < 1000) {
    return `${Math.max(Math.round(meters / 10) * 10, 10)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
}

export function build_check_in_post({ place, note = '', published, destination_uid = null }) {
  const venue = {
    name: [place.name],
    latitude: [place.latitude],
    longitude: [place.longitude],
  };

  if (place.url) {
    venue.url = [place.url];
  }

  const post = {
    type: ['h-entry'],
    properties: {
      published: [published.toISOString().replace(/\.\d{3}Z$/, 'Z')],
      content: [note.trim()],
      checkin: [{ type: ['h-card'], properties: venue }],
    },
  };

  if (destination_uid) {
    post['mp-destination'] = destination_uid;
  }

  return post;
}

export function sort_check_ins(check_ins) {
  return [...check_ins].sort((left, right) => right.published.localeCompare(left.published));
}

export function is_scheduled(check_in, now = new Date()) {
  return new Date(check_in.published).getTime() > now.getTime();
}

export function normalize_check_ins(items = []) {
  const check_ins = items
    .map(item => {
      const properties = item?.properties || {};
      const venue = find_venue(properties);
      const published = first(properties.published);
      const date = new Date(published || '');

      if (!venue || Number.isNaN(date.getTime())) {
        return null;
      }

      const post_url = first(properties.url) || null;
      const uid = first(properties.uid);
      const content = first(properties.content);

      return {
        id: `${post_url || uid || `${venue.latitude},${venue.longitude},${published}`}`,
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        place_url: venue.url,
        note: `${typeof content === 'string' ? content : content?.value || ''}`.trim(),
        published: date.toISOString(),
        post_url,
      };
    })
    .filter(Boolean);

  return sort_check_ins(check_ins);
}

function find_venue(properties) {
  const candidates = [...as_array(properties.checkin), ...as_array(properties.location)];

  for (const candidate of candidates) {
    const venue = candidate?.properties || candidate;
    const raw_name = first(venue?.name);
    const name = typeof raw_name === 'string' ? raw_name.trim() : '';
    const latitude = to_coordinate_number(first(venue?.latitude));
    const longitude = to_coordinate_number(first(venue?.longitude));

    if (name && is_coordinate(latitude, longitude)) {
      return { name, latitude, longitude, url: first(venue?.url) || null };
    }
  }

  return null;
}

function build_place({ name, address = '', latitude, longitude, origin }) {
  const trimmed_name = `${name || ''}`.trim();

  if (!trimmed_name || !is_coordinate(latitude, longitude)) {
    return null;
  }

  return {
    id: `${trimmed_name}-${latitude},${longitude}`,
    name: trimmed_name,
    address,
    latitude,
    longitude,
    distance: origin ? distance_meters(origin, { latitude, longitude }) : 0,
    url: maps_url(trimmed_name, latitude, longitude),
  };
}

function sort_and_dedupe(places) {
  const kept = [];

  places
    .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name))
    .forEach(place => {
      const is_duplicate = kept.some(other => {
        return other.name.toLowerCase() === place.name.toLowerCase() && distance_meters(other, place) < SAME_VENUE_METERS;
      });

      if (!is_duplicate) {
        kept.push(place);
      }
    });

  return kept;
}

function to_coordinate_number(value) {
  if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'string' && value.trim()) {
    return Number(value);
  } else {
    return NaN;
  }
}

function is_coordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function join_parts(parts, separator) {
  return parts.map(part => `${part || ''}`.trim()).filter(Boolean).join(separator);
}

function first(value) {
  if (Array.isArray(value)) {
    return value[0];
  } else {
    return value;
  }
}

function as_array(value) {
  if (Array.isArray(value)) {
    return value;
  } else if (value) {
    return [value];
  } else {
    return [];
  }
}
