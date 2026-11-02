import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { open_in_browser } from '../navigation/links';
import ContextMenu from '../platform/ContextMenu';
import AppStore from '../stores/App';
import Places from '../stores/Places';
import { use_theme } from '../theme/theme';
import { is_scheduled } from '../stores/models/places';
import { format_relative_date, format_short_date } from './formatDate';
import MapThumbnail from './MapThumbnail';

export default function CheckInRow({ check_in }) {
  const theme = use_theme();
  const actions = build_actions(check_in);

  function handle_press() {
    if (check_in.post_url) {
      open_in_browser(check_in.post_url);
    } else {
      open_map(check_in);
    }
  }

  function handle_action(action_id) {
    if (action_id === 'open_post') {
      open_in_browser(check_in.post_url);
    } else if (action_id === 'open_map') {
      open_map(check_in);
    } else if (action_id === 'delete') {
      confirm_delete(check_in);
    }
  }

  return (
    <ContextMenu actions={actions} on_action={handle_action}>
      {({ open_menu }) => (
        <Pressable
          android_ripple={{ color: theme.colors.selection }}
          onLongPress={open_menu}
          onPress={handle_press}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <MapThumbnail latitude={check_in.latitude} longitude={check_in.longitude} />
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.ink }]}>
              {check_in.name}
            </Text>
            {check_in.note ? (
              <Text numberOfLines={2} style={[styles.note, { color: theme.colors.ink }]}>
                {check_in.note}
              </Text>
            ) : null}
            <Text style={[styles.date, { color: theme.colors.ink_soft }]}>{describe_date(check_in)}</Text>
          </View>
        </Pressable>
      )}
    </ContextMenu>
  );
}

function describe_date(check_in) {
  if (is_scheduled(check_in)) {
    return `Scheduled for ${format_short_date(check_in.published)}, ${format_time(check_in.published)}`;
  } else {
    return format_relative_date(check_in.published);
  }
}

function format_time(raw_date) {
  return new Date(raw_date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function build_actions(check_in) {
  const actions = [];

  if (check_in.post_url) {
    actions.push({ id: 'open_post', title: 'Open post' });
  }

  actions.push({ id: 'open_map', title: 'Open in maps' });

  if (check_in.post_url) {
    actions.push({ destructive: true, id: 'delete', title: 'Delete' });
  }

  return actions;
}

function open_map(check_in) {
  const label = encodeURIComponent(check_in.name);
  Linking.openURL(`geo:${check_in.latitude},${check_in.longitude}?q=${check_in.latitude},${check_in.longitude}(${label})`).catch(() => {
    open_in_browser(check_in.place_url);
  });
}

function confirm_delete(check_in) {
  Alert.alert('Delete this check-in?', 'It will be removed from your blog.', [
    { style: 'cancel', text: 'Cancel' },
    {
      onPress: async () => {
        try {
          await Places.delete_check_in(check_in.id);
          AppStore.show_toast('Check-in deleted');
        } catch (error) {
          AppStore.show_toast(error?.message || 'Could not delete the check-in');
        }
      },
      style: 'destructive',
      text: 'Delete',
    },
  ]);
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 15,
    lineHeight: 20,
  },
  date: {
    fontSize: 13,
  },
});
