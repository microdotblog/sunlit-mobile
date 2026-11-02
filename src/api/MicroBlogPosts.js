import { request_json } from './request';

export const TIMELINE_PAGE_SIZE = 20;
export const DISCOVER_PAGE_SIZE = 10;

export function fetch_timeline({ token, before_id = null }) {
  return request_json('/posts/media', {
    token,
    query: {
      count: TIMELINE_PAGE_SIZE,
      filter: 'photos,videos',
      before_id,
    },
  });
}

export function fetch_discover({ token, before_id = null }) {
  if (before_id) {
    return request_json('/posts/discover/photos', {
      token,
      query: { count: DISCOVER_PAGE_SIZE, before_id },
    });
  } else {
    return request_json('/posts/discover/photos', { token });
  }
}

export function fetch_mentions({ token, before_id = null }) {
  return request_json('/posts/mentions', {
    token,
    query: { before_id },
  });
}

export function fetch_conversation({ token, id }) {
  return request_json('/posts/conversation', {
    token,
    query: { id },
  });
}

export function fetch_user_posts({ token, username }) {
  return request_json(`/posts/${encodeURIComponent(username)}`, {
    token,
    query: { count: 0 },
  });
}

export function fetch_user_photos({ token, username, before_id = null }) {
  return request_json(`/posts/${encodeURIComponent(username)}/photos`, {
    token,
    query: { before_id },
  });
}

export function send_reply({ token, id, text }) {
  return request_json('/posts/reply', {
    token,
    method: 'POST',
    form: { id, text },
  });
}

export function add_bookmark({ token, id }) {
  return request_json('/posts/bookmarks', {
    token,
    method: 'POST',
    form: { id },
  });
}

export function remove_bookmark({ token, id }) {
  return request_json(`/posts/bookmarks/${encodeURIComponent(id)}`, {
    token,
    method: 'DELETE',
  });
}

export function follow_user({ token, username }) {
  return request_json('/users/follow', {
    token,
    method: 'POST',
    form: { username },
  });
}

export function unfollow_user({ token, username }) {
  return request_json('/users/unfollow', {
    token,
    method: 'POST',
    form: { username },
  });
}

export function fetch_following({ token, username }) {
  return request_json(`/users/following/${encodeURIComponent(username)}`, { token });
}

export function search_users({ token, query }) {
  return request_json('/users/search', {
    token,
    query: { q: query },
  });
}
