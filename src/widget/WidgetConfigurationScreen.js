import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { get_theme } from '../theme/theme';
import { build_widget, load_widget_config, save_widget_config } from './widgetData';
import { DISCOVER_CATEGORIES } from './widgetModel';

const FEEDS = [
  { id: 'timeline', title: 'Timeline', detail: 'Photos from people you follow' },
  { id: 'discover', title: 'Discover', detail: 'Photos picked by Micro.blog' },
];

export default function WidgetConfigurationScreen({ widgetInfo, renderWidget, setResult }) {
  const theme = get_theme(useColorScheme() === 'dark');
  const [config, set_config] = React.useState(null);

  React.useEffect(() => {
    load_widget_config(widgetInfo.widgetId).then(set_config);
  }, [widgetInfo.widgetId]);

  async function save() {
    try {
      await save_widget_config(widgetInfo.widgetId, config);
      renderWidget(await build_widget(widgetInfo));
      setResult('ok');
    } catch (error) {
      setResult('cancel');
    }
  }

  if (!config) {
    return <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: theme.colors.canvas }}>
      <Text style={[styles.title, { color: theme.colors.ink }]}>Sunlit widget</Text>
      <Text style={[styles.section, { color: theme.colors.accent }]}>Show</Text>
      {FEEDS.map(feed => (
        <Option
          detail={feed.detail}
          is_selected={config.feed === feed.id}
          key={feed.id}
          label={feed.title}
          on_press={() => set_config({ ...config, feed: feed.id })}
          theme={theme}
        />
      ))}
      {config.feed === 'discover' ? (
        <>
          <Text style={[styles.section, { color: theme.colors.accent }]}>Discover topic</Text>
          {DISCOVER_CATEGORIES.map(category => (
            <Option
              is_selected={config.category === category.id}
              key={category.id}
              label={category.title}
              on_press={() => set_config({ ...config, category: category.id })}
              theme={theme}
            />
          ))}
        </>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setResult('cancel')} style={styles.button}>
          <Text style={[styles.button_label, { color: theme.colors.ink_soft }]}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={save} style={[styles.button, { backgroundColor: theme.colors.accent }]}>
          <Text style={[styles.button_label, { color: theme.colors.on_accent }]}>Add widget</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Option({ label, detail, is_selected, on_press, theme }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: is_selected }}
      android_ripple={{ color: theme.colors.selection }}
      onPress={on_press}
      style={[styles.option, { borderBottomColor: theme.colors.line }]}
    >
      <View style={[styles.radio, { borderColor: is_selected ? theme.colors.accent : theme.colors.ink_soft }]}>
        <View style={[styles.radio_dot, { backgroundColor: is_selected ? theme.colors.accent : theme.colors.canvas }]} />
      </View>
      <View style={styles.option_copy}>
        <Text style={[styles.option_label, { color: theme.colors.ink }]}>{label}</Text>
        {detail ? <Text style={[styles.option_detail, { color: theme.colors.ink_soft }]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 4,
  },
  option: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radio_dot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  option_copy: {
    flex: 1,
  },
  option_label: {
    fontSize: 16,
  },
  option_detail: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 32,
  },
  button: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  button_label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
