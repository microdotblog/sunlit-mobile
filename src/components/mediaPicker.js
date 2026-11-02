import * as ImagePicker from 'expo-image-picker';

const SELECTION_LIMIT = 10;

export async function pick_media() {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images', 'videos'],
    orderedSelection: true,
    quality: 1,
    selectionLimit: SELECTION_LIMIT,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(asset => ({
    kind: asset.type === 'video' ? 'video' : 'image',
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mime: asset.mimeType || null,
  }));
}
