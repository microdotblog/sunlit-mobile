import * as Crypto from 'expo-crypto';

import { create_composer_store } from './createComposerStore';
import { prepare_media } from './mediaPreparation';
import Publishing from './Publishing';
import { notify_session_expired } from './sessionEvents';

const Composer = create_composer_store({
  publishing: Publishing,
  prepare_media,
  make_id: () => Crypto.randomUUID(),
  on_auth_error: notify_session_expired,
});

export default Composer;
