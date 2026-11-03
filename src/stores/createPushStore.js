import { flow, types } from 'mobx-state-tree';

export function create_push_store({ notifications, api, get_token } = {}) {
  return types
    .model('Push', {
      permission: types.optional(types.enumeration('PushPermission', ['undetermined', 'granted', 'denied']), 'undetermined'),
      device_token: types.maybeNull(types.string),
      registered_token: types.maybeNull(types.string),
    })
    .volatile(() => ({
      generation: 0,
      pending_token: null,
      pending_registration: null,
    }))
    .actions(self => ({
      enable: flow(function* ({ should_ask = false } = {}) {
        const generation = self.generation;

        try {
          yield notifications.prepare_channel();
          let permission = yield notifications.get_permission();

          if (permission === 'undetermined' && should_ask) {
            permission = yield notifications.request_permission();
          }

          if (generation !== self.generation) {
            return;
          }

          self.permission = normalize_permission(permission);

          if (self.permission === 'granted') {
            const device_token = yield notifications.get_device_token();
            yield self.register(device_token, generation);
          }
        } catch (error) {
          console.error('Could not turn on Sunlit notifications.', error);
        }
      }),

      register: flow(function* (device_token, generation = self.generation) {
        const token = get_token();

        if (!device_token || !token || generation !== self.generation) {
          return;
        }

        if (self.registered_token === device_token || self.pending_token === device_token) {
          return;
        }

        self.device_token = device_token;
        const registration = self.begin_registration(device_token, api.register({ token, device_token }));

        try {
          yield registration;

          if (generation === self.generation) {
            self.registered_token = device_token;
          }
        } finally {
          self.finish_registration(registration);
        }
      }),

      update_device_token: flow(function* (device_token) {
        if (self.permission !== 'granted') {
          return;
        }

        try {
          yield self.register(device_token);
        } catch (error) {
          console.error('Could not register the new Sunlit notification token.', error);
        }
      }),

      unregister: flow(function* () {
        const token = get_token();
        const pending_registration = self.pending_registration;
        const device_token = self.registered_token || self.pending_token;
        self.forget();

        if (!token || !device_token) {
          return;
        }

        try {
          if (pending_registration) {
            yield settle(pending_registration);
          }

          yield api.unregister({ token, device_token });
        } catch (error) {
          console.error('Could not unregister Sunlit notifications.', error);
        }
      }),

      discard_device_token: flow(function* () {
        self.forget();

        try {
          yield notifications.delete_device_token();
        } catch (error) {
          console.error('Could not reset the Sunlit notification token.', error);
        }
      }),

      begin_registration(device_token, registration) {
        self.pending_token = device_token;
        self.pending_registration = registration;
        return registration;
      },

      finish_registration(registration) {
        if (self.pending_registration === registration) {
          self.pending_token = null;
          self.pending_registration = null;
        }
      },

      forget() {
        self.generation += 1;
        self.device_token = null;
        self.registered_token = null;
        self.pending_token = null;
        self.pending_registration = null;
      },
    }))
    .create();
}

function normalize_permission(permission) {
  if (permission === 'granted' || permission === 'denied') {
    return permission;
  } else {
    return 'undetermined';
  }
}

async function settle(promise) {
  try {
    await promise;
  } catch (error) {
    return null;
  }
}
