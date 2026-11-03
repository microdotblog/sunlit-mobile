import { afterEach, describe, expect, it, mock } from 'bun:test';

import { register_push_device, unregister_push_device } from './MicroBlogPush';

const original_fetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = original_fetch;
});

describe('push registration', () => {
  it('registers as Sunlit for Android so the server sends it through Firebase', async () => {
    globalThis.fetch = mock(async () => new Response('{"status":"success"}', { status: 201 }));

    await register_push_device({ token: 't', device_token: 'fcm-token' });

    const [url, options] = globalThis.fetch.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(url.startsWith('https://micro.blog/users/push/register?')).toBe(true);
    expect(options.method).toBe('POST');
    expect(params.get('device_token')).toBe('fcm-token');
    expect(params.get('push_env')).toBe('production');
    expect(params.get('app_name')).toBe('Sunlit for Android');
  });

  it('unregisters the same app and device', async () => {
    globalThis.fetch = mock(async () => new Response('{"status":"success"}', { status: 200 }));

    await unregister_push_device({ token: 't', device_token: 'fcm-token' });

    const params = new URL(globalThis.fetch.mock.calls[0][0]).searchParams;
    expect(globalThis.fetch.mock.calls[0][0].startsWith('https://micro.blog/users/push/unregister?')).toBe(true);
    expect(params.get('app_name')).toBe('Sunlit for Android');
  });
});
