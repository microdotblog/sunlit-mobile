import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import { observer } from 'mobx-react';

import Avatar from '../components/Avatar';
import { open_in_browser } from '../navigation/links';
import Auth from '../stores/Auth';
import Destinations from '../stores/Destinations';
import Session from '../stores/Session';
import { use_theme } from '../theme/theme';

const CREDITS_URL = 'https://sunlit.io/';
const HELP_URL = 'https://help.micro.blog/';

function SettingsScreen({ navigation }) {
  const theme = use_theme();
  const version = `${Application.nativeApplicationVersion || ''} (${Application.nativeBuildVersion || ''})`;
  const destination = Destinations.selected();

  React.useEffect(() => {
    Destinations.load();
  }, []);

  function confirm_sign_out() {
    Alert.alert('Sign out of Micro.blog?', 'You can sign back in at any time.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: async () => {
          await Session.sign_out();
          navigation.popToTop();
        },
        style: 'destructive',
        text: 'Sign out',
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: theme.colors.canvas }}>
      <View style={[styles.account, { backgroundColor: theme.colors.surface }]}>
        <Avatar size={48} uri={Auth.profile_photo || ''} />
        <View style={styles.account_copy}>
          <Text style={[styles.account_name, { color: theme.colors.ink }]}>{Auth.profile_name || Auth.profile_username}</Text>
          <Text style={[styles.account_username, { color: theme.colors.ink_soft }]}>@{Auth.profile_username}</Text>
        </View>
      </View>
      <SectionLabel title="Publishing" />
      <SettingsRow
        label="Publish new posts to"
        on_press={Destinations.has_choice() ? () => navigation.navigate('Destinations') : undefined}
        value={destination ? destination.name : ''}
      />
      <SectionLabel title="About" />
      <SettingsRow label="Sunlit website" on_press={() => open_in_browser(CREDITS_URL)} />
      <SettingsRow label="Micro.blog help" on_press={() => open_in_browser(HELP_URL)} />
      <SettingsRow label="Version" value={version} />
      <SectionLabel title="Account" />
      <SettingsRow is_destructive label="Sign out of Micro.blog" on_press={confirm_sign_out} />
    </ScrollView>
  );
}

function SectionLabel({ title }) {
  const theme = use_theme();

  return <Text style={[styles.section_label, { color: theme.colors.accent }]}>{title}</Text>;
}

function SettingsRow({ label, value, on_press, is_destructive = false }) {
  const theme = use_theme();
  const label_color = is_destructive ? theme.colors.danger : theme.colors.ink;

  return (
    <Pressable
      accessibilityRole={on_press ? 'button' : 'text'}
      android_ripple={on_press ? { color: theme.colors.selection } : undefined}
      disabled={!on_press}
      onPress={on_press}
      style={styles.row}
    >
      <Text style={[styles.row_label, { color: label_color }]}>{label}</Text>
      {value ? <Text style={[styles.row_value, { color: theme.colors.ink_soft }]}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  account: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 14,
    margin: 16,
    padding: 16,
  },
  account_copy: {
    flex: 1,
  },
  account_name: {
    fontSize: 17,
    fontWeight: '600',
  },
  account_username: {
    fontSize: 14,
  },
  section_label: {
    fontSize: 14,
    fontWeight: '600',
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  row_label: {
    fontSize: 16,
  },
  row_value: {
    fontSize: 15,
  },
});

export default observer(SettingsScreen);
