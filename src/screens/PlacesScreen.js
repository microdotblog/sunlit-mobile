import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { observer } from 'mobx-react';

import CheckInRow from '../components/CheckInRow';
import { LoadingState, MessageState } from '../components/ListStates';
import OsmAttribution from '../components/OsmAttribution';
import { use_scroll_to_top_title } from '../navigation/headers';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Places from '../stores/Places';
import { use_theme } from '../theme/theme';

function PlacesScreen({ navigation }) {
  const theme = use_theme();
  const list_ref = React.useRef(null);
  const check_ins = Places.check_ins;

  useScrollToTop(list_ref);
  use_scroll_to_top_title(navigation, 'Places', list_ref);

  const is_current = Places.is_current();

  React.useEffect(() => {
    if (!is_current) {
      Places.load();
    }
  }, [is_current]);

  async function refresh() {
    await Places.refresh();

    if (Places.error_message) {
      AppStore.show_toast(Places.error_message);
    }
  }

  function render_body() {
    if (!Places.did_load && Places.is_loading) {
      return <LoadingState />;
    }

    if (!Places.did_load && Places.error_message) {
      return <MessageState action_title="Try again" message={Places.error_message} on_action={() => Places.refresh()} title="Couldn't load check-ins" />;
    }

    return (
      <FlatList
        ListEmptyComponent={
          <MessageState
            action_title="Check in"
            message="Share where you are with a check-in post on your blog."
            on_action={() => navigation.navigate('CheckIn')}
            title="No check-ins yet"
          />
        }
        contentContainerStyle={check_ins.length === 0 ? styles.empty : styles.content}
        data={check_ins}
        keyExtractor={item => item.id}
        ref={list_ref}
        refreshControl={
          <RefreshControl
            colors={[theme.colors.accent]}
            onRefresh={refresh}
            progressBackgroundColor={theme.colors.canvas}
            refreshing={Places.did_load && Places.is_loading}
          />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={4}
        renderItem={({ item }) => <CheckInRow check_in={item} />}
        style={{ backgroundColor: theme.colors.canvas }}
        windowSize={3}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {render_body()}
      {check_ins.length > 0 ? <OsmAttribution /> : null}
      <Pressable
        accessibilityLabel="New check-in"
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(255, 255, 255, 0.25)' }}
        onPress={() => navigation.navigate('CheckIn')}
        style={[styles.fab, { backgroundColor: theme.colors.accent, bottom: check_ins.length > 0 ? 48 : 16 }]}
      >
        <Icon color={theme.colors.on_accent} name="add_location" size={26} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  empty: {
    flexGrow: 1,
  },
  content: {
    paddingBottom: 40,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 18,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
    width: 56,
  },
});

export default observer(PlacesScreen);
