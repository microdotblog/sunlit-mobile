import { describe, expect, it } from 'bun:test';

import { apply_optional_camera } from './withOptionalCamera';

function camera_features(android_manifest) {
  return android_manifest.manifest['uses-feature'].filter(feature => feature.$['android:name'] === 'android.hardware.camera');
}

describe('apply_optional_camera', () => {
  it('marks the camera as optional so devices without one can install Sunlit', () => {
    const android_manifest = apply_optional_camera({ manifest: { $: {} } });

    expect(camera_features(android_manifest)).toEqual([{ $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } }]);
  });

  it('replaces a required camera and keeps other features', () => {
    const android_manifest = apply_optional_camera({
      manifest: {
        $: {},
        'uses-feature': [
          { $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } },
          { $: { 'android:name': 'android.hardware.location.gps', 'android:required': 'false' } },
        ],
      },
    });

    expect(camera_features(android_manifest)).toEqual([{ $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } }]);
    expect(android_manifest.manifest['uses-feature']).toHaveLength(2);
  });
});
