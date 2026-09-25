import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { FieldIcon, type FieldIconName } from '@/components/field-icon';
import { SectionHeading, SyncStatusCard } from '@/components/field-ui';
import { listInstallations } from '@/database/repositories/installations';
import { listSurveys } from '@/database/repositories/surveys';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';

export default function HomeScreen() {
  const { profile, offlineSession } = useSession();
  const theme = useFieldTheme();
  const { t, dateLocale } = useFieldI18n();
  const [surveySummary, setSurveySummary] = useState({ active: 0, today: 0 });
  const [installationSummary, setInstallationSummary] = useState({ active: 0, today: 0, nextTime: null as string | null });

  const refreshCounts = useCallback(async () => {
    if (!profile) return;
    const today = localDateKey();

    if (profile.workspaces.includes('surveys')) {
      const surveys = await listSurveys(profile);
      const active = surveys.filter((item) => item.status !== 'completed');
      setSurveySummary({
        active: active.length,
        today: active.filter((item) => item.status === 'in_progress' || item.survey_date.slice(0, 10) === today).length,
      });
    } else {
      setSurveySummary({ active: 0, today: 0 });
    }

    if (profile.workspaces.includes('installations')) {
      const installations = await listInstallations(profile);
      const active = installations.filter((item) => item.status !== 'completed');
      const todayItems = active.filter((item) => item.status === 'in_progress' || item.scheduled_date.slice(0, 10) === today);
      const next = [...todayItems].sort((a, b) => (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99'))[0];
      setInstallationSummary({
        active: active.length,
        today: todayItems.length,
        nextTime: next?.start_time ?? null,
      });
    } else {
      setInstallationSummary({ active: 0, today: 0, nextTime: null });
    }
  }, [profile]);

  useFocusEffect(useCallback(() => {
    refreshCounts().catch(() => undefined);
  }, [refreshCounts]));

  const greeting = useMemo(() => greetingKey(new Date().getHours()), []);
  const todayLabel = useMemo(() => new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()), [dateLocale]);

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: theme.colors.primary }]}>ALUMIFLOW FIELD</Text>
              <Text style={styles.greeting}>{t(greeting)}, {firstName(profile.user.name)}</Text>
              <Text style={styles.date}>{todayLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Settings')}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <FieldIcon name="settings" size={20} color={fieldTheme.colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {offlineSession ? (
          <View style={styles.offlineSessionCard}>
            <Text style={styles.offlineSessionTitle}>{t('Offline session active')}</Text>
            <Text style={styles.offlineSessionText}>{t('You can keep working with synced field data. Connect again before the offline session expires.')}</Text>
          </View>
        ) : null}

        <SectionHeading title={t('Today')} caption={profile.company.display_name} />

        <View style={styles.workspaceList}>
          {profile.workspaces.includes('surveys') ? (
            <WorkspaceCard
              icon="clipboard"
              title={t('My Surveys')}
              count={surveySummary.active}
              todayCount={surveySummary.today}
              todayLabel={surveySummary.today === 1 ? t('1 survey today') : t('{count} surveys today', { count: surveySummary.today })}
              activeLabel={t('active')}
              openLabel={t('Open details')}
              onPress={() => router.push('/surveys')}
            />
          ) : null}

          {profile.workspaces.includes('installations') ? (
            <WorkspaceCard
              icon="briefcase"
              title={t('My Installations')}
              count={installationSummary.active}
              todayCount={installationSummary.today}
              todayLabel={installationSummary.today === 0
                ? t('No installation today')
                : installationSummary.nextTime
                  ? t('Next at {time}', { time: installationSummary.nextTime })
                  : t('{count} installations today', { count: installationSummary.today })}
              activeLabel={t('active')}
              openLabel={t('Open details')}
              onPress={() => router.push('/installations')}
            />
          ) : null}

          {profile.workspaces.length === 0 ? (
            <View style={styles.noWorkspaceCard}>
              <Text style={styles.noWorkspaceTitle}>{t('No field work assigned')}</Text>
              <Text style={styles.noWorkspaceText}>{t('New assignments will appear here after they are scheduled by the office.')}</Text>
            </View>
          ) : null}
        </View>

        <SyncStatusCard compact onSynced={refreshCounts} />

        <Text style={styles.helper}>{t('Field data is saved locally first, so you can keep working when the connection is unstable.')}</Text>

        <View pointerEvents="none" style={styles.illustrationWrap}>
          <Image source={require('../../assets/ui/field-landscape.png')} resizeMode="contain" style={styles.bottomIllustration} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkspaceCard({
  icon,
  title,
  count,
  todayCount,
  todayLabel,
  activeLabel,
  openLabel,
  onPress,
}: {
  icon: FieldIconName;
  title: string;
  count: number;
  todayCount: number;
  todayLabel: string;
  activeLabel: string;
  openLabel: string;
  onPress: () => void;
}) {
  const theme = useFieldTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.workspaceCard, pressed && styles.workspacePressed]}>
      <View style={styles.workspaceTop}>
        <View style={[styles.workspaceIcon, { backgroundColor: theme.colors.primarySoft }]}>
          <FieldIcon name={icon} size={21} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.workspaceTitle}>{title}</Text>
          <Text style={[styles.workspaceMeta, todayCount > 0 && styles.workspaceMetaActive, todayCount > 0 && { color: theme.colors.primary }]}>{todayLabel}</Text>
        </View>
        <View style={[styles.workspaceCount, { backgroundColor: theme.colors.primarySoft }]}>
          <Text style={[styles.workspaceCountValue, { color: theme.colors.primary }]}>{count}</Text>
          <Text style={[styles.workspaceCountLabel, { color: theme.colors.primary }]}>{activeLabel}</Text>
        </View>
      </View>
      <View style={styles.openRow}>
        <Text style={[styles.openText, { color: theme.colors.primary }]}>{openLabel}</Text>
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

