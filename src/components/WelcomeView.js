import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackground from './auth/AuthBackground';
import { open_in_browser } from '../navigation/links';
import Auth from '../stores/Auth';
import { use_theme } from '../theme/theme';

const APP_ICON = require('../../assets/images/app-icon.png');
const MICRO_BLOG_LOGO = require('../../assets/images/mb_logo.png');
const TERMS_URL = 'https://help.micro.blog/t/terms-of-service/113';
const PRIVACY_URL = 'https://help.micro.blog/t/privacy-policy/114';
const GUIDELINES_URL = 'https://help.micro.blog/t/community-guidelines/39';
const FOOTER_ENTRANCE_DELAY_MS = 620;

function WelcomeView() {
  const theme = use_theme();
  const is_signing_in = Auth.is_loading();
  const error_message = Auth.error_message;
  const [is_token_modal_visible, set_is_token_modal_visible] = React.useState(false);
  const [token_value, set_token_value] = React.useState('');
  const footer_opacity = useSharedValue(0);
  const footer_translate_y = useSharedValue(26);

  React.useEffect(() => {
    footer_opacity.value = withDelay(FOOTER_ENTRANCE_DELAY_MS, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    footer_translate_y.value = withDelay(FOOTER_ENTRANCE_DELAY_MS, withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }));
  }, [footer_opacity, footer_translate_y]);

  const footer_animated_style = useAnimatedStyle(() => {
    return {
      opacity: footer_opacity.value,
      transform: [{ translateY: footer_translate_y.value }],
    };
  }, []);

  function open_token_modal() {
    Auth.clear_error();
    set_is_token_modal_visible(true);
  }

  function close_token_modal() {
    Auth.clear_error();
    set_is_token_modal_visible(false);
    set_token_value('');
  }

  function handle_token_value_change(value = '') {
    set_token_value(value);

    if (error_message) {
      Auth.clear_error();
    }
  }

  async function handle_token_submit() {
    const did_sign_in = await Auth.sign_in_with_token(token_value);

    if (did_sign_in) {
      set_is_token_modal_visible(false);
      set_token_value('');
    }
  }

  const footer_error_message = is_token_modal_visible ? null : error_message;
  const modal_error_message = is_token_modal_visible ? error_message : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />
      <SafeAreaView edges={['top']} style={styles.safe_area}>
        <ScrollView bounces={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(680)} style={styles.hero}>
            <Image source={APP_ICON} style={styles.app_icon} />
            <View style={styles.hero_copy}>
              <Text style={[styles.kicker, { color: theme.colors.accent }]}>Sunlit</Text>
              <Text style={[styles.title, { color: theme.colors.ink }]}>Share photos to your blog.</Text>
              <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
                Discover photography from the Micro.blog community. Sign in with Micro.blog to get started.
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.footer, footer_animated_style]}>
            {footer_error_message ? (
              <Text selectable style={[styles.error_message, { color: theme.colors.danger }]}>
                {footer_error_message}
              </Text>
            ) : null}

            <PrimaryButton
              accessibilityHint="Long press to sign in with an app token."
              is_loading={is_signing_in}
              label={is_signing_in ? 'Connecting to Micro.blog...' : 'Sign in with Micro.blog'}
              leading_icon_source={MICRO_BLOG_LOGO}
              on_long_press={open_token_modal}
              on_press={() => Auth.sign_in_with_micro_blog()}
              theme={theme}
              variant="light"
            />

            <LegalLinks theme={theme} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <TokenSignInModal
        error_message={modal_error_message}
        is_signing_in={is_signing_in}
        on_cancel={close_token_modal}
        on_change_token_value={handle_token_value_change}
        on_submit={handle_token_submit}
        theme={theme}
        token_value={token_value}
        visible={is_token_modal_visible}
      />
    </View>
  );
}

function LegalLinks({ theme }) {
  const link_style = [styles.legal_link, { color: theme.colors.ink }];

  return (
    <Text style={[styles.legal_text, { color: theme.colors.ink_soft }]}>
      By using the app you accept our{' '}
      <Text accessibilityRole="link" onPress={() => open_in_browser(TERMS_URL)} style={link_style}>
        terms of service
      </Text>
      ,{' '}
      <Text accessibilityRole="link" onPress={() => open_in_browser(PRIVACY_URL)} style={link_style}>
        privacy policy
      </Text>
      , and{' '}
      <Text accessibilityRole="link" onPress={() => open_in_browser(GUIDELINES_URL)} style={link_style}>
        community guidelines
      </Text>
      .
    </Text>
  );
}

