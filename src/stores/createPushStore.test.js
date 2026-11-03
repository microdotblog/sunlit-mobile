import { describe, expect, it, mock } from 'bun:test';

import { create_push_store } from './createPushStore';

function build_store({ permission = 'granted', requested = 'granted', token = 'user-token', ...overrides } = {}) {
  const notifications = {
    prepare_channel: mock(async () => {}),
    get_permission: mock(async () => permission),
    request_permission: mock(async () => requested),
    get_device_token: mock(async () => 'fcm-token'),
    delete_device_token: mock(async () => {}),
    ...overrides.notifications,
  };
  const api = {
    register: mock(async () => ({})),
    unregister: mock(async () => ({})),
    ...overrides.api,
  };
  let current_token = token;
  const store = create_push_store({ notifications, api, get_token: () => current_token });

  return { api, notifications, sign_out: () => (current_token = null), store };
}

describe('create_push_store', () => {
  it('registers the FCM token when notifications are already allowed', async () => {
    const { api, notifications, store } = build_store();

    await store.enable();

    expect(notifications.prepare_channel).toHaveBeenCalled();
    expect(notifications.request_permission).not.toHaveBeenCalled();
    expect(api.register).toHaveBeenCalledWith({ token: 'user-token', device_token: 'fcm-token' });
    expect(store.registered_token).toBe('fcm-token');
  });

  it('only asks for permission when the Mentions tab asks it to', async () => {
    const { api, notifications, store } = build_store({ permission: 'undetermined' });

    await store.enable();
    expect(notifications.request_permission).not.toHaveBeenCalled();
    expect(api.register).not.toHaveBeenCalled();

    await store.enable({ should_ask: true });
    expect(notifications.request_permission).toHaveBeenCalledTimes(1);
    expect(api.register).toHaveBeenCalledTimes(1);
  });

  it('asks only once, like iOS, and not again after a refusal', async () => {
    const { notifications, store } = build_store({ permission: 'denied' });

    await store.enable({ should_ask: true });

    expect(notifications.request_permission).not.toHaveBeenCalled();
    expect(store.permission).toBe('denied');
  });

  it('ignores token changes until notifications are allowed', async () => {
    const { api, store } = build_store();

    await store.update_device_token('early-token');

    expect(api.register).not.toHaveBeenCalled();
  });

  it('registers once when Firebase reports the same token while it is being registered', async () => {
    let finish_register;
    const { api, store } = build_store({
      api: { register: mock(() => new Promise(resolve => (finish_register = resolve))) },
    });

    const enabling = store.enable();
    await new Promise(resolve => setTimeout(resolve, 0));
    await store.update_device_token('fcm-token');
    finish_register({});
    await enabling;

    expect(api.register).toHaveBeenCalledTimes(1);
    expect(store.registered_token).toBe('fcm-token');
  });

  it('unregisters a registration that was still in flight at sign out', async () => {
    let finish_register;
    const { api, sign_out, store } = build_store({
      api: { register: mock(() => new Promise(resolve => (finish_register = resolve))) },
    });

    const enabling = store.enable();
    await new Promise(resolve => setTimeout(resolve, 0));
    const unregistering = store.unregister();
    sign_out();
    finish_register({});
    await Promise.all([enabling, unregistering]);

    expect(api.unregister).toHaveBeenCalledWith({ token: 'user-token', device_token: 'fcm-token' });
    expect(store.registered_token).toBe(null);
  });

  it('deletes the Firebase token when the session expires', async () => {
    const { notifications, store } = build_store();
    await store.enable();

    await store.discard_device_token();

    expect(notifications.delete_device_token).toHaveBeenCalled();
    expect(store.registered_token).toBe(null);
  });

  it('does not register when permission is refused', async () => {
    const { api, notifications, store } = build_store({ permission: 'undetermined', requested: 'denied' });

    await store.enable({ should_ask: true });

    expect(store.permission).toBe('denied');
    expect(notifications.get_device_token).not.toHaveBeenCalled();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('registers each token once, and again when Firebase rotates it', async () => {
    const { api, store } = build_store();

    await store.enable();
    await store.enable();
    await store.update_device_token('rotated-token');

    expect(api.register).toHaveBeenCalledTimes(2);
    expect(api.register.mock.calls[1][0].device_token).toBe('rotated-token');
  });

  it('unregisters with the account token before sign out clears it', async () => {
    const { api, store } = build_store();
    await store.enable();

    await store.unregister();

    expect(api.unregister).toHaveBeenCalledWith({ token: 'user-token', device_token: 'fcm-token' });
    expect(store.registered_token).toBe(null);
  });

  it('drops a registration that finishes after sign out', async () => {
    let finish_token;
    const { api, sign_out, store } = build_store({
      notifications: { get_device_token: () => new Promise(resolve => (finish_token = resolve)) },
    });

    const enabling = store.enable();
    await Promise.resolve();
    await Promise.resolve();
    store.forget();
    sign_out();
    finish_token('fcm-token');
    await enabling;

    expect(api.register).not.toHaveBeenCalled();
    expect(store.registered_token).toBe(null);
  });

  it('keeps going when registration fails', async () => {
    const { store } = build_store({
      api: {
        register: mock(async () => {
          throw new Error('offline');
        }),
      },
    });
    const original_error = console.error;
    console.error = () => {};

    await store.enable();

    console.error = original_error;
    expect(store.registered_token).toBe(null);
  });
});
