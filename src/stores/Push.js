import { register_push_device, unregister_push_device } from '../api/MicroBlogPush';
import { push_notifications } from '../platform/pushNotifications';
import Auth from './Auth';
import { create_push_store } from './createPushStore';

const Push = create_push_store({
  notifications: push_notifications,
  api: { register: register_push_device, unregister: unregister_push_device },
  get_token: () => Auth.get_token(),
});

export default Push;