function PrimaryButton({ accessibilityHint = null, is_loading = false, label, leading_icon_source = null, on_long_press, on_press, theme, variant = 'solid' }) {
  const is_light = variant === 'light';
  const scale = useSharedValue(1);
  const colors = button_colors(theme, is_light, is_loading);

  const animated_style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  }, []);

  function handle_press_in() {
    scale.value = withSpring(0.985, { damping: 18, stiffness: 240 });
  }

  function handle_press_out() {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
  }

  return (
    <Animated.View style={animated_style}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={is_loading}
        onLongPress={on_long_press}
        onPress={on_press}
        onPressIn={handle_press_in}
        onPressOut={handle_press_out}
        style={[styles.primary_button, colors.button]}
      >
        {leading_icon_source ? (
          <View style={styles.primary_button_icon}>
            {is_loading ? (
              <ActivityIndicator color={theme.colors.accent} size="small" />
            ) : (
              <Image contentFit="contain" source={leading_icon_source} style={styles.primary_button_logo} />
            )}
          </View>
        ) : null}
        <Text style={[styles.primary_button_label, { color: colors.label }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function button_colors(theme, is_light, is_loading) {
  if (is_loading) {
    return {
      button: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1 },
      label: theme.colors.ink_soft,
    };
  } else if (is_light) {
    return {
      button: {
        backgroundColor: theme.is_dark ? theme.colors.surface : '#FFFFFF',
        borderColor: theme.colors.line,
        borderWidth: 1,
        boxShadow: theme.is_dark ? '0 8px 16px rgba(0, 0, 0, 0.2)' : '0 8px 16px rgba(95, 53, 0, 0.1)',
      },
      label: theme.colors.ink,
    };
  } else {
    return {
      button: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
        borderWidth: 1,
        boxShadow: theme.is_dark ? '0 10px 18px rgba(0, 0, 0, 0.28)' : '0 10px 18px rgba(0, 60, 110, 0.18)',
      },
      label: theme.colors.on_accent,
    };
  }
}

function TokenSignInModal({ error_message = null, is_signing_in = false, on_cancel, on_change_token_value, on_submit, theme, token_value = '', visible = false }) {
  return (
    <Modal animationType="fade" onRequestClose={on_cancel} statusBarTranslucent transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modal_root, { backgroundColor: theme.colors.scrim }]}>
        <Pressable accessibilityLabel="Dismiss sign-in dialog" accessibilityRole="button" onPress={on_cancel} style={styles.modal_backdrop} />

        <View
          style={[
            styles.modal_card,
            {
              backgroundColor: theme.is_dark ? theme.colors.surface : '#FFFFFF',
              borderColor: theme.colors.line,
              boxShadow: theme.is_dark ? '0 16px 28px rgba(0, 0, 0, 0.42)' : '0 16px 28px rgba(95, 53, 0, 0.18)',
            },
          ]}
        >
          <Text style={[styles.modal_title, { color: theme.colors.ink }]}>Sign in with a token</Text>
          <Text style={[styles.modal_body, { color: theme.colors.ink_soft }]}>Paste a Micro.blog app token from your account page.</Text>

          <View style={[styles.modal_input_wrap, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.line }]}>
            <TextInput
              accessibilityLabel="Micro.blog app token"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={visible}
              onChangeText={on_change_token_value}
              onSubmitEditing={on_submit}
              placeholder="Micro.blog token"
              placeholderTextColor={theme.colors.ink_soft}
              returnKeyType="done"
              secureTextEntry
              selectionColor={theme.colors.accent}
              style={[styles.modal_input, { color: theme.colors.ink }]}
              value={token_value}
            />
          </View>

          {error_message ? (
            <Text selectable style={[styles.modal_error, { color: theme.colors.danger }]}>
              {error_message}
            </Text>
          ) : null}

          <View style={styles.modal_actions}>
            <PrimaryButton
              is_loading={is_signing_in}
              label={is_signing_in ? 'Checking token...' : 'Sign in with token'}
              on_press={on_submit}
              theme={theme}
            />
            <Pressable accessibilityRole="button" onPress={on_cancel} style={styles.modal_cancel_action}>
              <Text style={[styles.modal_cancel_text, { color: theme.colors.ink_soft }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe_area: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 36,
    justifyContent: 'space-between',
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  hero: {
    gap: 24,
    paddingTop: 8,
  },
  app_icon: {
    borderRadius: 18,
    height: 76,
    width: 76,
  },
  hero_copy: {
    gap: 14,
  },
  kicker: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    maxWidth: 360,
  },
  body: {
    fontSize: 18,
    lineHeight: 27,
    maxWidth: 340,
  },
  footer: {
    gap: 14,
    width: '100%',
  },
  error_message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  legal_text: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  legal_link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  primary_button: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  primary_button_icon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  primary_button_logo: {
    height: 26,
    width: 26,
  },
  primary_button_label: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  modal_root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modal_backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modal_card: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  modal_title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
  },
  modal_body: {
    fontSize: 16,
    lineHeight: 23,
  },
  modal_input_wrap: {
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modal_input: {
    fontSize: 16,
    height: 50,
    lineHeight: 22,
    paddingVertical: 0,
  },
  modal_error: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  modal_actions: {
    gap: 10,
  },
  modal_cancel_action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  modal_cancel_text: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default observer(WelcomeView);
