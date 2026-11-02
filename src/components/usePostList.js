import React from 'react';

import Posts from '../stores/Posts';

export function use_post_list(key, { enabled = true, refresh_on_mount = false } = {}) {
  const list = Posts.get_list(key);
  const requested_key = React.useRef(null);

  React.useEffect(() => {
    if (!enabled || (list && requested_key.current === key)) {
      return;
    }

    requested_key.current = key;

    if (refresh_on_mount) {
      Posts.refresh(key);
    } else {
      Posts.load(key);
    }
  }, [key, enabled, list, refresh_on_mount]);

  return list;
}
