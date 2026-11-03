import React from 'react';
import * as Notifications from 'expo-notifications';
import { observer } from 'mobx-react';

import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import { notification_destination } from '../stores/models/pushNotification';
import Posts from '../stores/Posts';
import Push from '../stores/Push';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    if (Auth.is_signed_in()) {
      Posts.refresh('mentions');
    }

    return { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true };
  },
});

function PushHandler({ navigation_ref, is_navigation_ready }) {
  const last_response = Notifications.useLastNotificationResponse();
  const handled_id = React.useRef(null);
  const is_ready = is_navigation_ready && !AppStore.is_hydrating;
  const is_signed_in = Auth.is_signed_in();

  React.useEffect(() => {
    const subscription = Notifications.addPushTokenListener(({ data }) => {
      Push.update_device_token(`${data || ''}`);
    });

    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    if (is_ready && is_signed_in) {
      Push.enable();
    }
  }, [is_ready, is_signed_in]);

  React.useEffect(() => {
    if (is_ready && last_response) {
      open_response(last_response);
    }
  }, [last_response, is_ready, is_signed_in]);

  function open_response(response) {
    const notification_id = response.notification.request.identifier;
    const is_new_tap = response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && handled_id.current !== notification_id;

    if (!is_signed_in) {
      Notifications.clearLastNotificationResponse();
    } else if (is_new_tap) {
      handled_id.current = notification_id;
      const destination = notification_destination(response.notification);
      navigation_ref.navigate(destination.name, destination.params);
      Notifications.clearLastNotificationResponse();
    }
  }

  return null;
}

export default observer(PushHandler);
