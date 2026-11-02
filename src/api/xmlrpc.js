import { Parser } from 'htmlparser2';

import { create_request_error, fetch_external } from './request';

export class XmlRpcBase64 {
  constructor(data) {
    this.data = data;
  }
}

export function build_method_call(method, params = []) {
  const encoded = params.map(param => `<param><value>${encode_value(param)}</value></param>`).join('');
  return `<?xml version="1.0"?><methodCall><methodName>${escape_xml(method)}</methodName><params>${encoded}</params></methodCall>`;
}

export async function call(endpoint, method, params) {
  const response = await fetch_external(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', Accept: 'text/xml' },
    body: build_method_call(method, params),
  });
  const text = await response.text();

  if (!response.ok) {
    throw create_request_error('The blog’s publishing endpoint returned an error.', response.status, text);
  }

  return parse_method_response(text);
}

export function parse_method_response(xml = '') {
  const stack = [];
  let result;
  let is_fault = false;
  let current_name = null;
  let text = '';

  function push_value(value) {
    const parent = stack[stack.length - 1];

    if (!parent) {
      result = value;
    } else if (parent.type === 'array') {
      parent.value.push(value);
    } else if (parent.type === 'struct') {
      parent.value[parent.pending_name] = value;
    }
  }

  const parser = new Parser(
    {
      onopentag(name) {
        text = '';

        if (name === 'fault') {
          is_fault = true;
        } else if (name === 'array') {
          stack.push({ type: 'array', value: [] });
        } else if (name === 'struct') {
          stack.push({ type: 'struct', value: {}, pending_name: null });
        }

        current_name = name;
      },

      ontext(value) {
        text += value;
      },

      onclosetag(name) {
        const parent = stack[stack.length - 1];

        if (name === 'name' && parent?.type === 'struct') {
          parent.pending_name = text.trim();
        } else if (name === 'string') {
          push_value(text);
        } else if (name === 'int' || name === 'i4' || name === 'i8') {
          push_value(parseInt(text, 10));
        } else if (name === 'double') {
          push_value(parseFloat(text));
        } else if (name === 'boolean') {
          push_value(text.trim() === '1');
        } else if (name === 'base64' || name === 'dateTime.iso8601') {
          push_value(text.trim());
        } else if (name === 'array' || name === 'struct') {
          const finished = stack.pop();
          push_value(finished.value);
        } else if (name === 'value' && current_name === 'value') {
          push_value(text);
        }

        current_name = null;
        text = '';
      },
    },
    { xmlMode: true, decodeEntities: true },
  );

  parser.write(xml);
  parser.end();

  if (is_fault) {
    const fault = result || {};
    const error = create_request_error(`${fault.faultString || 'The blog refused the request.'} (error ${fault.faultCode ?? '?'})`);
    error.fault_code = fault.faultCode;
    throw error;
  }

  return result;
}

function encode_value(value) {
  if (value instanceof XmlRpcBase64) {
    return `<base64>${value.data}</base64>`;
  } else if (typeof value === 'boolean') {
    return `<boolean>${value ? 1 : 0}</boolean>`;
  } else if (typeof value === 'number' && Number.isInteger(value)) {
    return `<int>${value}</int>`;
  } else if (typeof value === 'number') {
    return `<double>${value}</double>`;
  } else if (Array.isArray(value)) {
    return `<array><data>${value.map(item => `<value>${encode_value(item)}</value>`).join('')}</data></array>`;
  } else if (value && typeof value === 'object') {
    const members = Object.entries(value)
      .map(([name, item]) => `<member><name>${escape_xml(name)}</name><value>${encode_value(item)}</value></member>`)
      .join('');
    return `<struct>${members}</struct>`;
  } else {
    return `<string>${escape_xml(`${value ?? ''}`)}</string>`;
  }
}

function escape_xml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function get_users_blogs({ endpoint, username, password }) {
  return call(endpoint, 'blogger.getUsersBlogs', ['', username, password]);
}

export async function new_media_object({ endpoint, blog_id, username, password, name, type, bits }) {
  const result = await call(endpoint, 'metaWeblog.newMediaObject', [
    blog_id,
    username,
    password,
    { name, type, bits: new XmlRpcBase64(bits) },
  ]);
  const url = `${result?.url || result?.link || ''}`.trim();

  if (!url) {
    throw new Error('The blog did not return a URL for the uploaded photo.');
  }

  return url;
}

export async function new_post({ endpoint, blog_id, username, password, is_wordpress, title, html }) {
  if (is_wordpress) {
    const content = { post_status: 'publish', post_content: html };

    if (title) {
      content.post_title = title;
    }

    return call(endpoint, 'wp.newPost', [blog_id, username, password, content]);
  }

  const content = { description: html };

  if (title) {
    content.title = title;
  }

  return call(endpoint, 'metaWeblog.newPost', [blog_id, username, password, content, true]);
}
