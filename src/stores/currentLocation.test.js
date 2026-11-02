import { describe, expect, it, mock } from 'bun:test';

mock.module('expo-location', () => ({}));

const { create_location_reader } = await import('./currentLocation');

function build_location(overrides = {}) {
  return {
    Accuracy: { High: 4 },
    requestForegroundPermissionsAsync: mock(async () => ({ status: 'granted', android: { accuracy: 'fine' } })),
    getLastKnownPositionAsync: mock(async () => null),
    getCurrentPositionAsync: mock(async () => ({ coords: { latitude: 45.5231, longitude: -122.6765, accuracy: 12 } })),
    hasServicesEnabledAsync: mock(async () => true),
    ...overrides,
  };
}

describe('create_location_reader', () => {
  it('returns a precise fix', async () => {
    const Location = build_location();

    const coordinate = await create_location_reader(Location)();

    expect(coordinate).toEqual({ latitude: 45.5231, longitude: -122.6765 });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it('uses a recent fix when there is one', async () => {
    const Location = build_location({
      getLastKnownPositionAsync: mock(async () => ({ coords: { latitude: 1, longitude: 2, accuracy: 20 } })),
    });

    expect(await create_location_reader(Location)()).toEqual({ latitude: 1, longitude: 2 });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('explains a denied permission', async () => {
    const Location = build_location({ requestForegroundPermissionsAsync: mock(async () => ({ status: 'denied' })) });

    await expect(create_location_reader(Location)()).rejects.toMatchObject({ code: 'permission' });
  });

  it('asks for precise location when Android only granted approximate', async () => {
    const Location = build_location({
      requestForegroundPermissionsAsync: mock(async () => ({ status: 'granted', android: { accuracy: 'coarse' } })),
    });

    await expect(create_location_reader(Location)()).rejects.toMatchObject({ code: 'approximate' });
  });

  it('rejects a fix too vague for nearby places', async () => {
    const Location = build_location({
      getCurrentPositionAsync: mock(async () => ({ coords: { latitude: 1, longitude: 2, accuracy: 2000 } })),
    });

    await expect(create_location_reader(Location)()).rejects.toMatchObject({ code: 'approximate' });
  });

  it('says when location services are off', async () => {
    const Location = build_location({
      getCurrentPositionAsync: mock(async () => {
        throw new Error('Location request failed due to unsatisfied device settings');
      }),
      hasServicesEnabledAsync: mock(async () => false),
    });

    await expect(create_location_reader(Location)()).rejects.toMatchObject({ code: 'services_off' });
  });

  it('gives up when no fix arrives in time', async () => {
    const Location = build_location({ getCurrentPositionAsync: mock(() => new Promise(() => {})) });

    await expect(create_location_reader(Location, { timeout_ms: 5 })()).rejects.toMatchObject({ code: 'unavailable' });
  });
});
