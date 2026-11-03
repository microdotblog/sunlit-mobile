import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { observer } from 'mobx-react';

import { LoadingFooter, LoadingState, MessageState } from '../components/ListStates';
import PostRow from '../components/PostRow';
import { use_post_list } from '../components/usePostList';
import { use_scroll_to_top_title } from '../navigation/headers';
import Posts from '../stores/Posts';
import Push from '../stores/Push';
import { use_theme } from '../theme/theme';

const MENTIONS_KEY = 'mentions';

function MentionsScreen({ navigation }) {
  const theme = use_theme();
  const list_ref = React.useRef(null);
  const list = use_post_list(MENTIONS_KEY);

  useScrollToTop(list_ref);
  use_scroll_to_top_title(navigation, 'Mentions', list_ref);

  React.useEffect(() => {
    Push.enable({ should_ask: true });
  }, []);

  if (!list || (list.is_loading && list.items.length === 0)) {
    return <LoadingState />;
  }

  const posts = list.posts();

  if (posts.length === 0 && list.error_message) {
    return (
      <MessageState
        action_title="Try again"
        message={list.error_message}
        on_action={() => Posts.refresh(MENTIONS_KEY)}
        title="Couldn't load mentions"
      />
    );
  }

  return (
    <FlatList
      ListEmptyComponent={<MessageState message="When people reply to you, their replies show up here." title="No mentions yet" />}
      ListFooterComponent={<LoadingFooter is_loading={list.is_loading_more} />}
      contentContainerStyle={posts.length === 0 ? { flexGrow: 1 } : null}
      data={posts}
      keyExtractor={item => item.id}
      onEndReached={() => Posts.load_more(MENTIONS_KEY)}
      onEndReachedThreshold={1}
      ref={list_ref}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={() => Posts.refresh(MENTIONS_KEY)}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={list.is_refreshing}
        />
      }
      renderItem={({ item }) => (
        <PostRow
          include_conversation_action={false}
          navigation={navigation}
          on_press={() => navigation.push('Conversation', { id: item.id })}
          post={item}
        />
      )}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

export default observer(MentionsScreen);
