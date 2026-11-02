import React from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { observer } from 'mobx-react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useHeaderHeight } from '@react-navigation/elements';

import { LoadingState, MessageState } from '../components/ListStates';
import OsmAttribution from '../components/OsmAttribution';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Destinations from '../stores/Destinations';
import { format_distance } from '../stores/models/places';
import PlaceSearch from '../stores/PlaceSearch';
import { MIN_SEARCH_LENGTH } from '../stores/createPlaceSearchStore';
import Places from '../stores/Places';
import { use_theme } from '../theme/theme';

const SEARCH_DELAY_MS = 350;
const SETTINGS_ERRORS = ['permission', 'approximate', 'services_off'];

function CheckInScreen({ navigation }) {
  const theme = use_theme();
  const header_height = useHeaderHeight();
  const [note, set_note] = React.useState('');
  const [selected_place, set_selected_place] = React.useState(null);
  const [did_check_in, set_did_check_in] = React.useState(false);
  const places = PlaceSearch.visible_places();
  const visible_selection = places.find(place => place.id === selected_place?.id) || null;

  usePreventRemove(Places.is_posting, () => {});

  React.useEffect(() => {
    if (did_check_in) {
      AppStore.show_toast('Checked in');
      navigation.goBack();
    }
  }, [did_check_in, navigation]);

  React.useEffect(() => {
    PlaceSearch.start();
    Destinations.load();

    const subscription = AppState.addEventListener('change', next_state => {
      if (next_state === 'active' && PlaceSearch.status === 'error') {
        PlaceSearch.start();
      }
    });

    return () => {
      subscription.remove();
      PlaceSearch.reset();
    };
  }, []);

  React.useEffect(() => {
    if (PlaceSearch.query.trim().length < MIN_SEARCH_LENGTH) {
      return;
    }

    const timeout_id = setTimeout(() => {
      PlaceSearch.search();
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timeout_id);
    };
  }, [PlaceSearch.query, PlaceSearch.origin]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <CheckInButton is_enabled={Boolean(visible_selection)} on_press={post} />,
    });
  });

  async function post() {
    try {
      await Places.check_in(visible_selection, note);
      set_did_check_in(true);
    } catch (error) {
      Alert.alert('Could not check in', error?.message || 'Please try again.');
    }
  }

  function render_list_status() {
    if (PlaceSearch.status === 'locating' || PlaceSearch.status === 'loading') {
      return <LoadingState />;
    }

    if (PlaceSearch.status === 'error' && SETTINGS_ERRORS.includes(PlaceSearch.error_code)) {
      return <MessageState action_title="Open settings" message={PlaceSearch.error_message} on_action={() => Linking.openSettings()} />;
    }

    if (PlaceSearch.status === 'error') {
      return <MessageState action_title="Try again" message={PlaceSearch.error_message} on_action={() => PlaceSearch.start()} />;
    }

    if (PlaceSearch.is_searching) {
      return <LoadingState />;
    }

    if (PlaceSearch.is_search_query()) {
      return <MessageState message="No places found. Try a different search." />;
    }

    return <MessageState message="No places found nearby. Try searching for one." />;
  }

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={header_height} style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <FlatList
        ListEmptyComponent={render_list_status()}
        ListHeaderComponent={
          <CheckInHeader navigation={navigation} note={note} on_change_note={set_note} />
        }
        contentContainerStyle={places.length === 0 ? styles.empty : null}
        data={places}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PlaceRow is_selected={visible_selection?.id === item.id} on_press={() => set_selected_place(item)} place={item} />
        )}
      />
      <OsmAttribution inset_bottom />
      {Places.is_posting ? (
        <View style={[styles.overlay, { backgroundColor: theme.colors.scrim }]}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const CheckInHeader = observer(function CheckInHeader({ navigation, note, on_change_note }) {
  const theme = use_theme();
  const destination = Destinations.selected_check_in_target();
  const delay = Places.delay();

  return (
    <View style={styles.header}>
      <TextInput
        multiline
        onChangeText={on_change_note}
        placeholder="Write a check-in for your blog…"
        placeholderTextColor={theme.colors.ink_soft}
        style={[styles.note, { backgroundColor: theme.colors.surface, color: theme.colors.ink }]}
        value={note}
      />
      <View style={styles.chips}>
        {destination ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Destinations', { purpose: 'check_ins' })}
            style={[styles.chip, { backgroundColor: theme.colors.surface }]}
          >
            <Text numberOfLines={1} style={[styles.chip_label, { color: theme.colors.ink }]}>
              Checking in to {destination.name}
            </Text>
            <Icon color={theme.colors.ink_soft} name="expand" size={18} />
          </Pressable>
        ) : null}
        {delay.seconds > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CheckInDelay')}
            style={[styles.chip, { backgroundColor: theme.colors.accent_soft }]}
          >
            <Icon color={theme.colors.accent} name="schedule" size={16} />
            <Text style={[styles.chip_label, { color: theme.colors.accent }]}>Posts in {delay.title}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.search, { backgroundColor: theme.colors.surface }]}>
        <Icon color={theme.colors.ink_soft} name="search" size={20} />
        <TextInput
          autoCorrect={false}
          onChangeText={query => PlaceSearch.set_query(query)}
          onSubmitEditing={() => PlaceSearch.search()}
          placeholder="Search nearby places"
          placeholderTextColor={theme.colors.ink_soft}
          returnKeyType="search"
          style={[styles.search_input, { color: theme.colors.ink }]}
          value={PlaceSearch.query}
        />
        {PlaceSearch.is_searching ? <ActivityIndicator color={theme.colors.accent} /> : null}
      </View>
    </View>
  );
});

