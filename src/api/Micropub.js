import { request_json, send_request } from './request';

export const MICROPUB_PATH = '/micropub';
export const MICROPUB_MEDIA_PATH = '/micropub/media';

export function fetch_config({ token }) {
  return request_json(MICROPUB_PATH, {
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
  });

  return {
    url: `${data?.url || location || ''}`.trim(),
    poster: `${data?.poster || ''}`.trim() || null,
  };
}

export async function create_post({ token, form = null, json = null }) {
  const { location } = await send_request(MICROPUB_PATH, {
    token,
    method: 'POST',
    form,
    json,
  });

  return location;
}

export function delete_post({ token, url, destination_uid = null }) {
  return send_request(MICROPUB_PATH, {
    token,
    method: 'POST',
    form: { action: 'delete', url, 'mp-destination': destination_uid },
  });
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
