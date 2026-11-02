import { describe, expect, it, mock } from 'bun:test';

mock.module('expo-auth-session', () => ({ makeRedirectUri: () => 'sunlit://auth/callback' }));

const { build_micro_blog_auth_url, extract_micro_blog_callback_params, is_micro_blog_callback_url } = await import('./MicroBlogAuth');

describe('is_micro_blog_callback_url', () => {
  it('accepts the Sunlit callback', () => {
    expect(is_micro_blog_callback_url('sunlit://auth/callback?code=1&state=2')).toBe(true);
  });

  it('rejects other deep links and schemes', () => {
    expect(is_micro_blog_callback_url('sunlit://show?id=1')).toBe(false);
    expect(is_micro_blog_callback_url('inkwell://auth/callback?code=1')).toBe(false);
    expect(is_micro_blog_callback_url('')).toBe(false);
  });
});

describe('build_micro_blog_auth_url', () => {
  it('asks Micro.blog for read and write access as Sunlit', () => {
    const url = new URL(build_micro_blog_auth_url({ state: 'abc' }));

    expect(url.origin + url.pathname).toBe('https://micro.blog/indieauth/auth');
    expect(url.searchParams.get('client_id')).toBe('https://sunlit.io/');
    expect(url.searchParams.get('redirect_uri')).toBe('sunlit://auth/callback');
    expect(url.searchParams.get('scope')).toBe('read write');
    expect(url.searchParams.get('state')).toBe('abc');
  });
});

describe('extract_micro_blog_callback_params', () => {
  it('reads the code and state', () => {
    expect(extract_micro_blog_callback_params('sunlit://auth/callback?code=c1&state=s1')).toEqual({ code: 'c1', state: 's1' });
  });
});
