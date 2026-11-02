import { describe, expect, it } from 'bun:test';

import { build_method_call, parse_method_response, XmlRpcBase64 } from './xmlrpc';

describe('build_method_call', () => {
  it('encodes strings, booleans, structs and base64', () => {
    const xml = build_method_call('metaWeblog.newPost', [
      '1',
      'vincent',
      'p<ss',
      { title: 'Hi & bye', description: '<p>Hello</p>' },
      true,
      new XmlRpcBase64('AAEC'),
    ]);

    expect(xml).toContain('<methodName>metaWeblog.newPost</methodName>');
    expect(xml).toContain('<string>p&lt;ss</string>');
    expect(xml).toContain('<member><name>title</name><value><string>Hi &amp; bye</string></value></member>');
    expect(xml).toContain('<boolean>1</boolean>');
    expect(xml).toContain('<base64>AAEC</base64>');
  });
});

describe('parse_method_response', () => {
  it('reads an array of structs from blogger.getUsersBlogs', () => {
    const result = parse_method_response(`<?xml version="1.0"?>
      <methodResponse><params><param><value><array><data>
        <value><struct>
          <member><name>isAdmin</name><value><boolean>1</boolean></value></member>
          <member><name>url</name><value><string>https://example.com/</string></value></member>
          <member><name>blogid</name><value><string>1</string></value></member>
          <member><name>blogName</name><value>Example &amp; Co</value></member>
        </struct></value>
      </data></array></value></param></params></methodResponse>`);

    expect(result).toEqual([{ isAdmin: true, url: 'https://example.com/', blogid: '1', blogName: 'Example & Co' }]);
  });

  it('reads a plain string like a new post id', () => {
    expect(parse_method_response('<methodResponse><params><param><value><string>42</string></value></param></params></methodResponse>')).toBe('42');
  });

  it('throws the fault message', () => {
    expect(() =>
      parse_method_response(`<methodResponse><fault><value><struct>
        <member><name>faultCode</name><value><int>403</int></value></member>
        <member><name>faultString</name><value><string>Incorrect username or password.</string></value></member>
      </struct></value></fault></methodResponse>`),
    ).toThrow('Incorrect username or password. (error 403)');
  });
});
