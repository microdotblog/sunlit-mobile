import { create_request_error, USER_AGENT } from './request';

export const PHOTON_URL = 'https://photon.komoot.io';
export const REQUEST_TIMEOUT_MS = 15000;
export const NEARBY_RADIUS_KM = 1;
export const SEARCH_RADIUS_METERS = 10000;

const PLACE_TAGS = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'office', 'craft', 'railway', 'aeroway'];
const EXCLUDED_TAGS = ['amenity:parking', 'amenity:parking_space', 'amenity:bicycle_parking', 'amenity:waste_basket', 'amenity:bench'];
const MAX_NEARBY_RESULTS = 50;
const MAX_SEARCH_RESULTS = 25;

export async function fetch_nearby_features({ latitude, longitude }) {
  const params = place_tag_params();
  params.set('lat', `${latitude}`);
  params.set('lon', `${longitude}`);
  params.set('radius', `${NEARBY_RADIUS_KM}`);
  params.set('limit', `${MAX_NEARBY_RESULTS}`);

  return fetch_features(`${PHOTON_URL}/reverse?${params.toString()}`, 'Nearby places could not be loaded.');
}

export async function search_place_features({ query, latitude, longitude }) {
  const params = place_tag_params();
  params.set('q', query);
  params.set('lat', `${latitude}`);
  params.set('lon', `${longitude}`);
  params.set('limit', `${MAX_SEARCH_RESULTS}`);
  params.set('bbox', build_bbox({ latitude, longitude }, SEARCH_RADIUS_METERS));

  return fetch_features(`${PHOTON_URL}/api/?${params.toString()}`, 'Places could not be searched.');
}

export function build_bbox({ latitude, longitude }, radius_meters) {
  const latitude_delta = radius_meters / 111320;
  const longitude_delta = radius_meters / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

  return [
    longitude - longitude_delta,
    latitude - latitude_delta,
    longitude + longitude_delta,
    latitude + latitude_delta,
  ].map(value => value.toFixed(5)).join(',');
}

function place_tag_params() {
  const params = new URLSearchParams();
  PLACE_TAGS.forEach(tag => params.append('osm_tag', tag));
  EXCLUDED_TAGS.forEach(tag => params.append('osm_tag', `!${tag}`));
  return params;
}

async function fetch_features(url, message) {
  const controller = new AbortController();
  const timeout_id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  let text;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    throw create_request_error(message);
  } finally {
    clearTimeout(timeout_id);
  }

  if (!response.ok) {
    throw create_request_error(message, response.status, text);
  }

  try {
    const payload = JSON.parse(text);
    return Array.isArray(payload?.features) ? payload.features : [];
  } catch (error) {
    throw create_request_error(message, response.status, text);
  }
}

export const TILE_SIZE = 256;

export function tiles_around({ latitude, longitude }, { zoom = 16, half_extent = 0.25 } = {}) {
  const scale = 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale;
  const latitude_radians = (latitude * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latitude_radians) + 1 / Math.cos(latitude_radians)) / Math.PI) / 2) * scale;
  const first_x = Math.floor(x - half_extent);
  const last_x = Math.floor(x + half_extent);
  const first_y = Math.floor(y - half_extent);
  const last_y = Math.floor(y + half_extent);
  const tiles = [];

  for (let tile_x = first_x; tile_x <= last_x; tile_x += 1) {
    for (let tile_y = first_y; tile_y <= last_y; tile_y += 1) {
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${wrap(tile_x, scale)}/${tile_y}.png`,
        left: (tile_x - x) * TILE_SIZE,
        top: (tile_y - y) * TILE_SIZE,
      });
    }
  }

  return tiles;
}

function wrap(value, size) {
  return ((value % size) + size) % size;
}
