const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

function with_backup_disabled(config) {
  return withAndroidManifest(config, manifest_config => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest_config.modResults);
    manifest_config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    application.$['tools:replace'] = merge_replace(application.$['tools:replace'], 'android:allowBackup');
    return manifest_config;
  });
}

function merge_replace(current, attribute) {
  const attributes = `${current || ''}`.split(',').map(value => value.trim()).filter(Boolean);

  if (!attributes.includes(attribute)) {
    attributes.push(attribute);
  }

  return attributes.join(',');
}

module.exports = with_backup_disabled;
