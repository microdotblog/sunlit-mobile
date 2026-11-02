import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { observer } from 'mobx-react';

import { LoadingFooter, LoadingState, MessageState } from '../components/ListStates';
import TimelineCard from '../components/TimelineCard';
import { use_post_list } from '../components/usePostList';
import WelcomeView from '../components/WelcomeView';
import { use_scroll_to_top_title } from '../navigation/headers';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';
import { use_theme } from '../theme/theme';

const TIMELINE_KEY = 'timeline';

function TimelineScreen({ navigation }) {
  const theme = use_theme();
  const { width } = useWindowDimensions();
  const list_ref = React.useRef(null);
  const is_signed_in = Auth.is_signed_in();
  const list = use_post_list(TIMELINE_KEY, { enabled: is_signed_in });

  useScrollToTop(list_ref);
  use_scroll_to_top_title(navigation, 'Timeline', list_ref);

  if (!is_signed_in) {
    return <WelcomeView />;
  }

  if (!list || (list.is_loading && list.items.length === 0)) {
    return <LoadingState />;
  }

  const posts = list.posts();

  if (posts.length === 0 && list.error_message) {
    return (
      <MessageState
        action_title="Try again"
        message={list.error_message}
        on_action={() => Posts.refresh(TIMELINE_KEY)}
        title="Couldn't load your timeline"
      />
    );
  }

  function render_item({ item }) {
    return <TimelineCard navigation={navigation} post={item} width={width} />;
  }

  function render_footer() {
    if (list.has_more || posts.length === 0) {
      return <LoadingFooter is_loading={list.is_loading_more} />;
    }

    return (
      <View style={styles.caught_up}>
        <Text style={[styles.caught_up_title, { color: theme.colors.ink }]}>You're all caught up!</Text>
        <Text
          onPress={() => navigation.navigate('Discover')}
          style={[styles.caught_up_link, { color: theme.colors.accent }]}
        >
          Find more photos in Discover
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ListEmptyComponent={
        <MessageState
          action_title="Open Discover"
          message="Follow photographers from Discover and their photos will show up here."
          on_action={() => navigation.navigate('Discover')}
          title="No photos yet"
        />
      }
      ListFooterComponent={render_footer}
      contentContainerStyle={posts.length === 0 ? styles.empty : null}
      data={posts}
      keyExtractor={item => item.id}
      onEndReached={() => Posts.load_more(TIMELINE_KEY)}
      onEndReachedThreshold={1.5}
      ref={list_ref}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={() => Posts.refresh(TIMELINE_KEY)}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={list.is_refreshing}
        />
      }
      renderItem={render_item}
      style={{ backgroundColor: theme.colors.canvas }}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flexGrow: 1,
  },
  caught_up: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 40,
    paddingTop: 28,
  },
  caught_up_title: {
    fontSize: 17,
    fontWeight: '600',
  },
  caught_up_link: {
    fontSize: 15,
  },
});

export default observer(TimelineScreen);
