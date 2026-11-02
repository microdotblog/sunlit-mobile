import { describe, expect, it, mock } from 'bun:test';

mock.module('react-native', () => ({ Linking: { openURL: mock() }, Share: { share: mock() } }));
mock.module('expo-web-browser', () => ({ openBrowserAsync: mock() }));

const { resolve_profile_username } = await import('./links');

describe('resolve_profile_username', () => {
  it('opens Micro.blog profile links in the app', () => {
    expect(resolve_profile_username('https://micro.blog/manton')).toBe('manton');
  });

  it('leaves other links for the browser', () => {
    expect(resolve_profile_username('https://micro.blog/about/api')).toBe(null);
    expect(resolve_profile_username('https://avgeek.social/@rpmik')).toBe(null);
    expect(resolve_profile_username('#fn1')).toBe(null);
  });
});
