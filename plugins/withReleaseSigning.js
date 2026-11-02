const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING_CONFIG = `
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE") ?: "release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`;
const DEBUG_SIGNING_CONFIG = /(signingConfigs \{\s*debug \{[\s\S]*?keyPassword 'android'\s*\})/;
const RELEASE_BUILD_TYPE = /(buildTypes \{[\s\S]*?release \{)([\s\S]*?)(signingConfig signingConfigs\.)(debug|release)/;

function with_release_signing(config) {
  return withAppBuildGradle(config, gradle_config => {
    gradle_config.modResults.contents = apply_release_signing(gradle_config.modResults.contents);
    return gradle_config;
  });
}

function apply_release_signing(contents) {
  return use_release_config(add_release_config(contents));
}

function add_release_config(contents) {
  if (contents.includes('ANDROID_KEYSTORE_FILE')) {
    return contents;
  }

  if (!DEBUG_SIGNING_CONFIG.test(contents)) {
    throw new Error('withReleaseSigning: could not find the debug signing config in app/build.gradle.');
  }

  return contents.replace(DEBUG_SIGNING_CONFIG, `$1${RELEASE_SIGNING_CONFIG}`);
}

function use_release_config(contents) {
  const match = contents.match(RELEASE_BUILD_TYPE);

  if (!match) {
    throw new Error('withReleaseSigning: could not find the release build type in app/build.gradle.');
  }

  const body = match[2].replace(/\s*\/\/ Caution![^\n]*\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\./, '');

  return contents.replace(RELEASE_BUILD_TYPE, `$1${body}$3release`);
}

module.exports = with_release_signing;
module.exports.apply_release_signing = apply_release_signing;
