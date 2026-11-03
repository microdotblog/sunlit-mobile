import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const NOTIFICATION_CHANNEL_ID = 'default';

const is_supported = Platform.OS === 'android';

export const push_notifications = {
  async prepare_channel() {
    if (is_supported) {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Mentions and replies',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  },

  async get_permission() {
    if (is_supported) {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } else {
      return 'denied';
    }
  },

  async request_permission() {
    if (is_supported) {
      const { status } = await Notifications.requestPermissionsAsync();
      return status;
    } else {
      return 'denied';
    }
  },

  async delete_device_token() {
    if (is_supported) {
      await Notifications.unregisterForNotificationsAsync();
    }
  },

  async get_device_token() {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return `${data || ''}`;
  },
};
