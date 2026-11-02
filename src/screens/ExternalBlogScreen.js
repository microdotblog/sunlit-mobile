import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { observer } from 'mobx-react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import AppStore from '../stores/App';
import Destinations from '../stores/Destinations';
import ExternalBlogs from '../stores/ExternalBlogs';
import { use_theme } from '../theme/theme';

const CHECK_IN_NEEDS_MICROPUB =
  'Check-ins need a blog that supports Micropub. This blog only offers XML-RPC, so it can receive photo posts but not check-ins.';

function ExternalBlogScreen({ navigation, route }) {
  const theme = use_theme();
  const is_for_check_ins = route.params?.purpose === 'check_ins';
  const [address, set_address] = React.useState('');
  const [username, set_username] = React.useState('');
  const [password, set_password] = React.useState('');
  const needs_password = ExternalBlogs.needs_password();

  React.useEffect(() => {
    return () => {
      ExternalBlogs.cancel_discovery();
    };
  }, []);

  async function connect() {
    let blog_id = null;

    if (needs_password) {
      blog_id = await ExternalBlogs.connect_xmlrpc(username.trim(), password);
    } else {
      const result = await ExternalBlogs.discover(address);

      if (result?.kind === 'xmlrpc' && is_for_check_ins) {
        ExternalBlogs.cancel_discovery();
        ExternalBlogs.fail(new Error(CHECK_IN_NEEDS_MICROPUB));
      } else if (result?.kind === 'micropub') {
        blog_id = result.blog_id;
      }
    }

    if (blog_id) {
      await choose(blog_id);
    }
  }

  async function choose(blog_id) {
    const key = `external:${blog_id}`;

    if (is_for_check_ins) {
      await Destinations.select_for_check_ins(key);
    } else {
      await Destinations.select(key);
    }

    AppStore.show_toast(`Connected ${ExternalBlogs.get_blog(blog_id).name}`);
    navigation.goBack();
  }

  const can_continue = needs_password ? username.trim() && password : address.trim();

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.canvas }}
    >
      <Text style={[styles.intro, { color: theme.colors.ink_soft }]}>
        {is_for_check_ins
          ? 'Post check-ins to a blog that supports Micropub.'
          : 'Post to WordPress or any blog that supports Micropub.'}
      </Text>
      <Field
        autoCapitalize="none"
        editable={!needs_password}
        keyboardType="url"
        label="Blog address"
        on_change={set_address}
        placeholder="example.com"
        theme={theme}
        value={needs_password ? ExternalBlogs.pending_name() : address}
      />
      {needs_password ? (
        <>
          <Field autoCapitalize="none" label="Username" on_change={set_username} theme={theme} value={username} />
          <Field label="Password" on_change={set_password} secure theme={theme} value={password} />
          <Text style={[styles.note, { color: theme.colors.ink_soft }]}>
            WordPress: use an application password from your profile if you have one.
          </Text>
        </>
      ) : null}
      {ExternalBlogs.error_message ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>{ExternalBlogs.error_message}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(255, 255, 255, 0.25)' }}
        disabled={!can_continue || ExternalBlogs.is_working}
        onPress={connect}
        style={[styles.button, { backgroundColor: theme.colors.accent, opacity: can_continue ? 1 : 0.4 }]}
      >
        {ExternalBlogs.is_working ? (
          <ActivityIndicator color={theme.colors.on_accent} />
        ) : (
          <Text style={[styles.button_label, { color: theme.colors.on_accent }]}>{needs_password ? 'Connect' : 'Continue'}</Text>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

function Field({ label, value, on_change, theme, secure = false, editable = true, ...input_props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.ink_soft }]}>{label}</Text>
      <TextInput
        autoCorrect={false}
        editable={editable}
        onChangeText={on_change}
        placeholderTextColor={theme.colors.ink_soft}
        secureTextEntry={secure}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.ink }]}
        value={value}
        {...input_props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
  },
  intro: {
    fontSize: 15,
    lineHeight: 21,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    fontSize: 16,
    height: 48,
    paddingHorizontal: 14,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  button_label: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default observer(ExternalBlogScreen);
