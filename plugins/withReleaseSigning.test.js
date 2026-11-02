import { describe, expect, it } from 'bun:test';

import { apply_release_signing } from './withReleaseSigning';

const TEMPLATE = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
        }
    }`;

describe('apply_release_signing', () => {
  it('signs release builds with the keystore from the environment', () => {
    const contents = apply_release_signing(TEMPLATE);

    expect(contents).toContain('storeFile file(System.getenv("ANDROID_KEYSTORE_FILE") ?: "release.keystore")');
    expect(contents).toContain('release {\n            signingConfig signingConfigs.release');
    expect(contents.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
  });

  it('finishes a file that only got the signing config', () => {
    const half_done = apply_release_signing(TEMPLATE).replace(
      'signingConfig signingConfigs.release',
      'signingConfig signingConfigs.debug',
    );

    expect(apply_release_signing(half_done)).toContain('release {\n            signingConfig signingConfigs.release');
  });

  it('fails loudly when the template has changed', () => {
    expect(() => apply_release_signing('android { }')).toThrow('withReleaseSigning');
  });

  it('leaves an already signed file alone', () => {
    const contents = apply_release_signing(TEMPLATE);

    expect(apply_release_signing(contents)).toBe(contents);
  });
});
