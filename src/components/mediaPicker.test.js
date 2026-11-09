import { describe, expect, it, mock } from 'bun:test';

mock.module('expo-image-picker', () => ({}));

const { CAMERA_PERMISSION_MESSAGE, create_media_picker } = await import('./mediaPicker');

const PHOTO = { type: 'image', uri: 'file:///photo.jpg', width: 4000, height: 3000, mimeType: 'image/jpeg' };

function build_image_picker(overrides = {}) {
  return {
    requestCameraPermissionsAsync: mock(async () => ({ granted: true })),
    launchCameraAsync: mock(async () => ({ canceled: false, assets: [PHOTO] })),
    launchImageLibraryAsync: mock(async () => ({ canceled: false, assets: [PHOTO] })),
    ...overrides,
  };
}

describe('take_photo', () => {
  it('returns the photo as composer media', async () => {
    const ImagePicker = build_image_picker();

    const assets = await create_media_picker(ImagePicker).take_photo();

    expect(assets).toEqual([{ kind: 'image', uri: 'file:///photo.jpg', width: 4000, height: 3000, mime: 'image/jpeg' }]);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1 });
  });

  it('returns nothing when the camera is cancelled', async () => {
    const ImagePicker = build_image_picker({ launchCameraAsync: mock(async () => ({ canceled: true, assets: null })) });

    expect(await create_media_picker(ImagePicker).take_photo()).toEqual([]);
  });

  it('asks for camera access in Settings when permission is denied', async () => {
    const ImagePicker = build_image_picker({ requestCameraPermissionsAsync: mock(async () => ({ granted: false })) });

    const error = await create_media_picker(ImagePicker).take_photo().catch(error => error);

    expect(error.code).toBe('camera_permission');
    expect(error.message).toBe(CAMERA_PERMISSION_MESSAGE);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
