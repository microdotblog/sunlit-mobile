import * as Crypto from 'expo-crypto';

import * as Micropub from '../api/Micropub';
import Auth from './Auth';
import { create_composer_store } from './createComposerStore';
import Destinations from './Destinations';
import { prepare_media } from './mediaPreparation';
import { notify_session_expired } from './sessionEvents';

const Composer = create_composer_store({
  micropub: Micropub,
  destinations: Destinations,
  get_token: () => Auth.get_token(),
  prepare_media,
  make_id: () => Crypto.randomUUID(),
  on_auth_error: notify_session_expired,
});

export default Composer;
