import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveServerAssetUrl } from '@/api/assets';
import { useSession } from '@/auth/session-provider';
import { FieldContactActions } from '@/components/field-contact-actions';
import { FieldIcon, type FieldIconName } from '@/components/field-icon';
import { FieldActionButton, FieldErrorCard, FieldHeader, LoadingCards, StatusPill, SyncStatusCard } from '@/components/field-ui';
import { getSurvey } from '@/database/repositories/surveys';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { ensureCameraPermission, ensureLocationPermission } from '@/permissions/field-permissions';
import { completeSurveyLocal, removeSurveyItemLocal, startSurveyLocal } from '@/surveys/actions';
import { captureSurveyPhotoLocal, removeUnsyncedSurveyPhoto } from '@/surveys/photos';
import { captureFieldLocation, type FieldLocationEvidence } from '@/surveys/location';
import { useSync } from '@/sync/sync-provider';
import type { MobileSurvey, MobileSurveyItem } from '@/types/api';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';

export default function SurveyDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const surveyId = Number(params.id);
  const { profile } = useSession();
  const theme = useFieldTheme();
  const { t, formatDate, formatDateTime, statusLabel, locationLabel, businessLabel } = useFieldI18n();
  const { connectivity, syncNow, error: syncError } = useSync();
  const [survey, setSurvey] = useState<MobileSurvey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completionEvidence, setCompletionEvidence] = useState<FieldLocationEvidence | null>(null);

  const load = useCallback(async () => {
    if (!profile || !Number.isFinite(surveyId)) return;
    setSurvey(await getSurvey(profile, surveyId));
  }, [profile, surveyId]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!profile || !survey) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loadingWrap}><LoadingCards count={2} /></View></SafeAreaView>;
  }

  const currentProfile = profile;
  const currentSurvey = survey;

  function formatMeasurements(item: MobileSurveyItem): string {
    const parts = Object.entries(item.measurements).map(([key, value]) => `${businessLabel(key)}: ${value}`);
    return parts.length ? parts.join(' · ') : t('No measurement attributes');
  }

  async function afterMutation() {
    await load();
    if (connectivity === 'online') {
      await syncNow();
      await load();
    }
  }

  async function startSurvey() {
    setBusy(true); setActionError(null);
    try {
      await ensureLocationPermission(t);
      const evidence = await captureFieldLocation();
      await startSurveyLocal(currentProfile, currentSurvey, evidence);
      await afterMutation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Failed to start survey.'));
    } finally { setBusy(false); }
  }

  function deleteItem(item: MobileSurveyItem) {
    Alert.alert(t('Delete item?'), item.product_name, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: async () => {
        setBusy(true); setActionError(null);
        try { await removeSurveyItemLocal(currentProfile, currentSurvey, item); await afterMutation(); }
        catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to delete item.')); }
        finally { setBusy(false); }
      } },
    ]);
  }

  async function capturePhoto() {
    setBusy(true); setActionError(null);
    try {
      if (!await ensureCameraPermission(t)) return;
      const captured = await captureSurveyPhotoLocal(currentProfile, currentSurvey);
      if (captured) await afterMutation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Failed to capture survey photo.'));
    } finally { setBusy(false); }
  }

  function removePhoto(localUuid: string) {
    Alert.alert(t('Delete photo?'), t('The unsynced photo will be removed from this device and its queue.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: async () => {
        setBusy(true); setActionError(null);
        try {
          await removeUnsyncedSurveyPhoto(localUuid);
          await load();
        } catch (error) {
          setActionError(error instanceof Error ? error.message : t('Failed to delete local photo.'));
        } finally { setBusy(false); }
      } },
    ]);
  }

  async function prepareCompletion() {
    setBusy(true); setActionError(null);
    try {
      await ensureLocationPermission(t);
      setCompletionEvidence(await captureFieldLocation());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Failed to prepare completion evidence.'));
    } finally { setBusy(false); }
  }

  async function confirmCompletion() {
    if (!completionEvidence) return;
    setBusy(true); setActionError(null);
    try {
      await completeSurveyLocal(currentProfile, currentSurvey.id, completionEvidence);
      setCompletionEvidence(null);
      await afterMutation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Failed to complete survey.'));
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <FieldHeader
          eyebrow="SURVEY"
          title={survey.survey_number}
          subtitle={survey.customer?.name ?? '-'}
          onBack={() => router.back()}
          backLabel={t('My Surveys')}
          right={<StatusPill status={survey.status} label={statusLabel(survey.status)} />}
        />
        <SyncStatusCard compact onSynced={load} />

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>{t('Location & Schedule')}</Text>
          <InfoLine icon="calendar" label={t('Date')} value={`${formatDate(survey.survey_date)}${survey.scheduled_time ? ` · ${survey.scheduled_time}` : ''}`} color={theme.colors.primary} />
          <View style={styles.infoDivider} />
          <InfoLine icon="map-pin" label={t('Address')} value={survey.address ?? survey.customer?.address ?? '-'} color={theme.colors.primary} />
          <View style={styles.inlineActions}>
            <FieldContactActions
              address={survey.address ?? survey.customer?.address}
              mapsUrl={survey.customer?.maps_url}
              t={t}
            />
          </View>
          {survey.customer?.phone ? (
            <>
              <View style={styles.infoDivider} />
              <InfoLine icon="phone" label={t('Phone')} value={survey.customer.phone} color={theme.colors.primary} />
              <View style={styles.inlineActions}>
                <FieldContactActions
                  phone={survey.customer.phone}
                  whatsapp={survey.customer.whatsapp === survey.customer.phone ? survey.customer.whatsapp : undefined}
                  t={t}
                />
              </View>
            </>
          ) : null}
          {survey.customer?.whatsapp && survey.customer.whatsapp !== survey.customer.phone ? (
            <>
              <View style={styles.infoDivider} />
              <InfoLine icon="message" label={t('WhatsApp')} value={survey.customer.whatsapp} color={theme.colors.primary} />
              <View style={styles.inlineActions}><FieldContactActions whatsapp={survey.customer.whatsapp} t={t} /></View>
            </>
          ) : null}
          {survey.notes ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.notesBlock}><Text style={styles.label}>{t('Notes')}</Text><Text style={styles.value}>{survey.notes}</Text></View>
            </>
          ) : null}
        </View>

        <FieldErrorCard error={actionError || syncError} onRetry={connectivity === 'online' ? async () => { await syncNow(); await load(); } : undefined} />

        {['scheduled', 'draft'].includes(survey.status) && (
          <FieldActionButton icon="arrow-right" disabled={busy} onPress={startSurvey} label={busy ? t('Processing…') : t('Start Survey')} />
        )}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>{t('Measurements')}</Text><Text style={styles.muted}>{survey.items.length} {t('item')}</Text></View>
          {survey.status === 'in_progress' && (
            <FieldActionButton
              compact
              fullWidth={false}
              variant="secondary"
              icon="clipboard"
              label={t('+ Item')}
              onPress={() => router.push({ pathname: '/survey-item', params: { surveyId: String(survey.id) } })}
            />
          )}
        </View>

        {survey.items.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>{survey.status === 'in_progress' ? t('No measurements yet. Add the product being measured.') : t('No measurement items yet.')}</Text></View>
        ) : survey.items.map((item) => (
          <View key={item.mobile_uuid ?? `server-${item.id}`} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.product_name}</Text><Text style={styles.muted}>Qty {item.quantity}{item.billing_unit ? ` · ${item.billing_unit}` : ''}</Text></View>
              {survey.status === 'in_progress' && item.mobile_uuid && (
                <View style={styles.itemActions}>
                  <FieldActionButton compact fullWidth={false} variant="secondary" icon="edit" label={t('Edit')} onPress={() => router.push({ pathname: '/survey-item', params: { surveyId: String(survey.id), itemUuid: item.mobile_uuid! } })} />
                  <FieldActionButton compact fullWidth={false} variant="danger" icon="trash" label={t('Delete')} onPress={() => deleteItem(item)} />
                </View>
              )}
            </View>
            <Text style={styles.measurements}>{formatMeasurements(item)}</Text>
            {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>{t('Survey Photos')}</Text><Text style={styles.muted}>{survey.photos.length} {survey.photos.length === 1 ? t('photo') : t('photos')} · local-first</Text></View>
          {survey.status === 'in_progress' && <FieldActionButton compact fullWidth={false} variant="secondary" icon="camera" disabled={busy} onPress={capturePhoto} label={t('Camera')} />}
        </View>

        {survey.photos.length === 0 ? (
          <View style={styles.card}><Text style={styles.muted}>{t('No site photos yet. Photos stay safely on the device until the server confirms upload.')}</Text></View>
        ) : (
          <View style={styles.photoGrid}>
            {survey.photos.map((photo) => {
              const uri = photo.local_uri ?? resolveServerAssetUrl(photo.url);
              const status = photo.sync_status ?? 'uploaded';
              return (
                <View key={photo.mobile_uuid ?? `photo-${photo.id}`} style={styles.photoCard}>
                  {uri ? <Image source={{ uri }} style={styles.photoImage} /> : <View style={styles.photoPlaceholder}><Text>{t('Photo')}</Text></View>}
                  <Text style={styles.photoStatus}>{status === 'uploaded' ? `✓ ${t('Synced')}` : status === 'uploading' ? t('Uploading…') : status === 'failed' ? t('Failed · retry on Sync') : t('Waiting for sync')}</Text>
                  {photo.last_error ? <Text style={styles.photoError}>{photo.last_error}</Text> : null}
                  {photo.mobile_uuid && status !== 'uploaded' ? (
                    <View style={styles.photoAction}>
                      <FieldActionButton compact fullWidth={false} variant="danger" disabled={busy || status === 'uploading'} onPress={() => removePhoto(photo.mobile_uuid!)} label={t('Delete local')} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {survey.field_events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('Field Evidence')}</Text>
            <Text style={styles.muted}>{t('Location is only captured at start/completion. There is no continuous tracking.')}</Text>
            {survey.field_events.map((event) => (
              <View key={event.mobile_uuid} style={styles.evidenceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evidenceTitle}>{event.event_type === 'survey_started' ? t('Survey started') : t('Survey completed')}</Text>
                  <Text style={styles.muted}>{formatDateTime(event.captured_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.evidenceStatus}>{locationLabel(event.location_status)}</Text>
                  {event.location_status === 'captured' && event.accuracy !== null ? <Text style={styles.muted}>±{Math.round(event.accuracy)} m</Text> : null}
                  {event.sync_status && event.sync_status !== 'uploaded' ? <Text style={styles.pendingText}>{event.sync_status === 'failed' ? t('Sync failed') : t('Pending sync')}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {survey.status === 'in_progress' && completionEvidence && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewEyebrow}>{t('Completion Evidence')}</Text>
            <Text style={styles.reviewTitle}>{t('Review before completion')}</Text>
            <Text style={styles.reviewLine}>{t('{count} measurement items', { count: survey.items.length })}</Text>
            <Text style={styles.reviewLine}>{t('{count} survey photos', { count: survey.photos.length })}</Text>
            <Text style={styles.reviewLine}>{t('Location')}: {locationLabel(completionEvidence.locationStatus)}{completionEvidence.locationStatus === 'captured' && completionEvidence.accuracy !== null ? ` · ±${Math.round(completionEvidence.accuracy)} m` : ''}</Text>
            <Text style={styles.reviewHint}>{t('GPS is not mandatory. If location is unavailable, that status is still recorded as evidence.')}</Text>
            <View style={styles.reviewActions}>
              <FieldActionButton variant="secondary" disabled={busy} onPress={() => setCompletionEvidence(null)} label={t('Back')} />
              <FieldActionButton icon="check" disabled={busy} onPress={confirmCompletion} label={busy ? t('Processing…') : t('Confirm Complete')} />
            </View>
          </View>
        )}

        {survey.status === 'in_progress' && !completionEvidence && (
          <FieldActionButton icon="check" disabled={busy || survey.items.length === 0} onPress={prepareCompletion} label={busy ? t('Capturing evidence…') : t('Complete Survey')} />
        )}

        {survey.status === 'completed' && <View style={styles.doneCard}><Text style={styles.doneTitle}>{t('Survey completed ✓')}</Text><Text style={styles.doneText}>{t('Completion evidence is stored local-first and kept consistent with the server through sync.')}</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({ icon, label, value, color }: { icon: FieldIconName; label: string; value: string; color: string }) {
  return (
    <View style={styles.infoLine}>
      <View style={[styles.infoIcon, { backgroundColor: `${color}12` }]}><FieldIcon name={icon} size={17} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  loadingWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  container: { padding: 20, gap: 14, paddingBottom: 44 },
  infoCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 10, shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  card: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 6 },
  cardTitle: { color: fieldTheme.colors.text, fontSize: 17, fontWeight: '800', marginBottom: 2 },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  infoIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoDivider: { height: 1, backgroundColor: fieldTheme.colors.surfaceMuted, marginLeft: 45 },
  inlineActions: { marginLeft: 45, marginTop: -4 },
  notesBlock: { marginLeft: 45, gap: 3 },
  label: { color: fieldTheme.colors.textSoft, fontSize: 11, fontWeight: '800', marginBottom: 3 },
  value: { color: '#334155', lineHeight: 21, fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  sectionTitle: { color: fieldTheme.colors.text, fontSize: 19, fontWeight: '800' },
  muted: { color: fieldTheme.colors.textMuted, lineHeight: 20 },
  itemCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 15, gap: 8, shadowColor: '#0F172A', shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  itemTop: { flexDirection: 'row', gap: 10 },
  itemTitle: { color: fieldTheme.colors.text, fontSize: 16, fontWeight: '800' },
  itemActions: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  measurements: { color: '#334155', lineHeight: 21 },
  notes: { color: fieldTheme.colors.textMuted, fontStyle: 'italic' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', borderRadius: fieldTheme.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: fieldTheme.colors.border, backgroundColor: fieldTheme.colors.surface },
  photoImage: { width: '100%', height: 130, backgroundColor: fieldTheme.colors.surfaceMuted },
  photoPlaceholder: { height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.surfaceMuted },
  photoStatus: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, fontSize: 12, fontWeight: '800', color: '#475569' },
  photoError: { paddingHorizontal: 10, paddingBottom: 8, fontSize: 11, color: fieldTheme.colors.danger },
  photoAction: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },
  doneCard: { borderRadius: fieldTheme.radius.lg, padding: 16, backgroundColor: fieldTheme.colors.successSoft, borderWidth: 1, borderColor: fieldTheme.colors.successBorder },
  doneTitle: { color: fieldTheme.colors.success, fontWeight: '800', fontSize: 17 },
  doneText: { color: fieldTheme.colors.success, marginTop: 4, lineHeight: 20 },
  evidenceRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: fieldTheme.colors.surfaceMuted },
  evidenceTitle: { color: fieldTheme.colors.text, fontWeight: '800' },
  evidenceStatus: { color: fieldTheme.colors.primary, fontSize: 12, fontWeight: '800' },
  pendingText: { color: fieldTheme.colors.warning, fontSize: 11, fontWeight: '700', marginTop: 2 },
  reviewCard: { borderRadius: fieldTheme.radius.lg, padding: 16, backgroundColor: fieldTheme.colors.infoSoft, borderWidth: 1, borderColor: fieldTheme.colors.infoBorder, gap: 7 },
  reviewEyebrow: { color: fieldTheme.colors.info, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  reviewTitle: { color: '#172554', fontSize: 18, fontWeight: '800' },
  reviewLine: { color: '#1E3A8A' },
  reviewHint: { color: fieldTheme.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  reviewActions: { gap: 8, marginTop: 10 },
});
