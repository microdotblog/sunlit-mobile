import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { observer } from 'mobx-react';

import Avatar from '../components/Avatar';
import Icon from '../platform/Icon';
import Auth from '../stores/Auth';
import { use_theme } from '../theme/theme';

export function ScrollToTopTitle({ title, on_press }) {
  const theme = use_theme();

  return (
    <Pressable accessibilityHint="Scrolls to the top" accessibilityRole="header" hitSlop={8} onPress={on_press}>
      <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

function AccountButtonView({ navigation }) {
  if (!Auth.is_signed_in() || !Auth.profile_username) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel="Your profile"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => navigation.navigate('Profile', { username: Auth.profile_username })}
      style={styles.account_button}
    >
      <Avatar size={32} uri={Auth.profile_photo || ''} />
    </Pressable>
  );
}

export const AccountButton = observer(AccountButtonView);

export function HeaderIconButton({ icon, label, on_press }) {
  const theme = use_theme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      android_ripple={{ borderless: true, color: theme.colors.selection, radius: 20 }}
      hitSlop={6}
      onPress={on_press}
      style={styles.header_button}
    >
      <Icon color={theme.colors.ink} name={icon} size={24} />
    </Pressable>
  );
}

export function use_scroll_to_top_title(navigation, title, list_ref) {
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ScrollToTopTitle
          on_press={() => list_ref.current?.scrollToOffset({ animated: true, offset: 0 })}
          title={title}
        />
      ),
    });
  }, [navigation, title, list_ref]);
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  account_button: {
    marginRight: 16,
  },
  header_button: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 4,
    width: 40,
  },
});
