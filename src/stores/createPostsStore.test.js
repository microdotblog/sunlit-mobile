import { describe, expect, it, mock } from 'bun:test';

import { conversation_key, create_posts_store } from './createPostsStore';

function item(id, extra = {}) {
  return {
    id: `${id}`,
    content_html: `<p>Post ${id}</p><img src="https://example.com/${id}.jpg" width="100" height="100">`,
    author: { name: 'Jean', _microblog: { username: 'jean' } },
    _microblog: { is_bookmark: false },
    ...extra,
  };
}

function feed(...ids) {
  return { items: ids.map(id => item(id)) };
}

function build_store(api_overrides = {}) {
  const api = {
    fetch_timeline: mock(async () => feed(3, 2, 1)),
    fetch_discover: mock(async () => feed(9)),
    fetch_mentions: mock(async () => feed()),
    fetch_user_photos: mock(async () => feed()),
    fetch_conversation: mock(async () => feed(12, 11, 10)),
    add_bookmark: mock(async () => null),
    remove_bookmark: mock(async () => null),
    send_reply: mock(async () => null),
    ...api_overrides,
  };
  const on_auth_error = mock(() => {});
  const store = create_posts_store({ api, get_token: () => 'token-1', on_auth_error });

  return { api, on_auth_error, store };
}

function ids(list) {
  return list.posts().map(post => post.id);
}

function auth_error() {
  const error = new Error('Unauthorized');
  error.status = 401;
  return error;
}

describe('create_posts_store', () => {
  it('loads the timeline once and keeps it until refreshed', async () => {
    const { api, store } = build_store();

    await store.load('timeline');
    await store.load('timeline');

    expect(api.fetch_timeline).toHaveBeenCalledTimes(1);
    expect(api.fetch_timeline).toHaveBeenCalledWith({ token: 'token-1' });
    expect(ids(store.get_list('timeline'))).toEqual(['3', '2', '1']);
  });

  it('pages with before_id and stops when a page comes back empty', async () => {
    const { api, store } = build_store();
    await store.refresh('timeline');

    api.fetch_timeline.mockImplementation(async () => feed(0));
    await store.load_more('timeline');
    expect(api.fetch_timeline).toHaveBeenLastCalledWith({ token: 'token-1', before_id: '1' });

    api.fetch_timeline.mockImplementation(async () => feed());
    await store.load_more('timeline');

    const list = store.get_list('timeline');
    expect(ids(list)).toEqual(['3', '2', '1', '0']);
    expect(list.has_more).toBe(false);
  });

  it('ignores a response that arrives after a newer refresh', async () => {
    let resolve_first;
    const { api, store } = build_store();
    api.fetch_timeline.mockImplementationOnce(() => new Promise(resolve => {
      resolve_first = resolve;
    }));

    const first = store.refresh('timeline');
    await store.refresh('timeline');
    resolve_first(feed(99));
    await first;

    expect(ids(store.get_list('timeline'))).toEqual(['3', '2', '1']);
  });

  it('does not page while a pull to refresh is running', async () => {
    let resolve_refresh;
    const { api, store } = build_store();
    await store.refresh('timeline');
    api.fetch_timeline.mockImplementationOnce(() => new Promise(resolve => {
      resolve_refresh = resolve;
    }));

    const refresh = store.refresh('timeline');
    await store.load_more('timeline');
    resolve_refresh(feed(4, 3, 2, 1));
    await refresh;

    expect(api.fetch_timeline).toHaveBeenCalledTimes(2);
    expect(ids(store.get_list('timeline'))).toEqual(['4', '3', '2', '1']);
    expect(store.get_list('timeline').is_refreshing).toBe(false);
  });

  it('ignores a second bookmark tap while the first is still sending', async () => {
    let resolve_request;
    const { api, store } = build_store({
      add_bookmark: mock(() => new Promise(resolve => {
        resolve_request = resolve;
      })),
    });
    await store.refresh('timeline');

    const first = store.toggle_bookmark('3');
    await store.toggle_bookmark('3');
    resolve_request(null);
    await first;

    expect(api.add_bookmark).toHaveBeenCalledTimes(1);
    expect(api.remove_bookmark).not.toHaveBeenCalled();
    expect(store.get_post('3').is_bookmark).toBe(true);
  });

  it('shows conversations oldest first and does not paginate them', async () => {
    const { api, store } = build_store();
    const key = conversation_key('10');

    await store.refresh(key);
    await store.load_more(key);

    expect(api.fetch_conversation).toHaveBeenCalledTimes(1);
    expect(api.fetch_conversation).toHaveBeenCalledWith({ token: 'token-1', id: '10' });
    expect(ids(store.get_list(key))).toEqual(['10', '11', '12']);
  });

  it('shares one post between lists so a bookmark shows everywhere', async () => {
    const { api, store } = build_store({ fetch_discover: mock(async () => feed(2)) });
    await store.refresh('timeline');
    await store.refresh('discover');

    const is_bookmark = await store.toggle_bookmark('2');

    expect(is_bookmark).toBe(true);
    expect(api.add_bookmark).toHaveBeenCalledWith({ token: 'token-1', id: '2' });
    expect(store.get_list('discover').posts()[0].is_bookmark).toBe(true);
    expect(store.get_list('timeline').posts()[1].is_bookmark).toBe(true);
  });

  it('rolls a bookmark back when the request fails', async () => {
    const { store } = build_store({
      add_bookmark: mock(async () => {
        throw new Error('offline');
      }),
    });
    await store.refresh('timeline');

    await expect(store.toggle_bookmark('3')).rejects.toThrow('offline');

    expect(store.get_post('3').is_bookmark).toBe(false);
  });

  it('reports an error and tells the session when the token is rejected', async () => {
    const { on_auth_error, store } = build_store({
      fetch_mentions: mock(async () => {
        throw auth_error();
      }),
    });

    await store.refresh('mentions');

    expect(on_auth_error).toHaveBeenCalledTimes(1);
    expect(store.get_list('mentions').error_message).toBe('Your Micro.blog session expired. Please sign in again.');
    expect(store.get_list('mentions').is_loading).toBe(false);
  });

  it('survives the store being reset while a request is in flight', async () => {
    let resolve_request;
    const { api, store } = build_store();
    api.fetch_timeline.mockImplementationOnce(() => new Promise(resolve => {
      resolve_request = resolve;
    }));

    const request = store.refresh('timeline');
    store.reset();
    resolve_request(feed(1));
    await request;

    expect(store.get_list('timeline')).toBe(null);
  });

  it('keeps media readable after the same post is fetched again', async () => {
    const { store } = build_store();
    await store.refresh('timeline');
    const media = store.get_post('3').media;

    await store.refresh(conversation_key('3'));
    await store.refresh('timeline');

    expect(media[0].url).toBe('https://example.com/3.jpg');
    expect(store.get_post('3').media[0].url).toBe('https://example.com/3.jpg');
  });

  it('sends a reply and reloads the conversation', async () => {
    const { api, store } = build_store();

    const did_send = await store.send_reply('10', '  Lovely!  ');

    expect(did_send).toBe(true);
    expect(api.send_reply).toHaveBeenCalledWith({ token: 'token-1', id: '10', text: 'Lovely!' });
    expect(api.fetch_conversation).toHaveBeenCalledTimes(1);
  });
});
