const { withAndroidManifest } = require('expo/config-plugins');

const CAMERA_FEATURE = 'android.hardware.camera';

function with_optional_camera(config) {
  return withAndroidManifest(config, manifest_config => {
    apply_optional_camera(manifest_config.modResults);
    return manifest_config;
  });
}

function apply_optional_camera(android_manifest) {
  const features = android_manifest.manifest['uses-feature'] || [];
  const others = features.filter(feature => feature.$['android:name'] !== CAMERA_FEATURE);

  android_manifest.manifest['uses-feature'] = [
    ...others,
    { $: { 'android:name': CAMERA_FEATURE, 'android:required': 'false' } },
  ];

  return android_manifest;
}

module.exports = with_optional_camera;
module.exports.apply_optional_camera = apply_optional_camera;
