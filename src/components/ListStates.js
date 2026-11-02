import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { use_theme } from '../theme/theme';

export function LoadingState() {
  const theme = use_theme();

  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}

export function MessageState({ title, message, action_title, on_action }) {
  const theme = use_theme();

  return (
    <View style={styles.center}>
      {title ? <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text> : null}
      {message ? <Text style={[styles.message, { color: theme.colors.ink_soft }]}>{message}</Text> : null}
      {action_title ? (
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: theme.colors.accent_soft }}
          onPress={on_action}
          style={[styles.button, { borderColor: theme.colors.accent }]}
        >
          <Text style={[styles.button_label, { color: theme.colors.accent }]}>{action_title}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingFooter({ is_loading }) {
  const theme = use_theme();

  if (!is_loading) {
    return null;
  }

  return (
    <View style={styles.footer}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  button_label: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 24,
  },
});
