import Auth from './Auth';
import Composer from './Composer';
import { SESSION_EXPIRED_MESSAGE } from './createAuthStore';
import Destinations from './Destinations';
import PlaceSearch from './PlaceSearch';
import Places from './Places';
import Posts from './Posts';
import ReplyDrafts from './ReplyDrafts';
import Uploads from './Uploads';
import Users from './Users';
import { on_session_expired } from './sessionEvents';

let stop_listening = null;

const Session = {
  start() {
    if (stop_listening) {
      return;
    }

    stop_listening = on_session_expired(() => {
      Session.expire();
    });
  },

  stop() {
    if (stop_listening) {
      stop_listening();
      stop_listening = null;
    }
  },

  async expire() {
    if (!Auth.is_signed_in()) {
      return;
    }

    await Auth.clear_invalid_session(SESSION_EXPIRED_MESSAGE);
    reset_stores();
  },

  async sign_out() {
    await Auth.sign_out();
    reset_stores();
  },
};

function reset_stores() {
  Composer.reset();
  Destinations.reset();
  Places.reset();
  PlaceSearch.reset();
  Posts.reset();
  Users.reset();
  ReplyDrafts.reset();
  Uploads.reset();
}

export default Session;
