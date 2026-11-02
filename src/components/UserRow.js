import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { use_theme } from '../theme/theme';
import Avatar from './Avatar';

function UserRow({ user, on_press }) {
  const theme = use_theme();

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: theme.colors.selection }}
      onPress={on_press}
      style={[styles.row, { borderBottomColor: theme.colors.line }]}
    >
      <Avatar size={40} uri={user.avatar} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, { color: theme.colors.ink }]}>
          {user.display_name()}
        </Text>
        <Text numberOfLines={1} style={[styles.username, { color: theme.colors.ink_soft }]}>
          @{user.username}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
  },
});

export default observer(UserRow);
