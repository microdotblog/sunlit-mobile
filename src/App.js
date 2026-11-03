import React from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { observer } from 'mobx-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import PushHandler from './components/PushHandler';
import ShareIntentHandler from './components/ShareIntentHandler';
import { linking } from './navigation/linking';
import RootNavigator from './navigation/RootNavigator';
import AppStore from './stores/App';
import { build_navigation_theme, use_theme } from './theme/theme';
import { update_widgets } from './widget/updateWidgets';

WebBrowser.maybeCompleteAuthSession();

const navigation_ref = createNavigationContainerRef();

function App() {
  const theme = use_theme();
  const [is_navigation_ready, set_is_navigation_ready] = React.useState(false);

  React.useEffect(() => {
    AppStore.start();

    const subscription = AppState.addEventListener('change', next_state => {
      if (next_state === 'background') {
        update_widgets();
      }
    });

    return () => {
      subscription.remove();
      AppStore.stop();
    };
  }, []);

  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <StatusBar style={theme.is_dark ? 'light' : 'dark'} />
            {AppStore.is_hydrating ? (
              <View style={[styles.loading, { backgroundColor: theme.colors.canvas }]}>
                <ActivityIndicator color={theme.colors.accent} size="large" />
              </View>
            ) : (
              <NavigationContainer
                linking={linking}
                onReady={() => set_is_navigation_ready(true)}
                ref={navigation_ref}
                theme={build_navigation_theme(theme)}
              >
                <RootNavigator />
              </NavigationContainer>
            )}
            <ShareIntentHandler is_navigation_ready={is_navigation_ready} navigation_ref={navigation_ref} />
            <PushHandler is_navigation_ready={is_navigation_ready} navigation_ref={navigation_ref} />
            <ToastOverlay />
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}

const ToastOverlay = observer(function ToastOverlay() {
  const theme = use_theme();
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'ios' || !AppStore.toast_message) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.toast_overlay, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.toast, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.toast_label, { color: theme.colors.ink }]}>{AppStore.toast_message}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  toast_overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  toast: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toast_label: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default observer(App);
