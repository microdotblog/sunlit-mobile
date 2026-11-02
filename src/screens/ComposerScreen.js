import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import ImageCropPicker from 'react-native-image-crop-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';

import { pick_media } from '../components/mediaPicker';
import { open_in_browser } from '../navigation/links';
import ContextMenu from '../platform/ContextMenu';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Composer from '../stores/Composer';
import Destinations from '../stores/Destinations';
import Posts from '../stores/Posts';
import { use_theme } from '../theme/theme';

const GRID_COLUMNS = 3;
const GRID_GAP = 6;

function ComposerScreen({ navigation }) {
  const theme = use_theme();
  const insets = useSafeAreaInsets();
  const has_content = Composer.has_content();
  const [posted_location, set_posted_location] = React.useState(null);

  React.useEffect(() => {
    Destinations.load();
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <PostButton on_post={post} />,
    });
  }, [navigation]);

  React.useEffect(() => {
    if (posted_location == null) {
      return;
    }

    navigation.goBack();
    Posts.refresh('timeline');
    show_posted_alert(posted_location);
  }, [navigation, posted_location]);

  usePreventRemove(has_content, ({ data }) => {
    Alert.alert('Discard this post?', 'Your photos and text will be lost.', [
      { style: 'cancel', text: 'Keep editing' },
      {
        onPress: () => {
          Composer.reset();
          navigation.dispatch(data.action);
        },
        style: 'destructive',
        text: 'Discard',
      },
    ]);
  });

  async function post() {
    const location = await Composer.post();

    if (location == null) {
      if (Composer.error_message) {
        Alert.alert('Could not post', Composer.error_message);
      }

      return;
    }

    set_posted_location(location);
  }

  async function add_section() {
    const assets = await pick_assets();

    if (assets.length > 0) {
      Composer.add_media(null, assets);
    }
  }

  const sections = Composer.sections.slice();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        {Composer.needs_title() ? (
          <TextInput
            onChangeText={title => Composer.set_title(title)}
            placeholder="Title"
            placeholderTextColor={theme.colors.ink_soft}
            style={[styles.title_input, { borderBottomColor: theme.colors.line, color: theme.colors.ink }]}
            value={Composer.title}
          />
        ) : null}
        {sections.map((section, index) => (
          <SectionCard key={section.id} navigation={navigation} section={section} show_placeholder={index === 0} />
        ))}
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: theme.colors.accent_soft }}
          onPress={add_section}
          style={[styles.add_section, { borderColor: theme.colors.line }]}
        >
          <Icon color={theme.colors.accent} name="add_photo" size={22} />
          <Text style={[styles.add_section_label, { color: theme.colors.accent }]}>
            {sections.length > 0 ? 'Add a new section' : 'Add photos'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
      <DestinationBar navigation={navigation} />
      {Composer.is_posting ? <PostingOverlay /> : null}
    </View>
  );
}

const SectionCard = observer(function SectionCard({ section, navigation, show_placeholder }) {
  const theme = use_theme();
  const media = section.media.slice();

  async function add_photos() {
    const assets = await pick_assets();

    if (assets.length > 0) {
      Composer.add_media(section.id, assets);
    }
  }

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <TextInput
        multiline
        onChangeText={text => Composer.set_text(section.id, text)}
        placeholder={show_placeholder ? 'Say something about these photos…' : 'Add some text…'}
        placeholderTextColor={theme.colors.ink_soft}
        style={[styles.section_input, { color: theme.colors.ink }]}
        value={section.text}
      />
      <Sortable.Grid
        columnGap={GRID_GAP}
        columns={GRID_COLUMNS}
        data={media}
        keyExtractor={item => item.id}
        onDragEnd={({ data }) => Composer.reorder_media(section.id, data.map(item => item.id))}
        renderItem={({ item }) => <MediaThumb media={item} navigation={navigation} />}
        rowGap={GRID_GAP}
      />
      <Pressable accessibilityRole="button" hitSlop={6} onPress={add_photos} style={styles.section_add}>
        <Icon color={theme.colors.accent} name="add_photo" size={20} />
        <Text style={[styles.section_add_label, { color: theme.colors.accent }]}>Add photos</Text>
      </Pressable>
    </View>
  );
});

const MediaThumb = observer(function MediaThumb({ media, navigation }) {
  const theme = use_theme();
  const can_crop = media.kind === 'image' && !media.uri.startsWith('http');
  const actions = build_media_actions(media, can_crop);

  function handle_action(action_id) {
    if (action_id === 'crop') {
      crop_media(media, theme);
    } else if (action_id === 'description') {
      navigation.navigate('AltText', { media_id: media.id });
    } else if (action_id === 'remove') {
      Composer.remove_media(media.id);
    }
  }

  return (
    <ContextMenu actions={actions} on_action={handle_action} open_on_long_press={false}>
      {({ open_menu }) => (
        <Pressable
          accessibilityHint="Opens photo options. Long press and drag to reorder."
          accessibilityLabel={media.alt || 'Photo'}
          accessibilityRole="button"
          onPress={open_menu}
          style={[styles.thumb, { backgroundColor: theme.colors.pane }]}
        >
          <Image cachePolicy="memory" contentFit="cover" source={{ uri: media.preview_uri() }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.thumb_badges}>
            {media.kind === 'video' ? <Badge label="VIDEO" /> : null}
            {media.alt ? <Badge label="ALT" /> : null}
          </View>
        </Pressable>
      )}
    </ContextMenu>
  );
});

