import React from 'react';
import { FlatList, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { observer } from 'mobx-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PostMediaItem from '../components/PostMediaItem';
import { perform_post_action } from '../components/postActions';
import ZoomablePage from '../components/ZoomablePage';
import Icon from '../platform/Icon';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';

function ImageViewerScreen({ navigation, route }) {
  const { id, index: initial_index = 0 } = route.params;
  const post = Posts.get_post(id);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page_index, set_page_index] = React.useState(initial_index);
  const [is_overlay_visible, set_is_overlay_visible] = React.useState(true);
  const [is_zoomed, set_is_zoomed] = React.useState(false);

  if (!post) {
    return <View style={styles.screen} />;
  }

  const media = post.media;
  const current_media = media[page_index] || null;
  const page_label = media.length > 1 ? `${page_index + 1} of ${media.length}` : '';

  function close() {
    navigation.goBack();
  }

  function toggle_overlay() {
    set_is_overlay_visible(!is_overlay_visible);
  }

  function open_conversation() {
    const routes = navigation.getState().routes;
    const previous_route = routes[routes.length - 2];

    if (previous_route?.name === 'Conversation' && previous_route.params?.id === post.id) {
      navigation.goBack();
    } else {
      navigation.replace('Conversation', { id: post.id });
    }
  }

  function handle_scroll_end(event) {
    set_page_index(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function render_page({ item }) {
    if (item.video_url) {
      return (
        <View style={[styles.video_page, { height, width }]}>
          <PostMediaItem content_fit="contain" height={width} media={item} on_press={toggle_overlay} width={width} />
        </View>
      );
    }

    return (
      <ZoomablePage
        height={height}
        media={item}
        on_dismiss={close}
        on_tap={toggle_overlay}
        on_zoom_change={set_is_zoomed}
        width={width}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden={!is_overlay_visible} />
      <FlatList
        data={media}
        getItemLayout={(_, item_index) => ({ index: item_index, length: width, offset: width * item_index })}
        horizontal
        initialScrollIndex={Math.min(initial_index, Math.max(media.length - 1, 0))}
        keyExtractor={(item, item_index) => `${item_index}:${item.url}`}
        onMomentumScrollEnd={handle_scroll_end}
        pagingEnabled
        renderItem={render_page}
        scrollEnabled={!is_zoomed && media.length > 1}
        showsHorizontalScrollIndicator={false}
      />
      {is_overlay_visible ? (
        <>
          <View style={[styles.top_bar, { paddingTop: insets.top + 4 }]}>
            <OverlayButton icon="close" label="Close" on_press={close} />
            <Text style={styles.page_label}>{page_label}</Text>
            <View style={styles.top_actions}>
              {Auth.is_signed_in() ? (
                <OverlayButton
                  icon={post.is_bookmark ? 'bookmark' : 'bookmark_outline'}
                  label={post.is_bookmark ? 'Remove bookmark' : 'Bookmark'}
                  on_press={() => perform_post_action(navigation, post, 'bookmark')}
                />
              ) : null}
              <OverlayButton
                icon="share"
                label="Share"
                on_press={() => perform_post_action(navigation, post, 'share')}
              />
            </View>
          </View>
          <View style={[styles.bottom_bar, { paddingBottom: insets.bottom + 12 }]}>
            {current_media?.alt ? (
              <Text numberOfLines={4} style={styles.alt_text}>
                {current_media.alt}
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={open_conversation} style={styles.conversation_button}>
              <Icon color="#FFFFFF" name="conversation" size={20} />
              <Text style={styles.conversation_label}>@{post.author.username}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function OverlayButton({ icon, label, on_press }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      android_ripple={{ borderless: true, color: 'rgba(255, 255, 255, 0.3)', radius: 22 }}
      hitSlop={8}
      onPress={on_press}
      style={styles.overlay_button}
    >
      <Icon color="#FFFFFF" name={icon} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  video_page: {
    justifyContent: 'center',
  },
  top_bar: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 8,
    paddingBottom: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  top_actions: {
    flexDirection: 'row',
  },
  page_label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  overlay_button: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bottom_bar: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    bottom: 0,
    gap: 10,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  alt_text: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
  },
  conversation_button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  conversation_label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default observer(ImageViewerScreen);
