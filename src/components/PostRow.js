import React from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import { open_link } from '../navigation/links';
import ContextMenu from '../platform/ContextMenu';
import { use_theme } from '../theme/theme';
import Avatar from './Avatar';
import { format_relative_date } from './formatDate';
import HtmlText from './HtmlText';
import { resized_image_url } from './imageUrls';
import { build_post_actions, perform_post_action } from './postActions';

const THUMBNAIL_SIZE = 72;

function PostRow({ post, navigation, on_press, show_media = true, include_conversation_action = true }) {
  const theme = use_theme();
  const actions = build_post_actions(post, { include_conversation: include_conversation_action });
  const thumbnails = show_media ? post.media.slice(0, 4) : [];

  function open_profile() {
    navigation.push('Profile', { username: post.author.username });
  }

  function open_viewer(index) {
    navigation.push('ImageViewer', { id: post.id, index });
  }

  return (
    <ContextMenu actions={actions} on_action={action_id => perform_post_action(navigation, post, action_id)}>
      {({ open_menu }) => (
        <Pressable
          android_ripple={{ color: theme.colors.selection }}
          onLongPress={open_menu}
          onPress={on_press}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <Pressable accessibilityLabel={`Profile of @${post.author.username}`} onPress={open_profile}>
            <Avatar size={40} uri={post.author.avatar} />
          </Pressable>
          <View style={styles.body}>
            <View style={styles.header}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.colors.ink }]}>
                {post.author.display_name()}
              </Text>
              <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.ink_soft }]}>
                @{post.author.username} · {format_relative_date(post.date_published)}
              </Text>
            </View>
            {post.has_text() ? (
              <HtmlText on_link={href => open_link(navigation, href)} paragraphs={post.paragraphs} />
            ) : null}
            {thumbnails.length > 0 ? (
              <View style={styles.thumbnails}>
                {thumbnails.map((media, index) => (
                  <Pressable
                    accessibilityLabel={media.alt || 'Photo'}
                    key={`${index}:${media.url}`}
                    onPress={() => open_viewer(index)}
                    style={[styles.thumbnail, { backgroundColor: theme.colors.surface }]}
                  >
                    <Image
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      source={{ uri: resized_image_url(media.url, PixelRatio.getPixelSizeForLayoutSize(THUMBNAIL_SIZE)) }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
      )}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  header: {
    gap: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
  },
  thumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  thumbnail: {
    borderRadius: 8,
    height: THUMBNAIL_SIZE,
    overflow: 'hidden',
    width: THUMBNAIL_SIZE,
  },
});

export default observer(PostRow);
