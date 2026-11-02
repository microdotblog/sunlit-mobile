import React from 'react';
import { useShareIntentContext } from 'expo-share-intent';
import { observer } from 'mobx-react';

import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import Composer from '../stores/Composer';
import { import_share } from '../stores/shareImport';

function ShareIntentHandler({ navigation_ref, is_navigation_ready }) {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const is_ready = is_navigation_ready && !AppStore.is_hydrating;
  const is_signed_in = Auth.is_signed_in();

  React.useEffect(() => {
    if (error) {
      AppStore.show_toast('Sunlit could not open what you shared.');
      resetShareIntent();
    }
  }, [error]);

  React.useEffect(() => {
    if (!hasShareIntent || !is_ready) {
      return;
    }

    if (!is_signed_in) {
      AppStore.show_toast('Sign in to post to your blog from Sunlit');
      resetShareIntent();
      return;
    }

    if (Composer.is_posting) {
      AppStore.show_toast('Sunlit is still posting. Share again when it’s done.');
      resetShareIntent();
      return;
    }

    let is_cancelled = false;

    async function open_share() {
      try {
        const { assets, text } = await import_share(shareIntent);

        if (is_cancelled) {
          return;
        }

        Composer.start(assets);

        if (text) {
          Composer.set_text(Composer.sections[0].id, text);
        }

        navigation_ref.navigate('Composer');
      } catch (error) {
        if (!is_cancelled) {
          AppStore.show_toast(error?.message || 'Could not open what you shared');
        }
      }

      if (!is_cancelled) {
        resetShareIntent();
      }
    }

    open_share();

    return () => {
      is_cancelled = true;
    };
  }, [hasShareIntent, shareIntent, is_ready, is_signed_in]);

  return null;
}

export default observer(ShareIntentHandler);
