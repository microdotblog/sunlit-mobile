import { afterEach, describe, expect, it, mock } from 'bun:test';

import { request_json } from './request';

const original_fetch = globalThis.fetch;

function respond_with(status, body) {
  const fetch_mock = mock(async () => new Response(body, { status }));
  globalThis.fetch = fetch_mock;
  return fetch_mock;
}

afterEach(() => {
  globalThis.fetch = original_fetch;
});

describe('request_json', () => {
  it('sends the bearer token and drops empty query values', async () => {
    const fetch_mock = respond_with(200, '{"items":[]}');

    const payload = await request_json('/posts/media', {
      token: ' token-1 ',
      query: { count: 20, before_id: null, filter: 'photos,videos' },
    });

    const [url, options] = fetch_mock.mock.calls[0];
    expect(payload).toEqual({ items: [] });
    expect(url).toBe('https://micro.blog/posts/media?count=20&filter=photos%2Cvideos');
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('omits authorization when signed out', async () => {
    const fetch_mock = respond_with(200, '{}');

    await request_json('/posts/discover/photos');

    expect(fetch_mock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('form-encodes POST bodies', async () => {
    const fetch_mock = respond_with(200, '');

    const payload = await request_json('/posts/reply', { token: 't', method: 'POST', form: { id: '1', text: '@jean Hi & bye' } });

    const options = fetch_mock.mock.calls[0][1];
    expect(payload).toBe(null);
    expect(options.method).toBe('POST');
    expect(options.body).toBe('id=1&text=%40jean+Hi+%26+bye');
  });

  it('throws with the status so callers can spot an expired token', async () => {
    respond_with(401, 'Token required');

    await expect(request_json('/users/following/manton')).rejects.toMatchObject({
      status: 401,
      response_text: 'Token required',
    });
  });
});
