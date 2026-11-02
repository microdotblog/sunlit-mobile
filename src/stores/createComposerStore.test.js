import { describe, expect, it, mock } from 'bun:test';

import { create_composer_store, MAX_PARALLEL_UPLOADS } from './createComposerStore';
import { create_publishing } from './publishers';

function photo(name, extra = {}) {
  return { kind: 'image', uri: `file:///${name}.jpg`, width: 1200, height: 800, mime: 'image/jpeg', ...extra };
}

function build_store(overrides = {}) {
  let next_id = 0;
  const micropub = {
    upload_media: mock(async ({ file }) => ({ url: `https://vincent.blog/uploads/${file.name}`, poster: null })),
    create_post: mock(async () => 'https://vincent.blog/2026/11/02/post.html'),
    ...overrides.micropub,
  };
  const destinations = {
    did_load: true,
    load: mock(async () => {}),
    media_endpoint: 'https://micro.blog/micropub/media',
    selected_target: () => ({ key: 'https://vincent.blog/', kind: 'microblog', uid: 'https://vincent.blog/', name: 'vincent.blog' }),
    selected_check_in_target: () => null,
    ...overrides.destinations,
  };
  const publishing = create_publishing({
    micropub,
    xmlrpc: overrides.xmlrpc || {},
    destinations,
    external_blogs: overrides.external_blogs || { get_blog: () => null },
    get_token: () => 'token-1',
    get_secret: overrides.get_secret || (async () => null),
    read_base64: async () => 'AAAA',
  });
  const prepare_media = mock(async media => ({ uri: media.uri, name: media.uri.split('/').pop(), type: 'image/jpeg' }));
  const on_auth_error = mock(() => {});
  const store = create_composer_store({
    publishing,
    prepare_media: overrides.prepare_media || prepare_media,
    make_id: () => `id-${(next_id += 1)}`,
    on_auth_error,
  });

  return { destinations, micropub, on_auth_error, prepare_media, store };
}

