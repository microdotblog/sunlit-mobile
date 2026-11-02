import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import { use_theme } from '../theme/theme';

const WAVES = require('../../assets/images/welcome-waves.png');

function WelcomeView() {
  const theme = use_theme();
  const [is_showing_token_field, set_is_showing_token_field] = React.useState(false);
  const [token, set_token] = React.useState('');
  const is_loading = Auth.is_loading();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <Image contentFit="cover" source={WAVES} style={styles.waves} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.ink }]}>Welcome to Sunlit</Text>
        <Text style={[styles.message, { color: theme.colors.ink_soft }]}>
          Share photos to your blog and discover photography from the Micro.blog community.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(255, 255, 255, 0.25)' }}
          disabled={is_loading}
          onPress={() => Auth.sign_in_with_micro_blog()}
          style={[styles.primary_button, { backgroundColor: theme.colors.accent }]}
        >
          {is_loading ? (
            <ActivityIndicator color={theme.colors.on_accent} />
          ) : (
            <Text style={[styles.primary_label, { color: theme.colors.on_accent }]}>Sign in with Micro.blog</Text>
          )}
        </Pressable>
        {is_showing_token_field ? (
          <View style={styles.token_row}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={set_token}
              onSubmitEditing={() => Auth.sign_in_with_token(token)}
              placeholder="App token"
              placeholderTextColor={theme.colors.ink_soft}
              returnKeyType="go"
              secureTextEntry
              style={[styles.token_input, { borderColor: theme.colors.line, color: theme.colors.ink }]}
              value={token}
            />
            <Pressable
              accessibilityRole="button"
              disabled={is_loading}
              onPress={() => Auth.sign_in_with_token(token)}
              style={styles.text_button}
            >
              <Text style={[styles.text_button_label, { color: theme.colors.accent }]}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => set_is_showing_token_field(true)} style={styles.text_button}>
            <Text style={[styles.text_button_label, { color: theme.colors.accent }]}>Use an app token</Text>
          </Pressable>
        )}
        {Auth.error_message ? (
          <Text style={[styles.error, { color: theme.colors.danger }]}>{Auth.error_message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
  },
  waves: {
    aspectRatio: 640 / 400,
    width: '100%',
  },
  copy: {
    gap: 8,
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 32,
    paddingTop: 28,
  },
  primary_button: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary_label: {
    fontSize: 16,
    fontWeight: '600',
  },
  token_row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  token_input: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    height: 44,
    paddingHorizontal: 12,
  },
  text_button: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  text_button_label: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default observer(WelcomeView);
