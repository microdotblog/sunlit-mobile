import { Linking, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const MICRO_BLOG_HOSTS = new Set(['micro.blog', 'www.micro.blog']);

export function resolve_profile_username(href = '') {
  try {
    const url = new URL(href);
    const segments = url.pathname.split('/').filter(Boolean);

    if (MICRO_BLOG_HOSTS.has(url.host) && segments.length === 1 && /^[A-Za-z0-9_]+$/.test(segments[0])) {
      return segments[0];
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

export function open_link(navigation, href) {
  const username = resolve_profile_username(href);

  if (username) {
    navigation.push('Profile', { username });
  } else {
    open_in_browser(href);
  }
}

export async function open_in_browser(href) {
  try {
    if (/^https?:\/\//i.test(`${href || ''}`)) {
      await WebBrowser.openBrowserAsync(href);
    } else if (href && !href.startsWith('#')) {
      await Linking.openURL(href);
    }
  } catch (error) {
    console.error('Could not open link.', error);
  }
}

export function share_url(url) {
  if (url) {
    Share.share({ message: url, url });
  }
}
