import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { open_in_browser } from '../navigation/links';
import { use_theme } from '../theme/theme';

const COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export default function OsmAttribution({ inset_bottom = false }) {
  const theme = use_theme();
  const insets = useSafeAreaInsets();
  const padding_bottom = inset_bottom ? insets.bottom + 8 : 12;

  return (
    <Text
      accessibilityRole="link"
      onPress={() => open_in_browser(COPYRIGHT_URL)}
      style={[styles.label, { color: theme.colors.ink_soft, paddingBottom: padding_bottom }]}
    >
      Map data © OpenStreetMap contributors
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    textAlign: 'center',
  },
});
