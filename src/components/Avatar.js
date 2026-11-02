import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { use_theme } from '../theme/theme';

export default function Avatar({ uri = '', size = 40 }) {
  const theme = use_theme();
  const frame_style = {
    backgroundColor: theme.colors.pane,
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  return (
    <View style={[styles.frame, frame_style]}>
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          transition={120}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
});
