import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { use_theme } from '../theme/theme';

export default function TabBar({ state, descriptors, navigation }) {
  const theme = use_theme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.canvas,
          borderTopColor: theme.colors.line,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const is_focused = state.index === index;
        const color = is_focused ? theme.colors.accent : theme.colors.ink_soft;

        function handle_press() {
          const event = navigation.emit({ canPreventDefault: true, target: route.key, type: 'tabPress' });

          if (!is_focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        return (
          <Pressable
            accessibilityLabel={route.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: is_focused }}
            key={route.key}
            onPress={handle_press}
            style={styles.item}
          >
            <View style={[styles.indicator, { backgroundColor: is_focused ? theme.colors.accent_soft : theme.colors.canvas }]}>
              {options.tabBarIcon({ color, focused: is_focused, size: 24 })}
            </View>
            <Text style={[styles.label, { color, fontWeight: is_focused ? '700' : '500' }]}>{route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingBottom: 12,
    paddingTop: 12,
  },
  indicator: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 64,
  },
  label: {
    fontSize: 12,
  },
});
