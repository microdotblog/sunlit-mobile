import { create_request_error, fetch_external } from './request';

export const EXTERNAL_CLIENT_ID = 'https://sunlit.io/';
export const EXTERNAL_REDIRECT_URI = 'https://sunlit.io/micropub/redirect';
export const EXTERNAL_CALLBACK_URL = 'sunlit://micropub';
export const EXTERNAL_SCOPE = 'create delete media';

export function build_external_auth_url({ authorization_endpoint, me, state, code_challenge }) {
  const url = new URL(authorization_endpoint);
  url.searchParams.set('me', me);
  url.searchParams.set('redirect_uri', EXTERNAL_REDIRECT_URI);
  url.searchParams.set('client_id', EXTERNAL_CLIENT_ID);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', EXTERNAL_SCOPE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', code_challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function parse_external_callback(raw_url = '') {
  try {
    const url = new URL(raw_url);

    return {
      code: url.searchParams.get('code') || '',
      state: url.searchParams.get('state') || '',
    };
  } catch (error) {
    return { code: '', state: '' };
  }
}

export function is_external_callback_url(raw_url = '') {
  return `${raw_url || ''}`.startsWith(EXTERNAL_CALLBACK_URL);
}

export async function exchange_external_code({ token_endpoint, code, me, code_verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: EXTERNAL_CLIENT_ID,
    redirect_uri: EXTERNAL_REDIRECT_URI,
    me,
    code_verifier,
  });

  const response = await fetch_external(token_endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await response.text();

  if (!response.ok) {
    throw create_request_error('The blog did not accept the sign in.', response.status, text);
  }

  return parse_token_response(text);
}

export function parse_token_response(text = '') {
  try {
    return JSON.parse(text);
  } catch (error) {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export function base64_to_base64url(base64 = '') {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function is_same_site(me, blog_url) {
  try {
    return new URL(me).host === new URL(blog_url).host;
  } catch (error) {
    return false;
  }
}