describe('create_composer_store', () => {
  it('posts a single section as a Micropub form with every photo uploaded', async () => {
    const { micropub, store } = build_store();
    store.start([photo('a'), photo('b')]);
    store.set_text(store.sections[0].id, 'Golden hour.');
    store.set_alt(store.sections[0].media[1].id, 'Sea');

    const location = await store.post();

    expect(location).toBe('https://vincent.blog/2026/11/02/post.html');
    expect(micropub.upload_media).toHaveBeenCalledTimes(2);
    expect(micropub.upload_media.mock.calls[0][0]).toMatchObject({
      token: 'token-1',
      media_endpoint: 'https://micro.blog/micropub/media',
      destination_uid: 'https://vincent.blog/',
    });
    expect(micropub.create_post.mock.calls[0][0].form).toMatchObject({
      content: 'Golden hour.',
      'photo[]': ['https://vincent.blog/uploads/a.jpg', 'https://vincent.blog/uploads/b.jpg'],
      'mp-photo-alt[]': ['', 'Sea'],
    });
    expect(store.sections).toHaveLength(0);
  });

  it('posts several sections as HTML with a title', async () => {
    const { micropub, store } = build_store();
    store.start([photo('a')]);
    store.add_media(null, [photo('b')]);
    store.set_title('Weekend');

    await store.post();

    const { json } = micropub.create_post.mock.calls[0][0];
    expect(store.needs_title()).toBe(false);
    expect(json.properties.name).toEqual(['Weekend']);
    expect(json.properties.content[0].html).toContain('class="sunlit_image"');
    expect(json['mp-destination']).toBe('https://vincent.blog/');
  });

  it('never runs more than four uploads at once', async () => {
    let active = 0;
    let peak = 0;
    const { store } = build_store({
      micropub: {
        upload_media: mock(async ({ file }) => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, 5));
          active -= 1;
          return { url: `https://vincent.blog/uploads/${file.name}` };
        }),
      },
    });
    store.start(Array.from({ length: 7 }, (_, index) => photo(`p${index}`)));

    await store.post();

    expect(peak).toBe(MAX_PARALLEL_UPLOADS);
  });

  it('keeps finished uploads and the composition when posting fails', async () => {
    const error = new Error('Server error');
    error.status = 500;
    const { micropub, store } = build_store({
      micropub: {
        create_post: mock(async () => {
          throw error;
        }),
      },
    });
    store.start([photo('a')]);

    const location = await store.post();
    await store.post();

    expect(location).toBe(null);
    expect(store.is_posting).toBe(false);
    expect(store.error_message).toBe('Micro.blog could not publish this post (500).');
    expect(micropub.upload_media).toHaveBeenCalledTimes(1);
    expect(store.sections[0].media[0].remote_url).toBe('https://vincent.blog/uploads/a.jpg');
  });

  it('uploads a cropped photo again', async () => {
    const { micropub, store } = build_store({
      micropub: {
        create_post: mock(async () => {
          throw new Error('offline');
        }),
      },
    });
    store.start([photo('a')]);
    await store.post();

    store.replace_media_file(store.sections[0].media[0].id, { uri: 'file:///a-cropped.jpg', width: 800, height: 800 });
    await store.post();

    expect(micropub.upload_media).toHaveBeenCalledTimes(2);
  });

  it('does not upload media picked from Micro.blog uploads', async () => {
    const { micropub, store } = build_store();
    store.start([{ kind: 'image', uri: 'https://vincent.blog/uploads/old.jpg', remote_url: 'https://vincent.blog/uploads/old.jpg' }]);

    await store.post();

    expect(micropub.upload_media).not.toHaveBeenCalled();
    expect(micropub.create_post.mock.calls[0][0].form['photo[]']).toEqual(['https://vincent.blog/uploads/old.jpg']);
  });

  it('drops a section once its last photo is removed', () => {
    const { store } = build_store();
    store.start([photo('a')]);
    store.add_media(null, [photo('b')]);

    store.remove_media(store.sections[1].media[0].id);

    expect(store.sections).toHaveLength(1);
    expect(store.needs_title()).toBe(false);
  });

  it('reorders photos within a section', () => {
    const { store } = build_store();
    store.start([photo('a'), photo('b'), photo('c')]);
    const [first, second, third] = store.sections[0].media.map(media => media.id);

    store.reorder_media(store.sections[0].id, [third, first, second]);

    expect(store.sections[0].media.map(media => media.uri)).toEqual(['file:///c.jpg', 'file:///a.jpg', 'file:///b.jpg']);
  });

  it('ignores a post that was cancelled while uploading', async () => {
    let resolve_upload;
    const { micropub, store } = build_store({
      micropub: {
        upload_media: mock(() => new Promise(resolve => {
          resolve_upload = resolve;
        })),
      },
    });
    store.start([photo('a')]);

    const posting = store.post();
    while (!resolve_upload) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    store.cancel_posting();
    resolve_upload({ url: 'https://vincent.blog/uploads/a.jpg' });
    await posting;

    expect(micropub.create_post).not.toHaveBeenCalled();
    expect(store.is_posting).toBe(false);
    expect(store.sections).toHaveLength(1);
  });

  it('stops starting uploads once one has failed', async () => {
    const error = new Error('Too large');
    error.status = 413;
    const { micropub, store } = build_store({
      micropub: {
        upload_media: mock(async ({ file }) => {
          if (file.name === 'p0.jpg') {
            throw error;
          }

          await new Promise(resolve => setTimeout(resolve, 10));
          return { url: `https://vincent.blog/uploads/${file.name}` };
        }),
      },
    });
    store.start(Array.from({ length: 8 }, (_, index) => photo(`p${index}`)));

    await store.post();
    await new Promise(resolve => setTimeout(resolve, 40));

    expect(micropub.upload_media.mock.calls.length).toBeLessThanOrEqual(4);
    expect(store.error_message).toBe('Micro.blog could not publish this post (413).');
    expect(store.all_media().filter(media => media.remote_url)).toHaveLength(0);
  });

  it('uploads the cropped photo instead of the one that was sending', async () => {
    let resolve_upload;
    const { micropub, store } = build_store({
      micropub: {
        upload_media: mock(() => new Promise(resolve => {
          resolve_upload = resolve;
        })),
      },
    });
    store.start([photo('a')]);
    const media_id = store.sections[0].media[0].id;

    const posting = store.post();
    while (!resolve_upload) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    store.replace_media_file(media_id, { uri: 'file:///a-cropped.jpg', width: 800, height: 800 });
    micropub.upload_media.mockImplementation(async ({ file }) => ({ url: `https://vincent.blog/uploads/${file.name}` }));
    resolve_upload({ url: 'https://vincent.blog/uploads/a.jpg' });
    await posting;

    expect(micropub.upload_media).toHaveBeenCalledTimes(2);
    expect(micropub.create_post.mock.calls[0][0].form['photo[]']).toEqual(['https://vincent.blog/uploads/a-cropped.jpg']);
  });

  it('refuses to post while the blogs could not be loaded', async () => {
    const { micropub, store } = build_store({
      destinations: { did_load: false, selected_target: () => null },
    });
    store.start([photo('a')]);

    const location = await store.post();

    expect(location).toBe(null);
    expect(micropub.upload_media).not.toHaveBeenCalled();
    expect(store.error_message).toBe('Could not load your blogs. Check your connection and try again.');
  });

  it('sends the title only when there are several sections', async () => {
    const { micropub, store } = build_store();
    store.start([photo('a')]);
    store.add_media(null, [photo('b')]);
    store.set_title('Left over');
    store.remove_media(store.sections[1].media[0].id);

    await store.post();

    expect(micropub.create_post.mock.calls[0][0].form.name).toBeUndefined();
  });

  it('posts to a WordPress blog over XML-RPC without the Micro.blog token', async () => {
    const xmlrpc = {
      new_media_object: mock(async ({ name }) => `https://wp.example/uploads/${name}`),
      new_post: mock(async () => '42'),
    };
    const { micropub, store } = build_store({
      xmlrpc,
      destinations: { selected_target: () => ({ key: 'external:wp', kind: 'xmlrpc', blog_id: 'wp', name: 'wp.example' }) },
      external_blogs: {
        get_blog: () => ({ id: 'wp', name: 'wp.example', kind: 'xmlrpc', xmlrpc_endpoint: 'https://wp.example/xmlrpc.php', blog_id: '1', username: 'vincent', is_wordpress: true }),
      },
      get_secret: async () => ({ password: 'secret' }),
    });
    store.start([photo('a')]);
    store.set_text(store.sections[0].id, 'Hello');

    const location = await store.post();

    expect(location).toBe('42');
    expect(micropub.upload_media).not.toHaveBeenCalled();
    expect(micropub.create_post).not.toHaveBeenCalled();
    expect(xmlrpc.new_media_object.mock.calls[0][0]).toMatchObject({ endpoint: 'https://wp.example/xmlrpc.php', username: 'vincent', password: 'secret', bits: 'AAAA' });
    expect(xmlrpc.new_post.mock.calls[0][0]).toMatchObject({ is_wordpress: true, title: '' });
    expect(xmlrpc.new_post.mock.calls[0][0].html).toContain('Hello\n\n<img src="https://wp.example/uploads/a.jpg"');
  });

  it('posts to an external Micropub blog with its own token and endpoints', async () => {
    const { micropub, store } = build_store({
      destinations: { selected_target: () => ({ key: 'external:mp', kind: 'micropub', blog_id: 'mp', name: 'me.example' }) },
      external_blogs: {
        get_blog: () => ({ id: 'mp', name: 'me.example', kind: 'micropub', micropub_endpoint: 'https://me.example/micropub', media_endpoint: 'https://me.example/media' }),
      },
      get_secret: async () => ({ token: 'external-token' }),
    });
    store.start([photo('a')]);

    await store.post();

    expect(micropub.upload_media.mock.calls[0][0]).toMatchObject({ token: 'external-token', media_endpoint: 'https://me.example/media', destination_uid: null });
    expect(micropub.create_post.mock.calls[0][0]).toMatchObject({ token: 'external-token', endpoint: 'https://me.example/micropub' });
    expect(micropub.create_post.mock.calls[0][0].form['mp-destination'] ?? null).toBe(null);
  });

  it('uploads again after switching to another blog', async () => {
    let target = { key: 'https://vincent.blog/', kind: 'microblog', uid: 'https://vincent.blog/', name: 'vincent.blog' };
    const { micropub, store } = build_store({
      micropub: {
        create_post: mock(async () => {
          throw new Error('offline');
        }),
      },
      destinations: { selected_target: () => target },
    });
    store.start([photo('a')]);
    await store.post();

    target = { key: 'https://photos.vincent.blog/', kind: 'microblog', uid: 'https://photos.vincent.blog/', name: 'photos' };
    await store.post();

    expect(micropub.upload_media).toHaveBeenCalledTimes(2);
    expect(micropub.upload_media.mock.calls[1][0].destination_uid).toBe('https://photos.vincent.blog/');
  });

  it('refuses videos for blogs that cannot receive them', async () => {
    const { store } = build_store({
      destinations: { selected_target: () => ({ key: 'external:wp', kind: 'xmlrpc', blog_id: 'wp', name: 'wp.example' }) },
      external_blogs: { get_blog: () => ({ id: 'wp', name: 'wp.example', kind: 'xmlrpc', xmlrpc_endpoint: 'x', blog_id: '1', username: 'v' }) },
      get_secret: async () => ({ password: 'p' }),
    });
    store.start([{ kind: 'video', uri: 'file:///v.mp4', width: 640, height: 360 }]);

    await store.post();

    expect(store.error_message).toBe('wp.example can’t receive videos from Sunlit. Remove the video or choose another blog.');
  });

  it('does not sign out of Micro.blog when another blog rejects its token', async () => {
    const error = new Error('Unauthorized');
    error.status = 401;
    const { on_auth_error, store } = build_store({
      micropub: {
        upload_media: mock(async () => {
          throw error;
        }),
      },
      destinations: { selected_target: () => ({ key: 'external:mp', kind: 'micropub', blog_id: 'mp', name: 'me.example' }) },
      external_blogs: { get_blog: () => ({ id: 'mp', name: 'me.example', kind: 'micropub', micropub_endpoint: 'https://me.example/micropub', media_endpoint: 'https://me.example/media' }) },
      get_secret: async () => ({ token: 'external-token' }),
    });
    store.start([photo('a')]);

    await store.post();

    expect(on_auth_error).not.toHaveBeenCalled();
    expect(store.error_message).toBe('me.example no longer accepts Sunlit’s sign in. Remove the blog in the blog chooser and add it again.');
  });

  it('looks up the media endpoint again when connecting could not find one', async () => {
    const { micropub, store } = build_store({
      micropub: {
        fetch_config: mock(async () => ({ 'media-endpoint': 'https://me.example/media' })),
      },
      destinations: { selected_target: () => ({ key: 'external:mp', kind: 'micropub', blog_id: 'mp', name: 'me.example' }) },
      external_blogs: { get_blog: () => ({ id: 'mp', name: 'me.example', kind: 'micropub', micropub_endpoint: 'https://me.example/micropub', media_endpoint: null }) },
      get_secret: async () => ({ token: 'external-token' }),
    });
    store.start([photo('a')]);

    await store.post();

    expect(micropub.upload_media.mock.calls[0][0].media_endpoint).toBe('https://me.example/media');
    expect(store.error_message).toBe(null);
  });

  it('shows uploading, not publishing, while the blog is still being prepared', async () => {
    let finish_loading;
    const { store } = build_store({
      destinations: { load: () => new Promise(resolve => (finish_loading = resolve)) },
    });
    store.start([photo('a')]);

    const posting = store.post();

    expect(store.is_posting).toBe(true);
    expect(store.is_publishing()).toBe(false);
    finish_loading();
    await posting;
  });

  it('tells the session when the token is rejected', async () => {
    const error = new Error('Unauthorized');
    error.status = 401;
    const { on_auth_error, store } = build_store({
      micropub: {
        upload_media: mock(async () => {
          throw error;
        }),
      },
    });
    store.start([photo('a')]);

    await store.post();

    expect(on_auth_error).toHaveBeenCalledTimes(1);
  });
});
