import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { observer } from 'mobx-react';

import { LoadingState, MessageState } from '../components/ListStates';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Destinations from '../stores/Destinations';
import { use_theme } from '../theme/theme';

function DestinationsScreen({ navigation }) {
  const theme = use_theme();
  const selected = Destinations.selected();

  React.useEffect(() => {
    Destinations.refresh();
  }, []);

  async function choose(uid) {
    try {
      await Destinations.select(uid);
    } catch (error) {
      AppStore.show_toast('Could not save your choice');
    }

    navigation.goBack();
  }

  if (!Destinations.did_load && Destinations.is_loading) {
    return <LoadingState />;
  }

  if (Destinations.error_message && Destinations.destinations.length === 0) {
    return <MessageState action_title="Try again" message={Destinations.error_message} on_action={() => Destinations.refresh()} />;
  }

  return (
    <FlatList
      data={Destinations.destinations.slice()}
      keyExtractor={item => item.uid}
      renderItem={({ item }) => {
        const is_selected = selected?.uid === item.uid;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: is_selected }}
            android_ripple={{ color: theme.colors.selection }}
            onPress={() => choose(item.uid)}
            style={[styles.row, { borderBottomColor: theme.colors.line }]}
          >
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.ink }]}>
              {item.name}
            </Text>
            {is_selected ? <Icon color={theme.colors.accent} name="check" size={22} /> : null}
          </Pressable>
        );
      }}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  name: {
    flex: 1,
    fontSize: 16,
  },
});

export default observer(DestinationsScreen);
