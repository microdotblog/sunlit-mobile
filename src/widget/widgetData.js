import * as SecureStore from 'expo-secure-store';

import { fetch_discover_collection, fetch_timeline } from '../api/MicroBlogPosts';
import { normalize_posts } from '../stores/models/Post';
import { build_widget_representation } from './SunlitWidget';
import { DEFAULT_WIDGET_CONFIG, normalize_widget_config, posts_to_widget_items, widget_error_message, widget_title } from './widgetModel';

const TOKENS_STORAGE_KEY = 'Tokens';

export async function build_widget(widget_info) {
  const config = await load_widget_config(widget_info.widgetId);
  const base = { width: widget_info.width, height: widget_info.height, title: widget_title(config) };

  const token = await load_token();

  if (config.feed === 'timeline' && !token) {
    return build_widget_representation({ ...base, items: [], message: 'Sign in to Sunlit to see your timeline.' });
  }

  try {
    const items = await load_widget_items(config, token);
    return build_widget_representation({ ...base, items, message: null });
  } catch (error) {
    return build_widget_representation({ ...base, items: [], message: widget_error_message(error) });
  }
}

export async function load_widget_config(widget_id) {
  try {
    const data = await SecureStore.getItemAsync(config_key(widget_id));
    return normalize_widget_config(data ? JSON.parse(data) : DEFAULT_WIDGET_CONFIG);
  } catch (error) {
    return normalize_widget_config(DEFAULT_WIDGET_CONFIG);
  }
}

export function save_widget_config(widget_id, config) {
  return SecureStore.setItemAsync(config_key(widget_id), JSON.stringify(normalize_widget_config(config)));
}

export function forget_widget_config(widget_id) {
  return SecureStore.deleteItemAsync(config_key(widget_id));
}

async function load_widget_items(config, token) {
  let payload;

  if (config.feed === 'timeline') {
    payload = await fetch_timeline({ token });
  } else {
    payload = await fetch_discover_collection({ token, collection: config.category });
  }

  return posts_to_widget_items(normalize_posts(payload?.items));
}

async function load_token() {
  try {
    const data = await SecureStore.getItemAsync(TOKENS_STORAGE_KEY);
    return data ? `${JSON.parse(data).user_token || ''}`.trim() : '';
  } catch (error) {
    return '';
  }
}

function config_key(widget_id) {
  return `Widget-${widget_id}`;
}
