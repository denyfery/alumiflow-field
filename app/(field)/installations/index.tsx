import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { EmptyState, FieldErrorCard, FieldHeader, LoadingCards, SectionHeading, StatusPill, SyncStatusCard } from '@/components/field-ui';
import { listInstallations } from '@/database/repositories/installations';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';
import type { MobileInstallation } from '@/types/api';

export default function InstallationListScreen() {
  const theme = useFieldTheme();
  const { profile } = useSession();
  const { t, formatDate, statusLabel } = useFieldI18n();
  const { error } = useSync();
  const [installations, setInstallations] = useState<MobileInstallation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setInstallations(await listInstallations(profile));
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => {
    load().catch(() => setLoading(false));
  }, [load]));

  if (!profile) return null;

  const todayKey = localDateKey();
  const active = installations.filter((item) => item.status !== 'completed');
  const today = active.filter((item) => item.status === 'in_progress' || item.scheduled_date.slice(0, 10) === todayKey);
  const todayIds = new Set(today.map((item) => item.id));
  const upcoming = active.filter((item) => !todayIds.has(item.id));
  const completed = installations.filter((item) => item.status === 'completed').slice(-8).reverse();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <FieldHeader
          eyebrow="INSTALLER"
          title={t('My Installations')}
          subtitle={profile.company.display_name}
          onBack={() => router.replace('/home')}
          backLabel={t('Home')}
        />

        <View style={styles.summaryLine}>
          <Text style={[styles.summaryStrong, { color: theme.colors.primary }]}>{active.length} {t('active')}</Text>
          <Text style={styles.summaryDot}>•</Text>
          <Text style={styles.summaryText}>{today.length === 1 ? t('1 installation today') : t('{count} installations today', { count: today.length })}</Text>
        </View>

        <SyncStatusCard compact onSynced={load} />
        <FieldErrorCard error={error} />

        {loading ? <LoadingCards count={3} /> : (
          <>
            <SectionHeading title={t('Today')} caption={t('Work that needs attention first.')} />
            {today.length === 0 ? (
              <EmptyState
                title={t('No installation scheduled for today')}
                message={t('Upcoming assignments remain available below and new work will appear after sync.')}
              />
            ) : today.map((installation) => (
              <InstallationCard key={installation.id} installation={installation} t={t} formatDate={formatDate} statusLabel={statusLabel} />
            ))}

            {upcoming.length > 0 ? (
              <>
                <SectionHeading title={t('Upcoming')} caption={t('Scheduled work after today.')} />
                {upcoming.map((installation) => (
                  <InstallationCard key={installation.id} installation={installation} t={t} formatDate={formatDate} statusLabel={statusLabel} />
                ))}
              </>
            ) : null}

            {active.length === 0 && completed.length === 0 ? (
              <EmptyState
                title={t('No installations assigned yet')}
                message={t('New installation assignments will appear here after they are scheduled by the office.')}
              />
            ) : null}

            {completed.length > 0 ? (
              <>
                <SectionHeading title={t('Recently Finished')} />
                <View style={styles.completedList}>
                  {completed.map((installation) => (
                    <Pressable
                      key={installation.id}
                      onPress={() => router.push({ pathname: '/installations/[id]', params: { id: String(installation.id) } })}
                      style={styles.completedRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.number}>{installation.job_number ?? `#${installation.id}`}</Text>
                        <Text style={styles.completedMeta}>{installation.customer?.name ?? '-'} · {formatDate(installation.scheduled_date)}</Text>
                      </View>
                      <StatusPill status="completed" label={statusLabel('completed')} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InstallationCard({
  installation,
  t,
  formatDate,
  statusLabel,
}: {
  installation: MobileInstallation;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: string | null | undefined) => string;
  statusLabel: (status: string) => string;
}) {
  const theme = useFieldTheme();
  const blocking = installation.issues?.filter((issue) => issue.status === 'open' && issue.blocks_completion).length ?? 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/installations/[id]', params: { id: String(installation.id) } })}
      style={({ pressed }) => [styles.card, blocking > 0 && styles.blockingCard, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{installation.job_number ?? `#${installation.id}`}</Text>
          <Text style={styles.customer}>{installation.customer?.name ?? t('Customer')}</Text>
        </View>
        <StatusPill status={installation.status} label={statusLabel(installation.status)} />
      </View>
      <Text style={[styles.schedule, { color: theme.colors.primary }]}>{formatDate(installation.scheduled_date)}{installation.start_time ? ` · ${installation.start_time}` : ''}</Text>
      <Text numberOfLines={2} style={styles.address}>{installation.customer?.address ?? t('No address')}</Text>
      {blocking > 0 ? <Text style={styles.blockingText}>⚠ {t('{count} blocking issues must be resolved', { count: blocking })}</Text> : null}
      <View style={styles.openRow}><Text style={[styles.openText, { color: theme.colors.primary }]}>{t('Open details')}</Text><Text style={[styles.openArrow, { color: theme.colors.primary }]}>→</Text></View>
    </Pressable>
  );
}

function localDateKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { padding: 20, gap: 14, paddingBottom: 44 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: -2 },
  summaryStrong: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  summaryDot: { color: fieldTheme.colors.textSoft },
  summaryText: { color: fieldTheme.colors.textMuted, fontSize: 13 },
  card: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 7 },
  blockingCard: { borderColor: fieldTheme.colors.dangerBorder },
  cardPressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  number: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 16 },
  customer: { color: fieldTheme.colors.text, fontSize: 15, marginTop: 3 },
  schedule: { color: fieldTheme.colors.primary, fontWeight: '700', fontSize: 13 },
  address: { color: fieldTheme.colors.textMuted, lineHeight: 19 },
  blockingText: { color: fieldTheme.colors.danger, fontWeight: '700', fontSize: 12, lineHeight: 18 },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, marginTop: 2, borderTopWidth: 1, borderTopColor: fieldTheme.colors.surfaceMuted },
  openText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  openArrow: { color: fieldTheme.colors.primary, fontWeight: '900' },
  completedList: { gap: 9 },
  completedRow: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  completedMeta: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 3 },
});
