import * as ExpoImagePicker from 'expo-image-picker';

const SELECTION_LIMIT = 10;

export const CAMERA_PERMISSION_MESSAGE = 'Allow camera access for Sunlit in Settings to take a photo.';

export function create_media_picker(ImagePicker) {
  async function pick_media() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      orderedSelection: true,
      quality: 1,
      selectionLimit: SELECTION_LIMIT,
    });

    return to_assets(result);
  }

  async function take_photo() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      const error = new Error(CAMERA_PERMISSION_MESSAGE);
      error.code = 'camera_permission';
      throw error;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    return to_assets(result);
  }

  return { pick_media, take_photo };
}

export const { pick_media, take_photo } = create_media_picker(ExpoImagePicker);

function to_assets(result) {
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
