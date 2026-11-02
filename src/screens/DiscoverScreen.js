import React from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { observer } from 'mobx-react';

import { LoadingFooter, LoadingState, MessageState } from '../components/ListStates';
import { grid_layout } from '../components/PhotoGrid';
import PhotoTile from '../components/PhotoTile';
import TimelineCard from '../components/TimelineCard';
import { use_post_list } from '../components/usePostList';
import UserRow from '../components/UserRow';
import { AccountButton, HeaderIconButton, use_scroll_to_top_title } from '../navigation/headers';
import Icon from '../platform/Icon';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';
import Users from '../stores/Users';
import { SEARCH_KEY } from '../stores/createUsersStore';
import { GRID_GAP, use_theme } from '../theme/theme';

const DISCOVER_KEY = 'discover';
const SEARCH_DELAY_MS = 300;

function DiscoverScreen({ navigation }) {
  const theme = use_theme();
  const { width } = useWindowDimensions();
  const list_ref = React.useRef(null);
  const [mode, set_mode] = React.useState('grid');
  const [query, set_query] = React.useState('');
  const is_signed_in = Auth.is_signed_in();
  const is_searching = mode === 'search';
  const list = use_post_list(DISCOVER_KEY);

  useScrollToTop(list_ref);
  use_scroll_to_top_title(navigation, 'Discover', list_ref);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.header_actions}>
          {is_searching ? null : (
            <HeaderIconButton
              icon={mode === 'grid' ? 'list' : 'grid'}
              label={mode === 'grid' ? 'Show as list' : 'Show as grid'}
              on_press={() => set_mode(mode === 'grid' ? 'list' : 'grid')}
            />
          )}
          {is_signed_in ? (
            <HeaderIconButton
              icon={is_searching ? 'close' : 'search'}
              label={is_searching ? 'Close search' : 'Search people'}
              on_press={() => set_mode(is_searching ? 'grid' : 'search')}
            />
          ) : null}
          <AccountButton navigation={navigation} />
        </View>
      ),
    });
  }, [navigation, mode, is_searching, is_signed_in]);

  React.useEffect(() => {
    if (!is_searching) {
      return;
    }

    const timeout_id = setTimeout(() => {
      Users.search(query);
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timeout_id);
    };
  }, [query, is_searching]);

  if (is_searching) {
    return <SearchResults navigation={navigation} on_change_query={set_query} query={query} />;
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
        on_action={() => Posts.refresh(DISCOVER_KEY)}
        title="Couldn't load Discover"
      />
    );
  }

  const { columns, tile_size } = grid_layout(width);
  const is_grid = mode === 'grid';

  function render_item({ item }) {
    if (is_grid) {
      return (
        <PhotoTile caption={`@${item.author.username}`} navigation={navigation} post={item} size={tile_size} />
      );
    }

    return <TimelineCard navigation={navigation} post={item} width={width} />;
  }

  return (
    <FlatList
      ListFooterComponent={<LoadingFooter is_loading={list.is_loading_more} />}
      columnWrapperStyle={is_grid ? styles.grid_row : undefined}
      contentContainerStyle={is_grid ? styles.grid : null}
      data={posts}
      key={is_grid ? `grid-${columns}` : 'list'}
      keyExtractor={item => item.id}
      numColumns={is_grid ? columns : 1}
      onEndReached={() => Posts.load_more(DISCOVER_KEY)}
      onEndReachedThreshold={1.5}
      ref={list_ref}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={() => Posts.refresh(DISCOVER_KEY)}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={list.is_refreshing}
        />
      }
      renderItem={render_item}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

const SearchResults = observer(function SearchResults({ navigation, query, on_change_query }) {
  const theme = use_theme();
  const list = Users.get_list(SEARCH_KEY);
  const users = list ? list.users() : [];
  const has_query = query.trim().length >= 2;

  function render_body() {
    if (!has_query) {
      return <MessageState message="Search for people by name or username." />;
    }

    if (list?.is_loading && users.length === 0) {
      return <LoadingState />;
    }

    if (list?.error_message) {
      return <MessageState message={list.error_message} />;
    }

    if (list?.did_load && users.length === 0) {
      return <MessageState message="No people found." />;
    }

    return (
      <FlatList
        data={users}
        keyboardShouldPersistTaps="handled"
        keyExtractor={item => item.username}
        renderItem={({ item }) => (
          <UserRow on_press={() => navigation.push('Profile', { username: item.username })} user={item} />
        )}
      />
    );
  }

  return (
    <View style={[styles.search_screen, { backgroundColor: theme.colors.canvas }]}>
      <View style={[styles.search_field, { backgroundColor: theme.colors.surface }]}>
        <Icon color={theme.colors.ink_soft} name="search" size={20} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={on_change_query}
          placeholder="Search people"
          placeholderTextColor={theme.colors.ink_soft}
          returnKeyType="search"
          style={[styles.search_input, { color: theme.colors.ink }]}
          value={query}
        />
      </View>
      {render_body()}
    </View>
  );
});

const styles = StyleSheet.create({
  header_actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  grid: {
    paddingTop: GRID_GAP,
  },
  grid_row: {
    gap: GRID_GAP,
    marginBottom: 10,
    paddingHorizontal: GRID_GAP,
  },
  search_screen: {
    flex: 1,
  },
  search_field: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
  },
  search_input: {
    flex: 1,
    fontSize: 16,
    height: 48,
  },
});

export default observer(DiscoverScreen);
