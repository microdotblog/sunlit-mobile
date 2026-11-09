import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { observer } from 'mobx-react';

import ContextMenu from '../platform/ContextMenu';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import Composer from '../stores/Composer';
import { use_theme } from '../theme/theme';
import { pick_media, take_photo } from './mediaPicker';

const ACTIONS = [
  { id: 'camera', title: 'Camera' },
  { id: 'library', title: 'Photo library' },
  { id: 'uploads', title: 'Micro.blog uploads' },
];

function ComposeButton({ navigation }) {
  const theme = use_theme();

  if (!Auth.is_signed_in()) {
    return null;
  }

  async function open_library() {
    try {
      start_composer(await pick_media());
    } catch (error) {
      AppStore.show_toast('Could not open your photos');
    }
  }

  async function open_camera() {
    try {
      start_composer(await take_photo());
    } catch (error) {
      if (error?.code === 'camera_permission') {
        AppStore.show_toast(error.message);
      } else {
        AppStore.show_toast('Could not open the camera');
      }
    }
  }

  function handle_action(action_id) {
    if (action_id === 'camera') {
      open_camera();
    } else if (action_id === 'uploads') {
      navigation.navigate('Uploads');
    } else {
      open_library();
    }
  }

  function start_composer(assets) {
    if (assets.length > 0) {
      Composer.start(assets);
      navigation.navigate('Composer');
    }
  }

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <ContextMenu actions={ACTIONS} on_action={handle_action}>
        {({ open_menu }) => (
          <Pressable
            accessibilityHint="Long press for more sources"
            accessibilityLabel="New post"
            accessibilityRole="button"
            android_ripple={{ borderless: false, color: 'rgba(255, 255, 255, 0.25)' }}
            onLongPress={open_menu}
            onPress={open_library}
            style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          >
            <Icon color={theme.colors.on_accent} name="compose" size={26} />
          </Pressable>
        )}
      </ContextMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 16,
    position: 'absolute',
    right: 16,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 18,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    width: 56,
  },
});

export default observer(ComposeButton);
