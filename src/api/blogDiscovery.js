import { Parser } from 'htmlparser2';

import { create_request_error, fetch_external } from './request';

const LINK_RELS = ['micropub', 'authorization_endpoint', 'token_endpoint', 'EditURI'];

export function normalize_blog_url(raw_url = '') {
  const trimmed = `${raw_url || ''}`.trim();

  if (!trimmed.includes('.')) {
    return null;
  }

  const with_scheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(with_scheme).toString();
  } catch (error) {
    return null;
  }
}

export async function discover_blog(raw_url) {
  const url = normalize_blog_url(raw_url);

  if (!url) {
    throw new Error('Enter your blog’s address, like example.com.');
  }

  const response = await fetch_external(url, { headers: { Accept: 'text/html' } });

  if (!response.ok) {
    throw create_request_error('Could not open that blog.', response.status);
  }

  const links = {
    ...parse_link_tags(await response.text(), response.url || url),
    ...parse_link_header(response.headers.get('Link'), response.url || url),
  };

  return {
    url,
    name: new URL(url).host.replace(/^www\./, ''),
    micropub: links.micropub || null,
    authorization_endpoint: links.authorization_endpoint || null,
    token_endpoint: links.token_endpoint || null,
    edit_uri: links.EditURI || null,
  };
}

export function parse_link_tags(html = '', base_url = '') {
  const links = {};

  const parser = new Parser({
    onopentag(name, attributes) {
      if (name !== 'link' || !attributes.href) {
        return;
      }

      `${attributes.rel || ''}`.split(/\s+/).forEach(rel => {
        if (LINK_RELS.includes(rel) && !links[rel]) {
          links[rel] = resolve(attributes.href, base_url);
        }
      });
    },
  });

  parser.write(html);
  parser.end();
  return links;
}

export function parse_link_header(header = '', base_url = '') {
  const links = {};

  `${header || ''}`.split(',').forEach(part => {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([^";]+)"?/);

    if (!match) {
      return;
    }

    match[2].split(/\s+/).forEach(rel => {
      if (LINK_RELS.includes(rel) && !links[rel]) {
        links[rel] = resolve(match[1], base_url);
      }
    });
  });

  return links;
}

export async function fetch_rsd(edit_uri) {
  const response = await fetch_external(edit_uri, { headers: { Accept: 'application/rsd+xml, text/xml' } });

  if (!response.ok) {
    throw create_request_error('Could not find the blog’s publishing endpoint.', response.status);
  }

  return parse_rsd(await response.text(), response.url || edit_uri);
}

export function parse_rsd(xml = '', base_url = '') {
  const apis = [];

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name.toLowerCase() === 'api') {
          apis.push({
            name: attributes.name,
            endpoint: attributes.apiLink || attributes.apilink,
            blog_id: attributes.blogID || attributes.blogid || '',
          });
        }
      },
    },
    { xmlMode: true },
  );

  parser.write(xml);
  parser.end();

  const preferred = apis.find(api => api.name === 'Blogger') || apis.find(api => api.name === 'WordPress') || apis[0];

  if (!preferred || !preferred.endpoint) {
    return null;
  }

  return { endpoint: resolve(preferred.endpoint, base_url), blog_id: preferred.blog_id };
}

function resolve(href, base_url) {
  try {
    return new URL(href, base_url || undefined).toString();
  } catch (error) {
    return href;
  }
}

export function is_secure_url(url = '') {
  return `${url || ''}`.toLowerCase().startsWith('https://');
}
