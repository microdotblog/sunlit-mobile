export const WIDGET_NAME = 'SunlitPhotos';
export const DISCOVER_CATEGORIES = [
  { id: 'photos', title: 'Photos' },
  { id: 'cats', title: 'Cats' },
  { id: 'dogs', title: 'Dogs' },
  { id: 'art', title: 'Art' },
  { id: 'pens', title: 'Pens' },
  { id: 'books', title: 'Books' },
];
export const DEFAULT_WIDGET_CONFIG = { feed: 'timeline', category: 'photos' };
export const MAX_WIDGET_ITEMS = 4;

const FEATURE_MIN_WIDTH = 250;
const LIST_MIN_HEIGHT = 250;
const LIST_CHROME_HEIGHT = 56;
const LIST_ROW_HEIGHT = 58;

export function widget_layout(width, height) {
  if (height >= LIST_MIN_HEIGHT) {
    return 'list';
  } else if (width >= FEATURE_MIN_WIDTH) {
    return 'feature';
  } else {
    return 'single';
  }
}

export function list_row_count(height) {
  return Math.max(1, Math.min(MAX_WIDGET_ITEMS, Math.floor((height - LIST_CHROME_HEIGHT) / LIST_ROW_HEIGHT)));
}

export function widget_error_message(error) {
  if (error?.status === 401 || error?.status === 403) {
    return 'Open Sunlit and sign in again to see your photos.';
  } else {
    return 'Couldn’t load photos. Sunlit will try again soon.';
  }
}

export function normalize_widget_config(config) {
  const feed = config?.feed === 'discover' ? 'discover' : 'timeline';
  const category = DISCOVER_CATEGORIES.find(item => item.id === config?.category) ? config.category : 'photos';

  return { feed, category };
}

export function widget_title(config) {
  if (config.feed === 'discover') {
    const category = DISCOVER_CATEGORIES.find(item => item.id === config.category);
    return `Discover · ${category ? category.title : 'Photos'}`;
  } else {
    return 'Timeline';
  }
}

export function posts_to_widget_items(posts = []) {
  return posts
    .filter(post => post.media.some(media => media.url))
    .slice(0, MAX_WIDGET_ITEMS)
    .map(post => ({
      id: post.id,
      image_url: post.media.find(media => media.url).url,
      username: post.author.username,
      name: post.author.name || post.author.username,
      text: post.paragraphs.map(spans => spans.map(span => span.text).join('')).join(' ').trim(),
    }));
}

export function conversation_uri(item) {
  return `sunlit://show?id=${encodeURIComponent(item.id)}`;
}
