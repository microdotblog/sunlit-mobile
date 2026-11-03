import { send_request } from './request';

export const PUSH_APP_NAME = 'Sunlit for Android';
export const PUSH_ENV = 'production';

export function register_push_device({ token, device_token }) {
  return send_request('/users/push/register', {
    token,
    method: 'POST',
    query: { device_token, push_env: PUSH_ENV, app_name: PUSH_APP_NAME },
  });
}

export function unregister_push_device({ token, device_token }) {
  return send_request('/users/push/unregister', {
    token,
    method: 'POST',
    query: { device_token, push_env: PUSH_ENV, app_name: PUSH_APP_NAME },
  });
}
