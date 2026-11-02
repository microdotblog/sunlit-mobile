import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { discover_blog, fetch_rsd } from '../api/blogDiscovery';
import {
  base64_to_base64url,
  build_external_auth_url,
  EXTERNAL_CALLBACK_URL,
  exchange_external_code,
  parse_external_callback,
} from '../api/externalAuth';
import { fetch_config } from '../api/Micropub';
import { get_users_blogs } from '../api/xmlrpc';
import { create_external_blogs_store } from './createExternalBlogsStore';

const BLOGS_KEY = 'ExternalBlogs';

export const external_blog_storage = {
  async load_blogs() {
    try {
      const data = await SecureStore.getItemAsync(BLOGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  },

  save_blogs(blogs) {
    return SecureStore.setItemAsync(BLOGS_KEY, JSON.stringify(blogs));
  },

  async load_secret(blog_id) {
    try {
      const data = await SecureStore.getItemAsync(secret_key(blog_id));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  save_secret(blog_id, secret) {
    return SecureStore.setItemAsync(secret_key(blog_id), JSON.stringify(secret));
  },

  delete_secret(blog_id) {
    return SecureStore.deleteItemAsync(secret_key(blog_id));
  },
};

const ExternalBlogs = create_external_blogs_store({
  storage: external_blog_storage,
  discover_blog,
  fetch_rsd,
  get_users_blogs,
  build_auth_url: build_external_auth_url,
  open_auth_session: (auth_url, callback_url) => WebBrowser.openAuthSessionAsync(auth_url, callback_url),
  parse_callback: parse_external_callback,
  exchange_code: exchange_external_code,
  fetch_config,
  create_pkce,
  callback_url: EXTERNAL_CALLBACK_URL,
  make_id: () => Crypto.randomUUID(),
});

async function create_pkce() {
  const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });

  return { verifier, challenge: base64_to_base64url(digest) };
}

function secret_key(blog_id) {
  return `ExternalBlogSecret-${blog_id}`;
}

export default ExternalBlogs;
