import { is_auth_error } from '../api/request';
import { SESSION_EXPIRED_MESSAGE } from './createAuthStore';
import { build_html, build_html_post, build_micropub_form, uses_micropub_form } from './models/composition';

export function describe_publish_error(error, publisher, action = 'publish this post') {
  const blog_name = publisher && !publisher.is_microblog ? publisher.name : 'Micro.blog';

  if (is_auth_error(error) && blog_name === 'Micro.blog') {
    return SESSION_EXPIRED_MESSAGE;
  } else if (is_auth_error(error)) {
    return `${blog_name} no longer accepts Sunlit’s sign in. Remove the blog in the blog chooser and add it again.`;
  } else if (error?.status) {
    return `${blog_name} could not ${action} (${error.status}).`;
  } else {
    return error?.message || `Could not ${action}. Please try again.`;
  }
}

export function create_publishing({ micropub, xmlrpc, destinations, external_blogs, get_token, get_secret, read_base64 }) {
  async function for_target(target) {
    if (!target) {
      return null;
    }

    if (target.kind === 'microblog') {
      return micropub_publisher({
        key: target.key,
        is_microblog: true,
        name: target.name,
        token: get_token(),
        endpoint: undefined,
        media_endpoint: destinations.media_endpoint || undefined,
        destination_uid: target.uid,
      });
    }

    const blog = external_blogs.get_blog(target.blog_id);
    const secret = blog ? await get_secret(blog.id) : null;

    if (!blog || !secret) {
      throw new Error(`Sunlit is no longer connected to ${target.name}. Add it again in Settings.`);
    }

    if (blog.kind === 'micropub') {
      const media_endpoint = blog.media_endpoint || (await find_media_endpoint(secret.token, blog.micropub_endpoint));

      return micropub_publisher({
        key: target.key,
        is_microblog: false,
        name: blog.name,
        token: secret.token,
        endpoint: blog.micropub_endpoint,
        media_endpoint: media_endpoint || undefined,
        destination_uid: null,
      });
    }

    return xmlrpc_publisher({ key: target.key, blog, password: secret.password });
  }

  async function find_media_endpoint(token, endpoint) {
    try {
      const config = await micropub.fetch_config({ token, endpoint });
      return `${config?.['media-endpoint'] || ''}`.trim() || null;
    } catch (error) {
      return null;
    }
  }

  function micropub_publisher({ key, is_microblog, name, token, endpoint, media_endpoint, destination_uid }) {
    return {
      key,
      is_microblog,
      name,
      supports_video: true,
      supports_check_ins: true,
      destination_uid,

      upload(file) {
        if (!media_endpoint && endpoint) {
          throw new Error(`${name} does not accept photo uploads.`);
        }

        return micropub.upload_media({ token, media_endpoint, destination_uid, file });
      },

      publish({ sections, title, locations }) {
        if (uses_micropub_form(sections)) {
          return micropub.create_post({
            token,
            endpoint,
            form: build_micropub_form({ section: sections[0], destination_uid, locations }),
          });
        } else {
          return micropub.create_post({
            token,
            endpoint,
            json: build_html_post({ title, sections, destination_uid, locations }),
          });
        }
      },

      create_json(json) {
        return micropub.create_post({ token, endpoint, json });
      },

      fetch_source({ offset, limit }) {
        return micropub.fetch_source({ token, endpoint, destination_uid, offset, limit });
      },

      delete_post(url) {
        return micropub.delete_post({ token, endpoint, url, destination_uid });
      },
    };
  }

  function xmlrpc_publisher({ key, blog, password }) {
    const credentials = { endpoint: blog.xmlrpc_endpoint, blog_id: blog.blog_id, username: blog.username, password };

    return {
      key,
      is_microblog: false,
      name: blog.name,
      supports_video: false,
      supports_check_ins: false,
      destination_uid: null,

      async upload(file) {
        const bits = await read_base64(file.uri);
        const url = await xmlrpc.new_media_object({ ...credentials, name: file.name, type: file.type, bits });
        return { url, poster: null };
      },

      publish({ sections, title, locations }) {
        return xmlrpc.new_post({
          ...credentials,
          is_wordpress: blog.is_wordpress,
          title: title.trim(),
          html: build_html(sections, locations),
        });
      },
    };
  }

  return {
    async load() {
      await destinations.load();
    },

    is_ready() {
      const target = destinations.selected_target();

      if (!target) {
        return false;
      } else {
        return target.kind !== 'microblog' || destinations.did_load;
      }
    },

    for_posts() {
      return for_target(destinations.selected_target());
    },

    for_check_ins() {
      return for_target(destinations.selected_check_in_target());
    },

    check_in_key() {
      const target = destinations.selected_check_in_target();
      return target ? target.key : null;
    },
  };
}
