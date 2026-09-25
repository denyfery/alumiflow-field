import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { MobileProfile, MobileSurvey } from '@/types/api';
import { deleteSurveyPhotoLocal, getSurveyPhoto, insertQueuedSurveyPhoto } from '@/database/repositories/survey-photos';
import { enqueueOperation, removeQueuedOperationsForResource } from '@/sync/queue';

const MAX_UPLOAD_BYTES = 550_000;
const PHOTO_ROOT = `${FileSystem.documentDirectory ?? ''}survey-photos/`;

const PRESETS = [
  { width: 1600, compress: 0.68 },
  { width: 1400, compress: 0.58 },
  { width: 1200, compress: 0.50 },
  { width: 1000, compress: 0.42 },
  { width: 900, compress: 0.34 },
] as const;

export async function captureSurveyPhotoLocal(
  profile: MobileProfile,
  survey: MobileSurvey,
): Promise<string | null> {
  if (survey.status !== 'in_progress') {
    throw new Error('Foto baru hanya dapat diambil saat survey berjalan.');
  }

  const permission = await ImagePicker.getCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Izin kamera diperlukan untuk mengambil foto survey.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const localUuid = Crypto.randomUUID();
  const directory = `${PHOTO_ROOT}${profile.company.id}/${survey.id}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const targetUri = `${directory}${localUuid}.jpg`;

  const optimizedUri = await optimizePhoto(asset.uri, asset.width ?? null);
  await FileSystem.copyAsync({ from: optimizedUri, to: targetUri });
  await FileSystem.deleteAsync(optimizedUri, { idempotent: true }).catch(() => undefined);

  await insertQueuedSurveyPhoto({
    localUuid,
    surveyId: survey.id,
    category: 'location',
    originalName: `survey-${survey.id}-${localUuid}.jpg`,
    localUri: targetUri,
    mime: 'image/jpeg',
  });

  await enqueueOperation(profile, {
    resourceType: 'survey_photo',
    resourceUuid: localUuid,
    action: 'survey.photo.upload',
    payload: {
      surveyId: survey.id,
      mobileUuid: localUuid,
    },
  });

  return localUuid;
}

async function optimizePhoto(sourceUri: string, originalWidth: number | null): Promise<string> {
  let lastUri: string | null = null;

  for (const preset of PRESETS) {
    const width = originalWidth && originalWidth < preset.width ? originalWidth : preset.width;
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width, height: null });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: preset.compress,
      format: SaveFormat.JPEG,
    });
    if (lastUri && lastUri !== saved.uri) {
      await FileSystem.deleteAsync(lastUri, { idempotent: true }).catch(() => undefined);
    }
    lastUri = saved.uri;

    const info = await FileSystem.getInfoAsync(saved.uri);
    if (info.exists && typeof info.size === 'number' && info.size <= MAX_UPLOAD_BYTES) {
      return saved.uri;
    }
  }

  if (lastUri) await FileSystem.deleteAsync(lastUri, { idempotent: true }).catch(() => undefined);
  throw new Error('Foto masih terlalu besar setelah optimasi. Coba ambil foto ulang dengan jarak lebih dekat.');
}

export async function deleteLocalPhotoFile(uri: string | null): Promise<void> {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}


export async function removeUnsyncedSurveyPhoto(localUuid: string): Promise<void> {
  const photo = await getSurveyPhoto(localUuid);
  if (!photo) return;
  if (photo.sync_status === 'uploaded') {
    throw new Error('Foto yang sudah tersinkron belum dapat dihapus dari Field RC2.');
  }

  await removeQueuedOperationsForResource('survey_photo', localUuid);
  await deleteLocalPhotoFile(photo.local_uri);
  await deleteSurveyPhotoLocal(localUuid);
}
