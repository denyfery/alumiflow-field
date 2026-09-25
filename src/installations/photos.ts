import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteInstallationPhotoLocal,
  getInstallationPhoto,
  insertQueuedInstallationPhoto,
} from '@/database/repositories/installation-photos';
import { enqueueOperation, removeQueuedOperationsForResource } from '@/sync/queue';
import type { MobileInstallation, MobileProfile } from '@/types/api';

const MAX_UPLOAD_BYTES = 550 * 1024;
const PHOTO_ROOT = `${FileSystem.documentDirectory}alumiflow/installations/`;
const PRESETS = [
  { width: 1920, compress: 0.72 },
  { width: 1600, compress: 0.64 },
  { width: 1280, compress: 0.56 },
  { width: 1024, compress: 0.48 },
];

export async function captureInstallationPhotoLocal(
  profile: MobileProfile,
  installation: MobileInstallation,
  type: 'before' | 'after' | 'issue',
  issueMobileUuid: string | null = null,
): Promise<string | null> {
  if (!['in_progress', 'completed'].includes(installation.status)) {
    throw new Error('Photos can only be captured while the installation is in progress or completed.');
  }

  const permission = await ImagePicker.getCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission has not been granted.');

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const localUuid = Crypto.randomUUID();
  const directory = `${PHOTO_ROOT}${profile.company.id}/${installation.id}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const targetUri = `${directory}${localUuid}.jpg`;

  const optimizedUri = await optimizePhoto(asset.uri, asset.width ?? null);
  await FileSystem.copyAsync({ from: optimizedUri, to: targetUri });
  await FileSystem.deleteAsync(optimizedUri, { idempotent: true }).catch(() => undefined);

  await insertQueuedInstallationPhoto({
    localUuid,
    installationId: installation.id,
    type,
    originalName: `installation-${installation.id}-${type}-${localUuid}.jpg`,
    localUri: targetUri,
    mime: 'image/jpeg',
    issueMobileUuid,
  });
  await enqueueOperation(profile, {
    resourceType: 'installation_photo',
    resourceUuid: localUuid,
    action: 'installation.photo.upload',
    payload: { installationId: installation.id, mobileUuid: localUuid, issueMobileUuid },
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
    const saved = await rendered.saveAsync({ compress: preset.compress, format: SaveFormat.JPEG });
    if (lastUri && lastUri !== saved.uri) await FileSystem.deleteAsync(lastUri, { idempotent: true }).catch(() => undefined);
    lastUri = saved.uri;
    const info = await FileSystem.getInfoAsync(saved.uri);
    if (info.exists && typeof info.size === 'number' && info.size <= MAX_UPLOAD_BYTES) return saved.uri;
  }
  if (lastUri) await FileSystem.deleteAsync(lastUri, { idempotent: true }).catch(() => undefined);
  throw new Error('Photo is still too large after optimization. Try taking it again from a closer distance.');
}

export async function deleteInstallationLocalPhotoFile(uri: string | null): Promise<void> {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function removeUnsyncedInstallationPhoto(localUuid: string): Promise<void> {
  const photo = await getInstallationPhoto(localUuid);
  if (!photo) return;
  if (photo.sync_status === 'uploaded') throw new Error('Synced photos cannot be deleted from this Field release.');
  await removeQueuedOperationsForResource('installation_photo', localUuid);
  await deleteInstallationLocalPhotoFile(photo.local_uri);
  await deleteInstallationPhotoLocal(localUuid);
}
