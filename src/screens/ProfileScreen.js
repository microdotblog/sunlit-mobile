import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { observer } from 'mobx-react';

import Avatar from '../components/Avatar';
import { format_short_date } from '../components/formatDate';
import { LoadingFooter, LoadingState, MessageState } from '../components/ListStates';
import { grid_layout } from '../components/PhotoGrid';
import PhotoTile from '../components/PhotoTile';
import { use_post_list } from '../components/usePostList';
import { HeaderIconButton } from '../navigation/headers';
import { open_in_browser, share_url } from '../navigation/links';
import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';
import Users from '../stores/Users';
import { photos_key } from '../stores/createPostsStore';
import { GRID_GAP, use_theme } from '../theme/theme';

function ProfileScreen({ navigation, route }) {
  const { username } = route.params;
  const theme = use_theme();
  const { width } = useWindowDimensions();
  const key = photos_key(username);
  const user = Users.get_user(username);
  const status = Users.get_profile_status(username);
  const list = use_post_list(key);
  const is_you = user?.is_you === true || username === Auth.profile_username;
  const profile_url = `https://micro.blog/${username}`;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `@${username}`,
      headerRight: () => (
        <View style={styles.header_actions}>
          <HeaderIconButton icon="share" label="Share profile" on_press={() => share_url(profile_url)} />
          {is_you ? (
            <HeaderIconButton icon="settings" label="Settings" on_press={() => navigation.navigate('Settings')} />
          ) : null}
        </View>
      ),
    });
  }, [navigation, username, is_you, profile_url]);

  const has_status = Boolean(status);

  React.useEffect(() => {
    Users.load_profile(username);
  }, [username, has_status]);

  function refresh() {
    Users.load_profile(username);
    Posts.refresh(key);
  }

  if (!user && status?.error_message) {
    return <MessageState action_title="Try again" message={status.error_message} on_action={refresh} />;
  }

  if (!user) {
    return <LoadingState />;
  }

  const { columns, tile_size } = grid_layout(width);
  const posts = list ? list.posts() : [];

  function render_footer() {
    if (!list || (list.is_loading && posts.length === 0)) {
      return <LoadingFooter is_loading />;
    }

    if (posts.length === 0) {
      return <MessageState message="No photos yet." />;
    }

    return <LoadingFooter is_loading={list.is_loading_more} />;
  }

  return (
    <FlatList
      ListFooterComponent={render_footer}
      ListHeaderComponent={<ProfileHeader is_you={is_you} navigation={navigation} user={user} />}
      columnWrapperStyle={styles.grid_row}
      data={posts}
      key={`grid-${columns}`}
      keyExtractor={item => item.id}
      numColumns={columns}
      onEndReached={() => Posts.load_more(key)}
      onEndReachedThreshold={1.5}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={refresh}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={Boolean(list?.is_refreshing)}
        />
      }
      renderItem={({ item }) => (
        <PhotoTile
          caption={format_short_date(item.date_published)}
          navigation={navigation}
          post={item}
          size={tile_size}
        />
      )}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

const ProfileHeader = observer(function ProfileHeader({ user, is_you, navigation }) {
  const theme = use_theme();
  const site_host = user.site_host();

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar size={80} uri={user.avatar} />
        <View style={styles.identity_copy}>
          <Text style={[styles.name, { color: theme.colors.ink }]}>{user.display_name()}</Text>
          <Text style={[styles.username, { color: theme.colors.ink_soft }]}>@{user.username}</Text>
          {site_host ? (
            <Text onPress={() => open_in_browser(user.url)} style={[styles.site, { color: theme.colors.accent }]}>
              {site_host}
            </Text>
          ) : null}
        </View>
      </View>
      {user.bio ? <Text style={[styles.bio, { color: theme.colors.ink }]}>{user.bio}</Text> : null}
      <View style={styles.actions}>
        {is_you ? (
          <CapsuleButton
            label={`Following ${user.following_count ?? ''}`.trim()}
            on_press={() => navigation.push('Following', { username: user.username })}
          />
        ) : (
          <FollowButton user={user} />
        )}
      </View>
    </View>
  );
});

const FollowButton = observer(function FollowButton({ user }) {
  const [is_busy, set_is_busy] = React.useState(false);

  if (!Auth.is_signed_in() || user.is_following == null) {
    return null;
  }

  async function toggle_follow() {
    set_is_busy(true);

    try {
      await Users.toggle_follow(user.username);
    } catch (error) {
      AppStore.show_toast('Could not update following');
    } finally {
      set_is_busy(false);
    }
  }

  return (
    <CapsuleButton
      is_busy={is_busy}
      is_filled={!user.is_following}
      label={user.is_following ? 'Following' : 'Follow'}
      on_press={toggle_follow}
    />
  );
});

function CapsuleButton({ label, on_press, is_filled = false, is_busy = false }) {
  const theme = use_theme();
  const background_color = is_filled ? theme.colors.accent : theme.colors.canvas;
  const label_color = is_filled ? theme.colors.on_accent : theme.colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: theme.colors.accent_soft }}
      disabled={is_busy}
      onPress={on_press}
      style={[styles.capsule, { backgroundColor: background_color, borderColor: theme.colors.accent }]}
    >
      {is_busy ? (
        <ActivityIndicator color={label_color} size="small" />
      ) : (
        <Text style={[styles.capsule_label, { color: label_color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header_actions: {
    flexDirection: 'row',
  },
  header: {
    gap: 14,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  identity_copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  username: {
    fontSize: 15,
  },
  site: {
    fontSize: 15,
  },
  bio: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
  },
  capsule: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 110,
    overflow: 'hidden',
    paddingHorizontal: 18,
  },
  capsule_label: {
    fontSize: 15,
    fontWeight: '600',
  },
  grid_row: {
    gap: GRID_GAP,
    marginBottom: 10,
    paddingHorizontal: GRID_GAP,
  },
});

export default observer(ProfileScreen);
