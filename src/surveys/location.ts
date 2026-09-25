import * as Location from 'expo-location';

export type FieldLocationEvidence = {
  locationStatus: 'captured' | 'permission_denied' | 'unavailable' | 'timeout';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
};

const LOCATION_TIMEOUT_MS = 10_000;

export async function captureFieldLocation(): Promise<FieldLocationEvidence> {
  const capturedAt = new Date().toISOString();

  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return emptyEvidence('unavailable', capturedAt);

    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return emptyEvidence('permission_denied', capturedAt);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('location_timeout')), LOCATION_TIMEOUT_MS);
        }),
      ]);

      return {
        locationStatus: 'captured',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? null,
        capturedAt: new Date(location.timestamp).toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'location_timeout') {
        return emptyEvidence('timeout', capturedAt);
      }
      return emptyEvidence('unavailable', capturedAt);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return emptyEvidence('unavailable', capturedAt);
  }
}

function emptyEvidence(
  locationStatus: FieldLocationEvidence['locationStatus'],
  capturedAt: string,
): FieldLocationEvidence {
  return {
    locationStatus,
    latitude: null,
    longitude: null,
    accuracy: null,
    capturedAt,
  };
}
