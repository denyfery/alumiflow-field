import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { FieldIcon } from '@/components/field-icon';
import { EmptyState, FieldErrorCard, FieldHeader, LoadingCards, SectionHeading, StatusPill, SyncStatusCard } from '@/components/field-ui';
import { listSurveys } from '@/database/repositories/surveys';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';
import type { MobileSurvey } from '@/types/api';

export default function SurveyListScreen() {
  const theme = useFieldTheme();
  const { profile } = useSession();
  const { t, formatDate, statusLabel } = useFieldI18n();
  const { error } = useSync();
  const [surveys, setSurveys] = useState<MobileSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setSurveys(await listSurveys(profile));
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => {
    load().catch(() => setLoading(false));
  }, [load]));

  if (!profile) return null;

  const todayKey = localDateKey();
  const active = surveys.filter((survey) => survey.status !== 'completed');
  const today = active.filter((survey) => survey.status === 'in_progress' || survey.survey_date.slice(0, 10) === todayKey);
  const todayIds = new Set(today.map((survey) => survey.id));
  const upcoming = active.filter((survey) => !todayIds.has(survey.id));
  const completed = surveys.filter((survey) => survey.status === 'completed').slice(-8).reverse();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FieldHeader
          title={t('My Surveys')}
          subtitle={profile.company.display_name}
          onBack={() => router.replace('/home')}
          backLabel={t('Home')}
        />

        <View style={styles.summaryLine}>
          <Text style={[styles.summaryStrong, { color: theme.colors.primary }]}>{active.length} {t('active')}</Text>
          <Text style={styles.summaryDot}>•</Text>
          <Text style={styles.summaryText}>{today.length === 1 ? t('1 survey today') : t('{count} surveys today', { count: today.length })}</Text>
        </View>

        <SyncStatusCard compact onSynced={load} />
        <FieldErrorCard error={error} />

        {loading ? <LoadingCards count={3} /> : (
          <>
            <SectionHeading title={t('Today')} caption={t('Work that needs attention first.')} />
            {today.length === 0 ? (
              <EmptyState
                title={t('No survey scheduled for today')}
                message={t('Upcoming assignments remain available below and new work will appear after sync.')}
              />
            ) : today.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} t={t} formatDate={formatDate} statusLabel={statusLabel} featured />
            ))}

            {upcoming.length > 0 ? (
              <>
                <SectionHeading title={t('Upcoming')} caption={t('Scheduled work after today.')} />
                {upcoming.map((survey) => (
                  <SurveyCard key={survey.id} survey={survey} t={t} formatDate={formatDate} statusLabel={statusLabel} />
                ))}
              </>
            ) : null}

            {active.length === 0 && completed.length === 0 ? (
              <EmptyState
                title={t('No surveys assigned yet')}
                message={t('New survey assignments will appear here after they are scheduled by the office.')}
              />
            ) : null}

            {completed.length > 0 ? (
              <>
                <SectionHeading title={t('Recently Completed')} />
                <View style={styles.completedList}>
                  {completed.map((survey) => (
                    <Pressable
                      key={survey.id}
                      onPress={() => router.push({ pathname: '/surveys/[id]', params: { id: String(survey.id) } })}
                      style={({ pressed }) => [styles.completedRow, pressed && styles.cardPressed]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.number}>{survey.survey_number}</Text>
                        <Text style={styles.completedMeta}>{survey.customer?.name ?? '-'} · {formatDate(survey.survey_date)}</Text>
                      </View>
                      <StatusPill status="completed" label={statusLabel('completed')} />
                      <FieldIcon name="chevron-right" size={16} color={fieldTheme.colors.textSoft} />
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

function SurveyCard({
  survey,
  t,
  formatDate,
  statusLabel,
  featured = false,
}: {
  survey: MobileSurvey;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: string | null | undefined) => string;
  statusLabel: (status: string) => string;
  featured?: boolean;
}) {
  const theme = useFieldTheme();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/surveys/[id]', params: { id: String(survey.id) } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {featured ? <View style={[styles.cardAccent, { backgroundColor: theme.colors.primary }]} /> : null}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{survey.survey_number}</Text>
          <Text style={styles.customer}>{survey.customer?.name ?? t('Customer')}</Text>
        </View>
        <StatusPill status={survey.status} label={statusLabel(survey.status)} />
      </View>

      <View style={styles.infoRow}>
        <FieldIcon name="calendar" size={15} color={theme.colors.primary} />
        <Text style={[styles.schedule, { color: theme.colors.primary }]}>{formatDate(survey.survey_date)}{survey.scheduled_time ? ` · ${survey.scheduled_time}` : ''}</Text>
      </View>
      <View style={styles.infoRowTop}>
        <FieldIcon name="map-pin" size={15} color={fieldTheme.colors.textSoft} />
        <Text numberOfLines={2} style={styles.address}>{survey.address ?? survey.customer?.address ?? t('Address not set')}</Text>
      </View>

      <View style={styles.openRow}>
        <Text style={[styles.openText, { color: theme.colors.primary }]}>{t('Open details')}</Text>
        <FieldIcon name="chevron-right" size={17} color={theme.colors.primary} />
      </View>
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
  summaryLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: -1 },
  summaryStrong: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  summaryDot: { color: fieldTheme.colors.textSoft },
  summaryText: { color: fieldTheme.colors.textMuted, fontSize: 13 },
  card: { position: 'relative', overflow: 'hidden', backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 8, shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardAccent: { position: 'absolute', width: 4, left: 0, top: 0, bottom: 0 },
  cardPressed: { opacity: 0.76 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  number: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 16 },
  customer: { color: fieldTheme.colors.text, fontSize: 15, marginTop: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  schedule: { color: fieldTheme.colors.primary, fontWeight: '700', fontSize: 13 },
  address: { flex: 1, color: fieldTheme.colors.textMuted, lineHeight: 19 },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, marginTop: 1, borderTopWidth: 1, borderTopColor: fieldTheme.colors.surfaceMuted },
  openText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  completedList: { gap: 9 },
  completedRow: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center' },
  completedMeta: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 3 },
});
