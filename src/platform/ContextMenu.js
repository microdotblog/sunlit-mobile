import React from 'react';
import { Platform, View } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import PopupMenuAndroid from '@react-native/popup-menu-android';

import { use_theme } from '../theme/theme';

export default function ContextMenu({ actions = [], on_action, open_on_long_press = true, children }) {
  const theme = use_theme();
  const android_menu_ref = React.useRef(null);
  const menu_titles = React.useMemo(() => actions.map(action => action.title), [actions]);

  function open_android_menu() {
    android_menu_ref.current?.show();
  }

  function handle_android_selection(index) {
    const action = actions[index];

    if (action) {
      on_action(action.id);
    }
  }

  if (actions.length === 0) {
    return children({ open_menu: undefined });
  }

  if (Platform.OS === 'android') {
    return (
      <PopupMenuAndroid
        instanceRef={android_menu_ref}
        menuItems={menu_titles}
        onDismiss={() => {}}
        onSelectionChange={handle_android_selection}
      >
        <View collapsable={false}>{children({ open_menu: open_android_menu })}</View>
      </PopupMenuAndroid>
    );
  }

  const ios_actions = actions.map(action => ({
    id: action.id,
    title: action.title,
    attributes: action.destructive ? { destructive: true } : undefined,
  }));

  return (
    <MenuView
      actions={ios_actions}
      onPressAction={({ nativeEvent }) => on_action(nativeEvent.event)}
      shouldOpenOnLongPress={open_on_long_press}
      themeVariant={theme.is_dark ? 'dark' : 'light'}
    >
      {children({ open_menu: undefined })}
    </MenuView>
  );
}
