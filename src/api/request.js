export const MICRO_BLOG_BASE_URL = 'https://micro.blog';

export async function request_json(path, options = {}) {
  const { data } = await send_request(path, options);
  return data;
}

export async function send_request(
  path,
  { token = '', method = 'GET', query = null, form = null, json = null, multipart = null } = {},
) {
  const url = build_url(path, query);
  const headers = { Accept: 'application/json' };
  const trimmed_token = `${token || ''}`.trim();
  let body;

  if (trimmed_token) {
    headers.Authorization = `Bearer ${trimmed_token}`;
  }

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = build_search_params(form).toString();
  } else if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (multipart) {
    body = multipart;
  }

  const response = await fetch(url, { method, headers, body });
  const response_text = await response.text();

  if (!response.ok) {
    throw create_request_error('Micro.blog request failed.', response.status, response_text);
  }

  return {
    data: parse_response_text(response_text, response.status),
    location: response.headers.get('Location'),
  };
}

export function create_request_error(message, status = null, response_text = '') {
  const error = new Error(message);
  error.status = status;
  error.response_text = response_text;
  return error;
}

export function is_auth_error(error) {
  return error?.status === 401 || error?.status === 403;
}

function parse_response_text(response_text, status) {
  if (!response_text.trim()) {
    return null;
  }

  try {
    return JSON.parse(response_text);
  } catch (error) {
    throw create_request_error('Micro.blog response could not be read.', status, response_text);
  }
}

function build_url(path, query) {
  const url = new URL(path, `${MICRO_BLOG_BASE_URL}/`);

  if (query) {
    url.search = build_search_params(query).toString();
  }

  return url.toString();
}

function build_search_params(values) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => params.append(key, `${item}`));
    } else {
      params.append(key, `${value}`);
    }
  });

  return params;
}
