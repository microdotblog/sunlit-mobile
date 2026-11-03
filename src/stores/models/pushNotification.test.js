import { describe, expect, it } from 'bun:test';

import { notification_destination } from './pushNotification';

describe('notification_destination', () => {
  it('opens the conversation for a mention', () => {
    const notification = { request: { content: { data: { post_id: '12499041' } } } };

    expect(notification_destination(notification)).toEqual({ name: 'Conversation', params: { id: '12499041' } });
  });

  it('reads the post from the Firebase message when the content has no data', () => {
    const notification = { request: { content: { data: {} }, trigger: { remoteMessage: { data: { post_id: '42' } } } } };

    expect(notification_destination(notification)).toEqual({ name: 'Conversation', params: { id: '42' } });
  });

  it('falls back to Mentions, like iOS Sunlit', () => {
    expect(notification_destination({ request: { content: { data: {} } } })).toEqual({ name: 'Home', params: { screen: 'Mentions' } });
  });
});
