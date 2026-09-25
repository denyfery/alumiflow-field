import { router } from 'expo-router';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { FieldHeader, PrimaryButton, SyncStatusCard } from '@/components/field-ui';
import { env } from '@/config/env';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { useSync } from '@/sync/sync-provider';
import { appVersionLabel, diagnosticsText, maskDeviceId } from '@/support/diagnostics';
import { fieldTheme } from '@/ui/theme';

export default function DiagnosticsScreen() {
  const { profile, offlineSession } = useSession();
  const sync = useSync();
  const { t, formatDateTime, locale } = useFieldI18n();

  if (!profile) return null;

  const text = diagnosticsText({
    profile,
    connectivity: sync.connectivity,
    lastSyncAt: sync.lastSyncAt,
    pendingCount: sync.pendingCount,
    syncStatus: sync.status,
    syncError: sync.error,
    offlineSession,
    locale,
  });

  async function shareDiagnostics() {
    await Share.share({ message: text, title: 'AlumiFlow Field Diagnostics' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <FieldHeader title={t('Diagnostics')} subtitle={t('Support information without exposing your auth token.')} onBack={() => router.back()} backLabel={t('Settings')} />
        <SyncStatusCard compact />

        <InfoGroup title={t('Application')} rows={[
          [t('Version'), appVersionLabel()],
          [t('Environment'), env.appEnvironment],
          [t('Server'), displayServer(env.apiBaseUrl)],
          ['Appearance', profile.company.appearance?.source ?? 'default'],
          ['Primary color', profile.company.appearance?.primary_color ?? '-'],
        ]} />
        <InfoGroup title={t('Workspace')} rows={[
          [t('Company'), profile.company.display_name],
          [t('User'), profile.user.name],
          [t('Role'), profile.user.role],
          [t('Language'), locale.toUpperCase()],
          [t('Session mode'), offlineSession ? t('Offline cached') : t('Server verified')],
        ]} />
        <InfoGroup title={t('Synchronization')} rows={[
          [t('Connection'), sync.connectivity === 'offline' ? t('Offline') : t('Online')],
          [t('Status'), sync.status],
          [t('Last sync'), sync.lastSyncAt ? formatDateTime(sync.lastSyncAt) : t('Never')],
          [t('Pending changes'), String(sync.pendingCount)],
          [t('Last error'), sync.error ? t('Needs attention') : '-'],
        ]} />
        <InfoGroup title={t('Device')} rows={[
          [t('Device ID'), maskDeviceId(profile.device?.device_uuid)],
          [t('Platform'), profile.device?.platform ?? '-'],
        ]} />

        <PrimaryButton label={t('Share diagnostic info')} onPress={shareDiagnostics} />
        <Text style={styles.note}>{t('Diagnostic info does not include your password or authentication token.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function displayServer(value: string): string {
  return value.replace(/^https?:\/\//, '').replace(/\/api\/mobile\/v1\/?$/, '');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { padding: 20, gap: 16, paddingBottom: 44 },
  group: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 10 },
  groupTitle: { color: fieldTheme.colors.textSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: fieldTheme.colors.surfaceMuted, paddingTop: 9 },
  label: { color: fieldTheme.colors.textMuted, fontSize: 13 },
  value: { color: fieldTheme.colors.text, fontWeight: '700', fontSize: 13, textAlign: 'right', flex: 1 },
  note: { color: fieldTheme.colors.textSoft, textAlign: 'center', fontSize: 12, lineHeight: 18, paddingHorizontal: 12 },
});
