import { describe, expect, it } from 'bun:test';

import { base64_to_base64url, build_external_auth_url, is_same_site } from './externalAuth';

describe('build_external_auth_url', () => {
  it('asks for a code with an S256 PKCE challenge', () => {
    const url = new URL(
      build_external_auth_url({ authorization_endpoint: 'https://auth.example/auth', me: 'https://me.example/', state: 's1', code_challenge: 'abc' }),
    );

    expect(url.searchParams.get('code_challenge')).toBe('abc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('https://sunlit.io/');
    expect(url.searchParams.get('state')).toBe('s1');
  });
});

describe('base64_to_base64url', () => {
  it('makes a digest safe for a URL without padding', () => {
    expect(base64_to_base64url('ab+c/d==')).toBe('ab-c_d');
  });
});

describe('is_same_site', () => {
  it('compares hosts', () => {
    expect(is_same_site('https://me.example/', 'https://me.example/blog/')).toBe(true);
    expect(is_same_site('https://other.example/', 'https://me.example/')).toBe(false);
  });
});
