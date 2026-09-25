import { installationSnapshotRequest } from '@/api/installations';
import { productSnapshotRequest } from '@/api/products';
import { surveySnapshotRequest } from '@/api/surveys';
import { syncBootstrapRequest, syncCheckpointRequest } from '@/api/sync';
import { replaceInstallationSnapshot } from '@/database/repositories/installations';
import { replaceProducts } from '@/database/repositories/products';
import { replaceSurveySnapshot } from '@/database/repositories/surveys';
import { getOrCreateDeviceUuid } from '@/device/identity';
import { getSyncState, setSyncState } from '@/database/repositories/sync-state';
import { processInstallationQueue } from '@/sync/installation-operations';
import { getPendingOperationCount } from '@/sync/queue';
import { processSurveyQueue } from '@/sync/survey-operations';
import type { MobileProfile } from '@/types/api';

export type FieldSyncResult = {
  serverTime: string;
  pendingCount: number;
  surveySyncEnabled: boolean;
  installationSyncEnabled: boolean;
  surveyCount: number;
  installationCount: number;
  productCount: number;
  profileChanged: boolean;
  notice: string | null;
};

export async function runFieldSync(profile: MobileProfile): Promise<FieldSyncResult> {
  const bootstrap = await syncBootstrapRequest();
  const deviceUuid = await getOrCreateDeviceUuid();
  const lastSyncedAt = await getSyncState('last_sync_at');

  await setSyncState('sync_protocol_version', String(bootstrap.protocol_version));
  await setSyncState('sync_capabilities', JSON.stringify(bootstrap.capabilities));

  const effectiveProfile: MobileProfile = { ...bootstrap.profile, device: profile.device };

  const profileChanged =
    bootstrap.profile.user.locale !== profile.user.locale ||
    bootstrap.profile.company.display_name !== profile.company.display_name ||
    bootstrap.profile.company.mobile_field_enabled !== profile.company.mobile_field_enabled ||
    JSON.stringify(bootstrap.profile.company.appearance ?? null) !== JSON.stringify(profile.company.appearance ?? null) ||
    JSON.stringify([...bootstrap.profile.workspaces].sort()) !== JSON.stringify([...profile.workspaces].sort()) ||
    JSON.stringify([...bootstrap.profile.permissions].sort()) !== JSON.stringify([...profile.permissions].sort());

  let surveyCount = 0;
  let installationCount = 0;
  let productCount = 0;
  const notices: string[] = [];

  if (bootstrap.capabilities.survey_sync && effectiveProfile.workspaces.includes('surveys')) {
    const surveyQueueResult = await processSurveyQueue(effectiveProfile);
    if (surveyQueueResult.notice) notices.push(surveyQueueResult.notice);
    const [surveySnapshot, productSnapshot] = await Promise.all([
      surveySnapshotRequest(),
      productSnapshotRequest(),
    ]);
    await replaceSurveySnapshot(effectiveProfile, surveySnapshot.surveys);
    await replaceProducts(effectiveProfile, productSnapshot.products);
    surveyCount = surveySnapshot.surveys.length;
    productCount = productSnapshot.products.length;
  }

  if (bootstrap.capabilities.installation_sync && effectiveProfile.workspaces.includes('installations')) {
    const installationQueueResult = await processInstallationQueue(effectiveProfile);
    if (installationQueueResult.notice) notices.push(installationQueueResult.notice);
    const installationSnapshot = await installationSnapshotRequest();
    await replaceInstallationSnapshot(effectiveProfile, installationSnapshot.installations);
    installationCount = installationSnapshot.installations.length;
  }

  const pendingCount = await getPendingOperationCount(effectiveProfile);
  const checkpoint = await syncCheckpointRequest({
    clientId: deviceUuid,
    lastSyncedAt,
    pendingOperationsCount: pendingCount,
  });

  await setSyncState('last_sync_at', checkpoint.server_time);

  return {
    serverTime: checkpoint.server_time,
    pendingCount,
    surveySyncEnabled: bootstrap.capabilities.survey_sync,
    installationSyncEnabled: bootstrap.capabilities.installation_sync,
    surveyCount,
    installationCount,
    productCount,
    profileChanged,
    notice: notices.length > 0 ? notices.join(' ') : null,
  };
}
