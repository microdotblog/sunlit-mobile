import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

import Icon from '../platform/Icon';
import { use_theme } from '../theme/theme';

export default function PostMediaItem({
  media,
  blurhash = null,
  width,
  height,
  content_fit = 'cover',
  on_press,
  on_long_press,
}) {
  const theme = use_theme();
  const [is_playing, set_is_playing] = React.useState(false);
  const is_video = Boolean(media.video_url);
  const placeholder = resolve_placeholder(blurhash);

  function handle_press() {
    if (is_video && !is_playing) {
      set_is_playing(true);
    } else if (on_press) {
      on_press();
    }
  }

  return (
    <Pressable
      accessibilityLabel={media.alt || undefined}
      accessibilityRole="imagebutton"
      delayLongPress={350}
      onLongPress={on_long_press}
      onPress={handle_press}
      style={[styles.frame, { backgroundColor: theme.colors.surface, height, width }]}
    >
      {is_video && is_playing ? (
        <InlineVideo uri={media.video_url} />
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          cachePolicy="memory-disk"
          contentFit={content_fit}
          placeholder={placeholder}
          placeholderContentFit="cover"
          recyclingKey={media.url}
          source={{ uri: media.url }}
          style={StyleSheet.absoluteFill}
          transition={160}
        />
      )}
      {is_video && !is_playing ? (
        <View pointerEvents="none" style={styles.play_badge}>
          <Icon color="#FFFFFF" name="play" size={56} />
        </View>
      ) : null}
    </Pressable>
  );
}

function InlineVideo({ uri }) {
  const player = useVideoPlayer(uri, video_player => {
    video_player.loop = true;
    video_player.play();
  });

  return (
    <VideoView
      contentFit="cover"
      nativeControls={false}
      player={player}
      style={StyleSheet.absoluteFill}
    />
  );
}

function resolve_placeholder(blurhash) {
  if (blurhash) {
    return { blurhash };
  } else {
    return undefined;
  }
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  play_badge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
