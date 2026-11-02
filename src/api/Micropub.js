import { request_json, send_request } from './request';

export const MICROPUB_PATH = '/micropub';
export const MICROPUB_MEDIA_PATH = '/micropub/media';

export function fetch_config({ token, endpoint = MICROPUB_PATH }) {
  return request_json(endpoint, {
    token,
    query: { q: 'config' },
  });
}

export async function upload_media({ token, media_endpoint = MICROPUB_MEDIA_PATH, destination_uid = null, file }) {
  const multipart = new FormData();

  if (destination_uid) {
    multipart.append('mp-destination', destination_uid);
  }

  multipart.append('file', file);

  const { data, location } = await send_request(media_endpoint, {
    token,
    method: 'POST',
    multipart,
    is_json_optional: true,
  });

  return {
    url: `${data?.url || location || ''}`.trim(),
    poster: `${data?.poster || ''}`.trim() || null,
  };
}

export async function create_post({ token, endpoint = MICROPUB_PATH, form = null, json = null }) {
  const { location } = await send_request(endpoint, {
    token,
    method: 'POST',
    form,
    json,
    is_json_optional: true,
  });

  return location;
}

export function delete_post({ token, endpoint = MICROPUB_PATH, url, destination_uid = null }) {
  return send_request(endpoint, {
    token,
    method: 'POST',
    form: { action: 'delete', url, 'mp-destination': destination_uid },
    is_json_optional: true,
  });
}

export async function fetch_source({ token, endpoint = MICROPUB_PATH, destination_uid = null, offset = 0, limit = 100 }) {
  const payload = await request_json(endpoint, {
    token,
    query: { q: 'source', limit, offset, 'mp-destination': destination_uid },
  });

  if (Array.isArray(payload?.items)) {
    return payload.items;
  } else {
    return [];
  }
}

export async function fetch_uploads({ token, media_endpoint = MICROPUB_MEDIA_PATH, destination_uid = null }) {
  const payload = await request_json(media_endpoint, {
    token,
    query: { q: 'source', 'mp-destination': destination_uid },
  });

  if (Array.isArray(payload?.items)) {
    return payload.items;
  } else {
    return [];
  }
}