function PlaceRow({ place, is_selected, on_press }) {
  const theme = use_theme();
  const details = [format_distance(place.distance), place.address].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: is_selected }}
      android_ripple={{ color: theme.colors.selection }}
      onPress={on_press}
      style={[styles.place, { backgroundColor: is_selected ? theme.colors.accent_soft : theme.colors.canvas, borderBottomColor: theme.colors.line }]}
    >
      <Icon color={is_selected ? theme.colors.accent : theme.colors.ink_soft} name="places" size={22} />
      <View style={styles.place_copy}>
        <Text numberOfLines={1} style={[styles.place_name, { color: theme.colors.ink }]}>
          {place.name}
        </Text>
        <Text numberOfLines={1} style={[styles.place_details, { color: theme.colors.ink_soft }]}>
          {details}
        </Text>
      </View>
      {is_selected ? <Icon color={theme.colors.accent} name="check" size={22} /> : null}
    </Pressable>
  );
}

const CheckInButton = observer(function CheckInButton({ is_enabled, on_press }) {
  const theme = use_theme();
  const can_press = is_enabled && !Places.is_posting;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !can_press }}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.25)' }}
      disabled={!can_press}
      onPress={on_press}
      style={[styles.post_button, { backgroundColor: theme.colors.accent, opacity: can_press ? 1 : 0.4 }]}
    >
      <Text style={[styles.post_label, { color: theme.colors.on_accent }]}>Check in</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  empty: {
    flexGrow: 1,
  },
  header: {
    gap: 10,
    padding: 12,
  },
  note: {
    borderRadius: 14,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 88,
    padding: 12,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chip_label: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  search: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  search_input: {
    flex: 1,
    fontSize: 16,
    height: 46,
  },
  place: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  place_copy: {
    flex: 1,
  },
  place_name: {
    fontSize: 16,
    fontWeight: '500',
  },
  place_details: {
    fontSize: 13,
  },
  post_button: {
    borderRadius: 18,
    marginRight: 8,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  post_label: {
    fontSize: 15,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default observer(CheckInScreen);
