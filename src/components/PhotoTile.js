import React from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import ContextMenu from '../platform/ContextMenu';
import Icon from '../platform/Icon';
import { use_theme } from '../theme/theme';
import { resized_image_url } from './imageUrls';
import { build_post_actions, perform_post_action } from './postActions';

function PhotoTile({ post, size, caption, navigation }) {
  const theme = use_theme();
  const first_media = post.media.length > 0 ? post.media[0] : null;
  const actions = build_post_actions(post);
  const image_url = resized_image_url(first_media?.url, PixelRatio.getPixelSizeForLayoutSize(size));

  function open_conversation() {
    navigation.push('Conversation', { id: post.id });
  }

  return (
    <View style={{ width: size }}>
      <ContextMenu actions={actions} on_action={action_id => perform_post_action(navigation, post, action_id)}>
        {({ open_menu }) => (
          <Pressable
            accessibilityLabel={first_media?.alt || `Photo by @${post.author.username}`}
            accessibilityRole="imagebutton"
            onLongPress={open_menu}
            onPress={open_conversation}
            style={[styles.tile, { backgroundColor: theme.colors.surface, height: size, width: size }]}
          >
            {first_media ? (
              <Image
                accessibilityIgnoresInvertColors
                cachePolicy="memory-disk"
                contentFit="cover"
                placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
                recyclingKey={image_url}
                source={{ uri: image_url }}
                style={StyleSheet.absoluteFill}
                transition={120}
              />
            ) : null}
            {first_media?.video_url ? (
              <View pointerEvents="none" style={styles.video_badge}>
                <Icon color="#FFFFFF" name="play" size={22} />
              </View>
            ) : null}
          </Pressable>
        )}
      </ContextMenu>
      {caption ? (
        <Text numberOfLines={1} style={[styles.caption, { color: theme.colors.ink_soft }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  video_badge: {
    position: 'absolute',
    right: 6,
    top: 6,
  },
  caption: {
    fontSize: 13,
    marginTop: 4,
  },
});

export default observer(PhotoTile);
