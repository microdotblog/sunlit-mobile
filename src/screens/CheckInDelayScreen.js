import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { observer } from 'mobx-react';

import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import { CHECK_IN_DELAYS } from '../stores/models/places';
import Places from '../stores/Places';
import { use_theme } from '../theme/theme';

function CheckInDelayScreen({ navigation }) {
  const theme = use_theme();

  async function choose(delay_id) {
    try {
      await Places.set_delay(delay_id);
    } catch (error) {
      AppStore.show_toast('Could not save the delay');
    }

    navigation.goBack();
  }

  return (
    <FlatList
      ListHeaderComponent={
        <Text style={[styles.hint, { color: theme.colors.ink_soft }]}>
          Delayed check-ins are scheduled on your blog, so they don't reveal where you are right now.
        </Text>
      }
      data={CHECK_IN_DELAYS}
      extraData={Places.delay_id}
      keyExtractor={item => item.id}
      renderItem={({ item }) => {
        const is_selected = Places.delay_id === item.id;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: is_selected }}
            android_ripple={{ color: theme.colors.selection }}
            onPress={() => choose(item.id)}
            style={[styles.row, { borderBottomColor: theme.colors.line }]}
          >
            <Text style={[styles.label, { color: theme.colors.ink }]}>{item.title}</Text>
            {is_selected ? <Icon color={theme.colors.accent} name="check" size={22} /> : null}
          </Pressable>
        );
      }}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 14,
    lineHeight: 20,
    padding: 16,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
  },
});

export default observer(CheckInDelayScreen);
