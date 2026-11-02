import { describe, expect, it, mock } from 'bun:test';

import { create_composer_store, MAX_PARALLEL_UPLOADS } from './createComposerStore';

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
    selected: () => ({ uid: 'https://vincent.blog/', name: 'vincent.blog' }),
    ...overrides.destinations,
  };
  const prepare_media = mock(async media => ({ uri: media.uri, name: media.uri.split('/').pop(), type: 'image/jpeg' }));
  const on_auth_error = mock(() => {});
  const store = create_composer_store({
    micropub,
    destinations,
    get_token: () => 'token-1',
    prepare_media: overrides.prepare_media || prepare_media,
    make_id: () => `id-${(next_id += 1)}`,
    on_auth_error,
  });

  return { micropub, on_auth_error, prepare_media, store };
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
      destinations: { did_load: false, selected: () => null },
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
