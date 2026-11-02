import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { LoadingState, MessageState } from '../components/ListStates';
import ContextMenu from '../platform/ContextMenu';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Destinations from '../stores/Destinations';
import ExternalBlogs from '../stores/ExternalBlogs';
import { use_theme } from '../theme/theme';

const KIND_LABELS = {
  microblog: 'Micro.blog',
  micropub: 'Micropub',
  xmlrpc: 'WordPress / XML-RPC',
};

function DestinationsScreen({ navigation, route }) {
  const theme = use_theme();
  const is_for_check_ins = route.params?.purpose === 'check_ins';
  const selected = is_for_check_ins ? Destinations.selected_check_in_target() : Destinations.selected_target();
  const targets = is_for_check_ins ? Destinations.check_in_targets() : Destinations.targets();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: is_for_check_ins ? 'Check in to' : 'Post to' });
  }, [navigation, is_for_check_ins]);

  React.useEffect(() => {
    Destinations.refresh();
  }, []);

  async function choose(key) {
    try {
      if (is_for_check_ins) {
        await Destinations.select_for_check_ins(key);
      } else {
        await Destinations.select(key);
      }
    } catch (error) {
      AppStore.show_toast('Could not save your choice');
    }

    navigation.goBack();
  }

  function confirm_remove(target) {
    Alert.alert(`Remove ${target.name}?`, 'Sunlit will forget this blog and its sign in.', [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => remove(target), style: 'destructive', text: 'Remove' },
    ]);
  }

  async function remove(target) {
    try {
      await ExternalBlogs.remove_blog(target.blog_id);
    } catch (error) {
      AppStore.show_toast(`Could not remove ${target.name}`);
    }
  }

  if (!Destinations.did_load && Destinations.is_loading) {
    return <LoadingState />;
  }

  if (Destinations.error_message && targets.length === 0) {
    return <MessageState action_title="Try again" message={Destinations.error_message} on_action={() => Destinations.refresh()} />;
  }

  return (
    <FlatList
      ListFooterComponent={
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: theme.colors.selection }}
          onPress={() => navigation.navigate('ExternalBlog', { purpose: route.params?.purpose })}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <Icon color={theme.colors.accent} name="link" size={22} />
          <Text style={[styles.add_label, { color: theme.colors.accent }]}>Add external blog</Text>
        </Pressable>
      }
      data={targets}
      extraData={selected?.key}
      keyExtractor={item => item.key}
      renderItem={({ item }) => (
        <TargetRow
          is_selected={selected?.key === item.key}
          on_press={() => choose(item.key)}
          on_remove={() => confirm_remove(item)}
          target={item}
          theme={theme}
        />
      )}
      style={{ backgroundColor: theme.colors.canvas }}
    />
  );
}

function TargetRow({ target, is_selected, on_press, on_remove, theme }) {
  const actions = target.kind === 'microblog' ? [] : [{ destructive: true, id: 'remove', title: 'Remove' }];

  return (
    <ContextMenu actions={actions} on_action={on_remove}>
      {({ open_menu }) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: is_selected }}
          android_ripple={{ color: theme.colors.selection }}
          onLongPress={open_menu}
          onPress={on_press}
          style={[styles.row, { borderBottomColor: theme.colors.line }]}
        >
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.ink }]}>
              {target.name}
            </Text>
            <Text style={[styles.kind, { color: theme.colors.ink_soft }]}>{KIND_LABELS[target.kind]}</Text>
          </View>
          {is_selected ? <Icon color={theme.colors.accent} name="check" size={22} /> : null}
        </Pressable>
      )}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  kind: {
    fontSize: 13,
  },
  add_label: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default observer(DestinationsScreen);
