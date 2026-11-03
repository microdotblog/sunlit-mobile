export function notification_post_id(notification) {
  const content_data = notification?.request?.content?.data || {};
  const remote_data = notification?.request?.trigger?.remoteMessage?.data || {};
  return `${content_data.post_id || remote_data.post_id || ''}`.trim();
}

export function notification_destination(notification) {
  const post_id = notification_post_id(notification);

  if (post_id) {
    return { name: 'Conversation', params: { id: post_id } };
  } else {
    return { name: 'Home', params: { screen: 'Mentions' } };
  }
}