function Badge({ label }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badge_label}>{label}</Text>
    </View>
  );
}

const PostButton = observer(function PostButton({ on_post }) {
  const theme = use_theme();
  const is_enabled = Composer.can_post() && !Composer.is_posting;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !is_enabled }}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.25)' }}
      disabled={!is_enabled}
      onPress={on_post}
      style={[styles.post_button, { backgroundColor: theme.colors.accent, opacity: is_enabled ? 1 : 0.4 }]}
    >
      <Text style={[styles.post_label, { color: theme.colors.on_accent }]}>Post</Text>
    </Pressable>
  );
});

const DestinationBar = observer(function DestinationBar({ navigation }) {
  const theme = use_theme();
  const insets = useSafeAreaInsets();
  const destination = Destinations.selected();
  const can_choose = Destinations.has_choice();

  if (!destination) {
    return null;
  }

  return (
    <View style={[styles.destination_bar, { backgroundColor: theme.colors.canvas, borderTopColor: theme.colors.line, paddingBottom: insets.bottom + 8 }]}>
      <Pressable
        accessibilityHint={can_choose ? 'Choose another blog' : undefined}
        accessibilityRole="button"
        disabled={!can_choose}
        onPress={() => navigation.navigate('Destinations')}
        style={[styles.destination_chip, { backgroundColor: theme.colors.surface }]}
      >
        <Text numberOfLines={1} style={[styles.destination_label, { color: theme.colors.ink }]}>
          Posting to {destination.name}
        </Text>
        {can_choose ? <Icon color={theme.colors.ink_soft} name="expand" size={20} /> : null}
      </Pressable>
    </View>
  );
});

const PostingOverlay = observer(function PostingOverlay() {
  const theme = use_theme();
  const status = resolve_posting_status();

  return (
    <View style={[styles.overlay, { backgroundColor: theme.colors.scrim }]}>
      <View style={[styles.overlay_card, { backgroundColor: theme.colors.canvas }]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text style={[styles.overlay_label, { color: theme.colors.ink }]}>{status}</Text>
        {Composer.is_publishing() ? null : (
          <Pressable accessibilityRole="button" onPress={() => Composer.cancel_posting()} style={styles.overlay_cancel}>
            <Text style={[styles.overlay_cancel_label, { color: theme.colors.accent }]}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function resolve_posting_status() {
  if (Composer.is_publishing()) {
    return 'Publishing…';
  } else {
    return `Uploading ${Composer.uploaded_count + 1} of ${Composer.upload_total}…`;
  }
}

function build_media_actions(media, can_crop) {
  const actions = [];

  if (can_crop) {
    actions.push({ id: 'crop', title: 'Crop' });
  }

  if (media.alt) {
    actions.push({ id: 'description', title: 'Edit description' });
  } else {
    actions.push({ id: 'description', title: 'Add description' });
  }

  actions.push({ destructive: true, id: 'remove', title: 'Remove' });
  return actions;
}

async function crop_media(media, theme) {
  try {
    const result = await ImageCropPicker.openCropper({
      cropperActiveWidgetColor: theme.colors.accent,
      cropperToolbarTitle: 'Crop photo',
      freeStyleCropEnabled: true,
      mediaType: 'photo',
      path: media.uri,
    });

    Composer.replace_media_file(media.id, {
      height: result.height,
      mime: result.mime,
      uri: result.path,
      width: result.width,
    });
  } catch (error) {
    if (error?.code !== 'E_PICKER_CANCELLED') {
      AppStore.show_toast('Could not crop this photo');
    }
  }
}

async function pick_assets() {
  try {
    return await pick_media();
  } catch (error) {
    AppStore.show_toast('Could not open your photos');
    return [];
  }
}

function show_posted_alert(location) {
  const buttons = [{ text: 'OK' }];

  if (location) {
    buttons.unshift({ onPress: () => open_in_browser(location), text: 'View post' });
  }

  Alert.alert('Posted!', undefined, buttons);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 12,
  },
  title_input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  section: {
    borderRadius: 16,
    gap: 10,
    padding: 12,
  },
  section_input: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  section_add: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  section_add_label: {
    fontSize: 15,
    fontWeight: '600',
  },
  thumb: {
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb_badges: {
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
    left: 6,
    position: 'absolute',
  },
  badge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badge_label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  add_section: {
    alignItems: 'center',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 16,
  },
  add_section_label: {
    fontSize: 15,
    fontWeight: '600',
  },
  post_button: {
    borderRadius: 18,
    marginRight: 8,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  post_label: {
    fontSize: 15,
    fontWeight: '700',
  },
  destination_bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  destination_chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  destination_label: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay_card: {
    alignItems: 'center',
    borderRadius: 20,
    gap: 14,
    minWidth: 220,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  overlay_label: {
    fontSize: 16,
    fontWeight: '600',
  },
  overlay_cancel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  overlay_cancel_label: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default observer(ComposerScreen);
