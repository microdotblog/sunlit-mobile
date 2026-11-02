import { afterEach, describe, expect, it, mock } from 'bun:test';

import { discover_blog, normalize_blog_url, parse_link_header, parse_link_tags, parse_rsd } from './blogDiscovery';

const original_fetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = original_fetch;
});

describe('normalize_blog_url', () => {
  it('adds https and rejects things that are not addresses', () => {
    expect(normalize_blog_url(' example.com ')).toBe('https://example.com/');
    expect(normalize_blog_url('http://example.com/blog')).toBe('http://example.com/blog');
    expect(normalize_blog_url('example')).toBe(null);
  });
});

describe('parse_link_tags', () => {
  it('finds Micropub, IndieAuth and RSD links', () => {
    const links = parse_link_tags(
      `<head>
        <link rel="micropub" href="/micropub">
        <link rel="authorization_endpoint" href="https://indieauth.com/auth">
        <link rel="token_endpoint me" href="https://tokens.example/token">
        <link rel="EditURI" type="application/rsd+xml" href="https://example.com/xmlrpc.php?rsd">
      </head>`,
      'https://example.com/',
    );

    expect(links).toEqual({
      micropub: 'https://example.com/micropub',
      authorization_endpoint: 'https://indieauth.com/auth',
      token_endpoint: 'https://tokens.example/token',
      EditURI: 'https://example.com/xmlrpc.php?rsd',
    });
  });
});

describe('parse_link_header', () => {
  it('reads endpoints from the HTTP Link header', () => {
    expect(parse_link_header('<https://example.com/micropub>; rel="micropub", </auth>; rel=authorization_endpoint', 'https://example.com/')).toEqual({
      micropub: 'https://example.com/micropub',
      authorization_endpoint: 'https://example.com/auth',
    });
  });
});

describe('parse_rsd', () => {
  it('prefers the Blogger API like iOS', () => {
    const rsd = parse_rsd(`<?xml version="1.0"?>
      <rsd version="1.0"><service><apis>
        <api name="WordPress" blogID="1" preferred="true" apiLink="https://example.com/xmlrpc.php" />
        <api name="Blogger" blogID="1" preferred="false" apiLink="https://example.com/xmlrpc.php" />
      </apis></service></rsd>`);

    expect(rsd).toEqual({ endpoint: 'https://example.com/xmlrpc.php', blog_id: '1' });
  });

  it('returns nothing without an API', () => {
    expect(parse_rsd('<rsd></rsd>')).toBe(null);
  });

  it('resolves a relative apiLink against the RSD address', () => {
    const rsd = parse_rsd('<rsd><api name="Blogger" blogID="1" apiLink="/xmlrpc.php" /></rsd>', 'https://example.com/xmlrpc.php?rsd');

    expect(rsd.endpoint).toBe('https://example.com/xmlrpc.php');
  });
});

describe('discover_blog', () => {
  it('identifies as Sunlit, since some hosts drop the default OkHttp agent', async () => {
    globalThis.fetch = mock(async () => new Response('<link rel="EditURI" href="/xmlrpc.php?rsd">', { status: 200 }));

    const discovery = await discover_blog('wordpress.org/news');

    expect(globalThis.fetch.mock.calls[0][1].headers['User-Agent']).toMatch(/^Sunlit\/\d+\.\d+\.\d+ \(Android/);
    expect(discovery.edit_uri).toBe('https://wordpress.org/xmlrpc.php?rsd');
  });

  it('explains a network failure instead of showing the raw error', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('fetch failed: okhttp3.internal.http2.StreamResetException: stream was reset: PROTOCOL_ERROR');
    });

    await expect(discover_blog('example.com')).rejects.toThrow('Could not reach that blog. Check the address and your connection.');
  });
});
