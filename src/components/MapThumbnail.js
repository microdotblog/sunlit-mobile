import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { tiles_around, TILE_SIZE, USER_AGENT } from '../api/OpenStreetMap';
import { use_theme } from '../theme/theme';

export default function MapThumbnail({ latitude, longitude, size = 56 }) {
  const theme = use_theme();
  const tile_display_size = size * 2;
  const ratio = tile_display_size / TILE_SIZE;
  const tiles = tiles_around({ latitude, longitude }, { half_extent: 0.25 });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { backgroundColor: theme.colors.pane, height: size, width: size }]}
    >
      {tiles.map(tile => (
        <Image
          cachePolicy="disk"
          key={tile.url}
          source={{ headers: { 'User-Agent': USER_AGENT }, uri: tile.url }}
          style={{
            height: tile_display_size,
            left: size / 2 + tile.left * ratio,
            position: 'absolute',
            top: size / 2 + tile.top * ratio,
            width: tile_display_size,
          }}
        />
      ))}
      <View style={[styles.pin, { backgroundColor: theme.colors.accent }]} />
    </View>
  );
}

const PIN_SIZE = 12;

const styles = StyleSheet.create({
  frame: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  pin: {
    borderColor: '#FFFFFF',
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    height: PIN_SIZE,
    left: '50%',
    marginLeft: -PIN_SIZE / 2,
    marginTop: -PIN_SIZE / 2,
    position: 'absolute',
    top: '50%',
    width: PIN_SIZE,
  },
});
