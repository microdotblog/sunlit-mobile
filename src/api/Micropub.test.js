import { afterEach, describe, expect, it, mock } from 'bun:test';

import { create_post, delete_post, fetch_config, upload_media } from './Micropub';

const original_fetch = globalThis.fetch;

function respond_with(status, body, headers = {}) {
  const fetch_mock = mock(async () => new Response(body, { status, headers }));
  globalThis.fetch = fetch_mock;
  return fetch_mock;
}

afterEach(() => {
  globalThis.fetch = original_fetch;
});

describe('upload_media', () => {
  it('sends the destination before the file and reads the Location header', async () => {
    const fetch_mock = respond_with(202, '', { Location: 'https://vincent.blog/uploads/a.jpg' });

    const result = await upload_media({
      token: 't',
      media_endpoint: 'https://micro.blog/micropub/media',
      destination_uid: 'https://vincent.blog/',
      file: new Blob(['jpg'], { type: 'image/jpeg' }),
    });

    const [url, options] = fetch_mock.mock.calls[0];
    expect(url).toBe('https://micro.blog/micropub/media');
    expect([...options.body.keys()]).toEqual(['mp-destination', 'file']);
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(result).toEqual({ url: 'https://vincent.blog/uploads/a.jpg', poster: null });
  });

  it('reads the url and poster for videos', async () => {
    respond_with(202, '{"url":"https://vincent.blog/uploads/v.mov","poster":"https://vincent.blog/uploads/v.jpg"}');

    const result = await upload_media({ token: 't', file: new Blob(['mov']) });

    expect(result).toEqual({ url: 'https://vincent.blog/uploads/v.mov', poster: 'https://vincent.blog/uploads/v.jpg' });
  });
});

describe('create_post', () => {
  it('posts JSON for HTML posts and returns the new post URL', async () => {
    const fetch_mock = respond_with(202, '', { Location: 'https://vincent.blog/2026/11/02/post.html' });

    const location = await create_post({ token: 't', json: { type: ['h-entry'] } });

    const options = fetch_mock.mock.calls[0][1];
    expect(location).toBe('https://vincent.blog/2026/11/02/post.html');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe('{"type":["h-entry"]}');
  });

  it('accepts a created post whose body is not JSON, as the Micropub spec allows', async () => {
    respond_with(201, '<html>Created</html>', { Location: 'https://site.example/post' });

    const location = await create_post({ token: 't', endpoint: 'https://site.example/micropub', json: { type: ['h-entry'] } });

    expect(location).toBe('https://site.example/post');
  });
});

describe('fetch_config', () => {
  it('keeps the query string of an endpoint without pretty permalinks', async () => {
    const fetch_mock = respond_with(200, '{}');

    await fetch_config({ token: 't', endpoint: 'https://site.example/?rest_route=/micropub/1.0/endpoint' });

    expect(fetch_mock.mock.calls[0][0]).toBe('https://site.example/?rest_route=%2Fmicropub%2F1.0%2Fendpoint&q=config');
  });
});

describe('delete_post', () => {
  it('sends a form delete for the right blog', async () => {
    const fetch_mock = respond_with(200, '');

    await delete_post({ token: 't', url: 'https://vincent.blog/p.html', destination_uid: 'https://vincent.blog/' });

    expect(fetch_mock.mock.calls[0][1].body).toBe(
      'action=delete&url=https%3A%2F%2Fvincent.blog%2Fp.html&mp-destination=https%3A%2F%2Fvincent.blog%2F',
    );
  });
});
