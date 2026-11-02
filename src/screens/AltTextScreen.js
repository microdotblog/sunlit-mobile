import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import Composer from '../stores/Composer';
import { use_theme } from '../theme/theme';

const PREVIEW_SIZE = 220;

function AltTextScreen({ navigation, route }) {
  const theme = use_theme();
  const media = Composer.find_media(route.params?.media_id);
  const [alt, set_alt] = React.useState(media ? media.alt : '');

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={save} style={styles.save}>
          <Text style={[styles.save_label, { color: theme.colors.accent }]}>Save</Text>
        </Pressable>
      ),
    });
  });

  function save() {
    if (media) {
      Composer.set_alt(media.id, alt.trim());
    }

    navigation.goBack();
  }

  if (!media) {
    return <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]} />;
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.canvas }}
    >
      <Image contentFit="contain" source={{ uri: media.preview_uri() }} style={styles.preview} />
      <Text style={[styles.hint, { color: theme.colors.ink_soft }]}>
        Describe the photo for people who use screen readers.
      </Text>
      <TextInput
        autoFocus
        multiline
        onChangeText={set_alt}
        placeholder="Description"
        placeholderTextColor={theme.colors.ink_soft}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.ink }]}
        value={alt}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 16,
  },
  preview: {
    alignSelf: 'center',
    height: PREVIEW_SIZE,
    width: '100%',
  },
  hint: {
    fontSize: 14,
  },
  input: {
    borderRadius: 14,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
  },
  save: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  save_label: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default observer(AltTextScreen);
