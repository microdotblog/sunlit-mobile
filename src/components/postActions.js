import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { open_in_browser, share_url } from '../navigation/links';
import AppStore from '../stores/App';
import Destinations from '../stores/Destinations';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';

export function build_post_actions(post, { include_conversation = true } = {}) {
  const actions = [];

  if (include_conversation) {
    actions.push({ id: 'conversation', title: 'View conversation' });
  }

  if (Auth.is_signed_in()) {
    if (post.is_bookmark) {
      actions.push({ id: 'bookmark', title: 'Remove bookmark' });
    } else {
      actions.push({ id: 'bookmark', title: 'Bookmark' });
    }
  }

  actions.push({ id: 'share', title: 'Share' });
  actions.push({ id: 'copy_link', title: 'Copy link' });
  actions.push({ id: 'open_in_browser', title: 'Open in browser' });

  if (post.is_deletable) {
    actions.push({ destructive: true, id: 'delete', title: 'Delete' });
  }

  return actions;
}

export async function perform_post_action(navigation, post, action_id, { on_deleted } = {}) {
  if (action_id === 'conversation') {
    navigation.push('Conversation', { id: post.id });
  } else if (action_id === 'bookmark') {
    await toggle_bookmark(post);
  } else if (action_id === 'share') {
    share_url(post.url);
  } else if (action_id === 'copy_link') {
    await Clipboard.setStringAsync(post.url);
    AppStore.show_toast('Link copied');
  } else if (action_id === 'open_in_browser') {
    open_in_browser(post.url);
  } else if (action_id === 'delete') {
    confirm_delete(post, on_deleted);
  }
}

function confirm_delete(post, on_deleted) {
  const id = post.id;

  Alert.alert('Delete this post?', 'It will be removed from your blog.', [
    { style: 'cancel', text: 'Cancel' },
    {
      onPress: async () => {
        try {
          await Destinations.load();
          const destination = Destinations.selected();
          await Posts.delete_post(id, destination ? destination.uid : null);
          AppStore.show_toast('Post deleted');

          if (on_deleted) {
            on_deleted();
          }
        } catch (error) {
          AppStore.show_toast('Could not delete the post');
        }
      },
      style: 'destructive',
      text: 'Delete',
    },
  ]);
}

async function toggle_bookmark(post) {
  try {
    const is_bookmark = await Posts.toggle_bookmark(post.id);

    if (is_bookmark) {
      AppStore.show_toast('Bookmarked');
    } else {
      AppStore.show_toast('Bookmark removed');
    }
  } catch (error) {
    AppStore.show_toast('Could not update the bookmark');
  }
}
