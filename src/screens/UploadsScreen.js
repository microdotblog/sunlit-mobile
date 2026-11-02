import React from 'react';
import { FlatList, PixelRatio, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import { resized_image_url } from '../components/imageUrls';
import { LoadingState, MessageState } from '../components/ListStates';
import { grid_layout } from '../components/PhotoGrid';
import Icon from '../platform/Icon';
import Composer from '../stores/Composer';
import Uploads from '../stores/Uploads';
import { upload_to_asset } from '../stores/createUploadsStore';
import { GRID_GAP, use_theme } from '../theme/theme';

function UploadsScreen({ navigation }) {
  const theme = use_theme();
  const { width } = useWindowDimensions();
  const [selected_urls, set_selected_urls] = React.useState([]);

  React.useEffect(() => {
    Uploads.refresh();
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          disabled={selected_urls.length === 0}
          hitSlop={8}
          onPress={add_selected}
          style={[styles.add, { opacity: selected_urls.length === 0 ? 0.4 : 1 }]}
        >
          <Text style={[styles.add_label, { color: theme.colors.accent }]}>
            {selected_urls.length > 0 ? `Add ${selected_urls.length}` : 'Add'}
          </Text>
        </Pressable>
      ),
    });
  });

  function toggle(url) {
    if (selected_urls.includes(url)) {
      set_selected_urls(selected_urls.filter(selected => selected !== url));
    } else {
      set_selected_urls([...selected_urls, url]);
    }
  }

  function add_selected() {
    const assets = selected_urls
      .map(url => Uploads.items.find(item => item.url === url))
      .filter(Boolean)
      .map(upload_to_asset);

    Composer.start(assets);
    navigation.replace('Composer');
  }

  if (!Uploads.did_load && Uploads.is_loading) {
    return <LoadingState />;
  }

  if (Uploads.error_message && Uploads.items.length === 0) {
    return <MessageState action_title="Try again" message={Uploads.error_message} on_action={() => Uploads.refresh()} />;
  }

  const { columns, tile_size } = grid_layout(width);

  return (
    <FlatList
      ListEmptyComponent={<MessageState message="Photos you upload to Micro.blog show up here." title="No uploads yet" />}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      data={Uploads.items}
      key={`uploads-${columns}`}
      keyExtractor={item => item.url}
      numColumns={columns}
      refreshControl={
        <RefreshControl
          colors={[theme.colors.accent]}
          onRefresh={() => Uploads.refresh()}
          progressBackgroundColor={theme.colors.canvas}
          refreshing={Uploads.did_load && Uploads.is_loading}
        />
      }
      renderItem={({ item }) => {
        const order = selected_urls.indexOf(item.url);
        const preview = resized_image_url(item.poster || item.url, PixelRatio.getPixelSizeForLayoutSize(tile_size));

        return (
          <Pressable
            accessibilityLabel={item.alt || 'Upload'}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: order >= 0 }}
            onPress={() => toggle(item.url)}
            style={[styles.tile, { backgroundColor: theme.colors.surface, height: tile_size, width: tile_size }]}
          >
            <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: preview }} style={StyleSheet.absoluteFill} />
            {item.kind === 'video' ? (
              <View pointerEvents="none" style={styles.video_badge}>
                <Icon color="#FFFFFF" name="video" size={18} />
              </View>
            ) : null}
            {order >= 0 ? (
              <View pointerEvents="none" style={[styles.selected, { borderColor: theme.colors.accent }]}>
                <View style={[styles.order, { backgroundColor: theme.colors.accent }]}>
                  <Text style={[styles.order_label, { color: theme.colors.on_accent }]}>{order + 1}</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      }}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingTop: GRID_GAP,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    paddingHorizontal: GRID_GAP,
  },
  tile: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  video_badge: {
    position: 'absolute',
    right: 6,
    top: 6,
  },
  selected: {
    ...StyleSheet.absoluteFill,
    borderRadius: 6,
    borderWidth: 3,
  },
  order: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
  },
  order_label: {
    fontSize: 13,
    fontWeight: '700',
  },
  add: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  add_label: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default observer(UploadsScreen);
