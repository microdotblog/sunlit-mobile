import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { observer } from 'mobx-react';

import { LoadingState, MessageState } from '../components/ListStates';
import UserRow from '../components/UserRow';
import Users from '../stores/Users';
import { following_key } from '../stores/createUsersStore';
import { use_theme } from '../theme/theme';

function FollowingScreen({ navigation, route }) {
  const { username } = route.params;
  const theme = use_theme();
  const list = Users.get_list(following_key(username));

  React.useEffect(() => {
    Users.load_following(username);
  }, [username]);

  if (!list || (list.is_loading && !list.did_load)) {
    return <LoadingState />;
  }

  if (list.error_message && list.users().length === 0) {
    return (
      <MessageState action_title="Try again" message={list.error_message} on_action={() => Users.load_following(username)} />
    );
  }

  return (
    <FlatList
      ListEmptyComponent={<MessageState message="Not following anyone yet." />}
      data={list.users()}
      keyExtractor={item => item.username}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={() => Users.load_following(username)}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={list.is_loading && list.did_load}
        />
      }
      renderItem={({ item }) => (
        <UserRow on_press={() => navigation.push('Profile', { username: item.username })} user={item} />
      )}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

export default observer(FollowingScreen);
