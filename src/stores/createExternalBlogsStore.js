import { flow, types } from 'mobx-state-tree';

import { is_secure_url } from '../api/blogDiscovery';
import { is_same_site } from '../api/externalAuth';

const ExternalBlog = types.model('ExternalBlog', {
  id: types.identifier,
  name: types.string,
  url: types.string,
  kind: types.enumeration('ExternalBlogKind', ['micropub', 'xmlrpc']),
  micropub_endpoint: types.maybeNull(types.string),
  media_endpoint: types.maybeNull(types.string),
  xmlrpc_endpoint: types.maybeNull(types.string),
  blog_id: types.maybeNull(types.string),
  username: types.maybeNull(types.string),
  is_wordpress: types.optional(types.boolean, false),
});

export function create_external_blogs_store({
  storage,
  discover_blog,
  fetch_rsd,
  get_users_blogs,
  build_auth_url,
  open_auth_session,
  parse_callback,
  exchange_code,
  fetch_config,
  create_pkce,
  callback_url,
  make_id,
} = {}) {
  return types
    .model('ExternalBlogs', {
      blogs: types.array(ExternalBlog),
      is_working: types.optional(types.boolean, false),
      error_message: types.maybeNull(types.string),
    })
    .volatile(() => ({
      pending_discovery: null,
      generation: 0,
    }))
    .actions(self => ({
      hydrate: flow(function* () {
        const saved = yield storage.load_blogs();
        self.blogs.replace(Array.isArray(saved) ? saved : []);
      }),

      discover: flow(function* (raw_url) {
        const generation = self.begin_work();

        try {
          const discovery = yield discover_blog(raw_url);

          if (generation !== self.generation) {
            return null;
          }

          if (has_micropub(discovery)) {
            const blog_id = yield self.connect_micropub(discovery, generation);
            return blog_id ? { kind: 'micropub', blog_id } : null;
          }

          if (discovery.edit_uri) {
            self.pending_discovery = discovery;
            return { kind: 'xmlrpc', blog_id: null };
          }

          throw new Error('Could not find a way to publish to that blog. It needs Micropub or XML-RPC over https.');
        } catch (error) {
          self.fail(error, generation);
          return null;
        } finally {
          self.finish_work(generation);
        }
      }),

      connect_micropub: flow(function* (discovery, generation) {
        const state = make_id();
        const pkce = yield create_pkce();
        const auth_url = build_auth_url({
          authorization_endpoint: discovery.authorization_endpoint,
          me: discovery.url,
          state,
          code_challenge: pkce.challenge,
        });
        const result = yield open_auth_session(auth_url, callback_url);

        if (generation !== self.generation) {
          return null;
        }

        if (result?.type !== 'success' || !result.url) {
          throw new Error('The blog sign in was cancelled.');
        }

        const callback = parse_callback(result.url);

        if (!callback.code || callback.state !== state) {
          throw new Error('The blog sign in could not be verified. Please try again.');
        }

        const token_payload = yield exchange_code({
          token_endpoint: discovery.token_endpoint,
          code: callback.code,
          me: discovery.url,
          code_verifier: pkce.verifier,
        });
        const token = `${token_payload?.access_token || ''}`.trim();

        if (!token) {
          throw new Error('The blog did not return an access token.');
        }

        if (token_payload.me && !is_same_site(token_payload.me, discovery.url)) {
          throw new Error('The blog signed in as a different site. Please try again.');
        }

        if (generation !== self.generation) {
          return null;
        }

        const config = yield fetch_config({ token, endpoint: discovery.micropub }).catch(() => null);
        const blog = {
          id: make_id(),
          name: discovery.name,
          url: discovery.url,
          kind: 'micropub',
          micropub_endpoint: discovery.micropub,
          media_endpoint: `${config?.['media-endpoint'] || ''}`.trim() || null,
        };

        yield self.save_blog(blog, { token });
        return blog.id;
      }),

      connect_xmlrpc: flow(function* (username, password) {
        const discovery = self.pending_discovery;

        if (!discovery) {
          return null;
        }

        const generation = self.begin_work();

        try {
          const rsd = yield fetch_rsd(discovery.edit_uri);

          if (!rsd) {
            throw new Error('Could not find the blog’s publishing endpoint. Check the address and your connection.');
          }

          if (!is_secure_url(rsd.endpoint)) {
            throw new Error('This blog only offers XML-RPC without https, so Sunlit won’t send your password to it.');
          }

          yield get_users_blogs({ endpoint: rsd.endpoint, username, password });

          if (generation !== self.generation) {
            return null;
          }

          const blog = {
            id: make_id(),
            name: discovery.name,
            url: discovery.url,
            kind: 'xmlrpc',
            xmlrpc_endpoint: rsd.endpoint,
            blog_id: rsd.blog_id,
            username,
            is_wordpress: rsd.endpoint.includes('/xmlrpc.php'),
          };

          yield self.save_blog(blog, { password });
          self.pending_discovery = null;
          return blog.id;
        } catch (error) {
          self.fail(error, generation);
          return null;
        } finally {
          self.finish_work(generation);
        }
      }),

      save_blog: flow(function* (blog, secret) {
        yield storage.save_secret(blog.id, secret);
        self.blogs.push(blog);
        yield storage.save_blogs(self.blogs.toJSON());
      }),

      remove_blog: flow(function* (blog_id) {
        const blog = self.blogs.find(item => item.id === blog_id);

        if (!blog) {
          return;
        }

        self.blogs.remove(blog);
        yield storage.save_blogs(self.blogs.toJSON());
        yield storage.delete_secret(blog_id);
      }),

      reset: flow(function* () {
        const ids = self.blogs.map(blog => blog.id);
        self.generation += 1;
        self.is_working = false;
        self.blogs.clear();
        self.pending_discovery = null;
        self.error_message = null;
        yield storage.save_blogs([]);
        yield Promise.all(ids.map(id => storage.delete_secret(id)));
      }),

      cancel_discovery() {
        self.generation += 1;
        self.pending_discovery = null;
        self.is_working = false;
        self.error_message = null;
      },

      begin_work() {
        self.generation += 1;
        self.is_working = true;
        self.error_message = null;
        return self.generation;
      },

      finish_work(generation) {
        if (generation === self.generation) {
          self.is_working = false;
        }
      },

      fail(error, generation = self.generation) {
        if (generation === self.generation) {
          self.error_message = error?.message || 'Could not connect that blog.';
        }
      },
    }))
    .views(self => ({
      get_blog(blog_id) {
        return self.blogs.find(blog => blog.id === blog_id) || null;
      },

      needs_password() {
        return Boolean(self.pending_discovery);
      },

      pending_name() {
        return self.pending_discovery ? self.pending_discovery.name : '';
      },
    }))
    .create();
}

function has_micropub(discovery) {
  return [discovery.micropub, discovery.authorization_endpoint, discovery.token_endpoint].every(is_secure_url);
}