function greetingKey(hour: number): string {
  if (hour < 11) return 'Good morning';
  if (hour < 15) return 'Good afternoon';
  return 'Good evening';
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] || value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { flexGrow: 1, padding: 20, gap: 17, paddingBottom: 18 },
  hero: { position: 'relative', paddingTop: 5, paddingBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  brand: { color: fieldTheme.colors.primary, fontWeight: '900', fontSize: 11, lineHeight: 17, letterSpacing: 1.6, paddingLeft: 1 },
  greeting: { color: fieldTheme.colors.text, fontSize: 29, fontWeight: '900', marginTop: 7, letterSpacing: -0.7, lineHeight: 35 },
  date: { color: fieldTheme.colors.textMuted, fontSize: 14, marginTop: 5, textTransform: 'capitalize' },
  settingsButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pressed: { opacity: 0.72 },
  offlineSessionCard: { backgroundColor: fieldTheme.colors.warningSoft, borderWidth: 1, borderColor: fieldTheme.colors.warningBorder, borderRadius: fieldTheme.radius.md, padding: 14, gap: 4 },
  offlineSessionTitle: { color: fieldTheme.colors.warning, fontWeight: '800' },
  offlineSessionText: { color: fieldTheme.colors.warning, lineHeight: 19, fontSize: 13 },
  workspaceList: { gap: 12 },
  workspaceCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.xl, padding: 16, gap: 13, shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  workspacePressed: { opacity: 0.78 },
  workspaceTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workspaceIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { color: fieldTheme.colors.text, fontSize: 18, fontWeight: '800' },
  workspaceMeta: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 4 },
  workspaceMetaActive: { color: fieldTheme.colors.primary, fontWeight: '700' },
  workspaceCount: { minWidth: 55, minHeight: 56, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: fieldTheme.colors.primarySoft, borderRadius: fieldTheme.radius.md, alignItems: 'center', justifyContent: 'center' },
  workspaceCountValue: { color: fieldTheme.colors.primary, fontSize: 21, fontWeight: '900' },
  workspaceCountLabel: { color: fieldTheme.colors.primary, fontSize: 10, fontWeight: '700', marginTop: 1 },
  openRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: fieldTheme.colors.surfaceMuted, paddingTop: 11 },
  openText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  noWorkspaceCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 18, gap: 5 },
  noWorkspaceTitle: { color: fieldTheme.colors.text, fontWeight: '800' },
  noWorkspaceText: { color: fieldTheme.colors.textMuted, lineHeight: 20 },
  helper: { color: fieldTheme.colors.textSoft, textAlign: 'center', lineHeight: 18, fontSize: 12, paddingHorizontal: 14 },
  illustrationWrap: { marginTop: 'auto', marginHorizontal: -20, marginBottom: -18, height: 158, overflow: 'hidden' },
  bottomIllustration: { position: 'absolute', left: 0, right: 0, bottom: -2, width: '100%', height: 158, opacity: 0.78 },
});
