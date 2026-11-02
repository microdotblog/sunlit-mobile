import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { MAX_CARD_PHOTO_HEIGHT } from '../theme/theme';
import PostMediaItem from './PostMediaItem';

export function carousel_height(post, width) {
  return Math.min(Math.round(width * post.aspect_ratio), MAX_CARD_PHOTO_HEIGHT);
}

export default function PhotoCarousel({ post, width, on_press, on_long_press }) {
  const [page_index, set_page_index] = React.useState(0);
  const height = carousel_height(post, width);
  const media = post.media;
  const has_pages = media.length > 1;

  function handle_scroll_end(event) {
    const offset = event.nativeEvent.contentOffset.x;
    set_page_index(Math.round(offset / width));
  }

  function render_item({ item, index }) {
    return (
      <PostMediaItem
        blurhash={index === 0 ? post.blurhash : null}
        height={height}
        media={item}
        on_long_press={on_long_press}
        on_press={() => on_press(index)}
        width={width}
      />
    );
  }

  return (
    <View style={{ height, width }}>
      <FlatList
        data={media}
        getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
        horizontal
        keyExtractor={(item, index) => `${index}:${item.url}`}
        onMomentumScrollEnd={handle_scroll_end}
        pagingEnabled
        renderItem={render_item}
        scrollEnabled={has_pages}
        showsHorizontalScrollIndicator={false}
      />
      {has_pages ? <PageDots count={media.length} index={page_index} /> : null}
    </View>
  );
}

function PageDots({ count, index }) {
  const dots = Array.from({ length: count }, (_, dot_index) => dot_index);

  return (
    <View pointerEvents="none" style={styles.dots}>
      {dots.map(dot_index => (
        <View
          key={dot_index}
          style={[styles.dot, dot_index === index ? styles.dot_active : null]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  dot_active: {
    backgroundColor: '#FFFFFF',
  },
});
