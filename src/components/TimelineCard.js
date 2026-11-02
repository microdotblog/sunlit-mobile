import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import ContextMenu from '../platform/ContextMenu';
import { use_theme } from '../theme/theme';
import Avatar from './Avatar';
import PhotoCarousel from './PhotoCarousel';
import { build_post_actions, perform_post_action } from './postActions';

function TimelineCard({ post, width, navigation }) {
  const theme = use_theme();
  const actions = build_post_actions(post);

  function open_conversation() {
    navigation.push('Conversation', { id: post.id });
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.canvas }]}>
      <ContextMenu actions={actions} on_action={action_id => perform_post_action(navigation, post, action_id)}>
        {({ open_menu }) => (
          <PhotoCarousel
            on_long_press={open_menu}
            on_press={open_conversation}
            post={post}
            width={width}
          />
        )}
      </ContextMenu>
      <View pointerEvents="none" style={[styles.bubble, { backgroundColor: theme.colors.bubble }]}>
        <Avatar size={28} uri={post.author.avatar} />
        <Text numberOfLines={1} style={[styles.handle, { color: theme.colors.ink }]}>
          @{post.author.username}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 5,
  },
  bubble: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    left: 8,
    maxWidth: '80%',
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    position: 'absolute',
    top: 8,
  },
  handle: {
    flexShrink: 1,
    fontSize: 14,
  },
});

export default observer(TimelineCard);
