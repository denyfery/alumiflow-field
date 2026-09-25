import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { FieldIcon, type FieldIconName } from '@/components/field-icon';
import { FieldHeader } from '@/components/field-ui';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { usePushNotifications } from '@/notifications/push-provider';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';

export default function SettingsScreen() {
  const { profile, logout, updateLocale } = useSession();
  const theme = useFieldTheme();
  const { t, locale } = useFieldI18n();
  const { registrationStatus, requestPermission } = usePushNotifications();
  const { connectivity } = useSync();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  if (!profile) return null;

  async function handleLogout() {
    setBusy(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : t('Logout failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleLocaleChange(nextLocale: 'id' | 'en') {
    if (nextLocale === locale || languageBusy) return;
    if (connectivity !== 'online') {
      setLanguageError(t('Connect to the internet to change language.'));
      return;
    }

    setLanguageBusy(true);
    setLanguageError(null);
    try {
      await updateLocale(nextLocale);
    } catch {
      setLanguageError(t('Failed to update language.'));
    } finally {
      setLanguageBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FieldHeader title={t('Profile & Settings')} subtitle={profile.company.display_name} onBack={() => router.back()} backLabel={t('Home')} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Edit Profile')}
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{initials(profile.user.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.user.name}</Text>
            <Text style={styles.email}>{profile.user.email}</Text>
            <Text style={[styles.role, { color: theme.colors.primary }]}>{roleLabel(profile.user.role, t)}</Text>
          </View>
          <FieldIcon name="chevron-right" size={17} color={fieldTheme.colors.textSoft} />
        </Pressable>

        <View style={styles.sectionWrap}>
          <Text style={styles.groupTitle}>{t('Preferences')}</Text>
          <View style={styles.listCard}>
            <View style={styles.settingRowTop}>
              <View style={[styles.rowIcon, { backgroundColor: theme.colors.primarySoft }]}><FieldIcon name="globe" size={18} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t('Language')}</Text>
                <Text style={styles.rowHint}>{locale === 'en' ? 'English' : 'Bahasa Indonesia'}</Text>
              </View>
            </View>
            <View style={styles.languageChoices}>
              <LanguageButton
                active={locale === 'id'}
                disabled={languageBusy}
                label="Bahasa Indonesia"
                onPress={() => { handleLocaleChange('id').catch(() => undefined); }}
              />
              <LanguageButton
                active={locale === 'en'}
                disabled={languageBusy}
                label="English"
                onPress={() => { handleLocaleChange('en').catch(() => undefined); }}
              />
            </View>
            {languageError ? <Text style={styles.preferenceError}>{languageError}</Text> : null}

            <View style={styles.divider} />
            <SettingRow
              icon="bell"
              label={t('Notifications')}
              value={pushStatusLabel(registrationStatus, t)}
            />
            {registrationStatus === 'permission_required' ? (
              <Pressable onPress={() => { requestPermission().catch(() => undefined); }} style={[styles.permissionButton, { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primarySoft }]}>
                <Text style={[styles.permissionButtonText, { color: theme.colors.primary }]}>{t('Enable notifications')}</Text>
              </Pressable>
            ) : null}
            {registrationStatus === 'permission_denied' ? (
              <Pressable onPress={() => { Linking.openSettings().catch(() => undefined); }} style={[styles.permissionButton, { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primarySoft }]}>
                <Text style={[styles.permissionButtonText, { color: theme.colors.primary }]}>{t('Open notification settings')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.groupTitle}>{t('Support')}</Text>
          <Pressable onPress={() => router.push('/diagnostics')} style={({ pressed }) => [styles.listCard, styles.supportRow, pressed && styles.pressed]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.colors.primarySoft }]}><FieldIcon name="info" size={18} color={theme.colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('Diagnostics')}</Text>
              <Text style={styles.rowHint}>{t('Connection, sync, app, and device information for support.')}</Text>
            </View>
            <FieldIcon name="chevron-right" size={17} color={fieldTheme.colors.textSoft} />
          </Pressable>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.groupTitle}>{t('Account')}</Text>
          {logoutError ? <Text style={styles.error}>{logoutError}</Text> : null}
          <Pressable disabled={busy} onPress={() => { handleLogout().catch(() => undefined); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
            <FieldIcon name="logout" size={18} color={fieldTheme.colors.danger} />
            <Text style={styles.logoutText}>{busy ? t('Processing…') : t('Logout')}</Text>
            <FieldIcon name="chevron-right" size={17} color={fieldTheme.colors.danger} />
          </Pressable>
          <Text style={styles.logoutHint}>{t('Pending field changes must sync before logout so no work is lost.')}</Text>
        </View>

        <View pointerEvents="none" style={styles.illustrationWrap}>
          <Image source={require('../../assets/ui/field-landscape.png')} resizeMode="contain" style={styles.bottomIllustration} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguageButton({ active, disabled, label, onPress }: { active: boolean; disabled: boolean; label: string; onPress: () => void }) {
  const theme = useFieldTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageButton,
        active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.languageButtonText, active && { color: theme.colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function SettingRow({ icon, label, value }: { icon: FieldIconName; label: string; value: string }) {
  const theme = useFieldTheme();
  return (
    <View style={styles.settingRow}>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.primarySoft }]}><FieldIcon name={icon} size={18} color={theme.colors.primary} /></View>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AF';
}

function roleLabel(role: string, t: (key: string) => string): string {
  if (role === 'surveyor') return t('Surveyor');
  if (role === 'installer') return t('Installer');
  return role;
}

function pushStatusLabel(status: string, t: (key: string) => string): string {
  if (status === 'registered') return t('Active');
  if (status === 'permission_required') return t('Not enabled');
  if (status === 'permission_denied') return t('Permission denied');
  if (status === 'project_not_configured') return t('Not configured');
  if (status === 'unavailable') return t('Unavailable');
  return t('Preparing…');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { flexGrow: 1, padding: 20, gap: 16, paddingBottom: 18 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 15, shadowColor: '#0F172A', shadowOpacity: 0.03, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: fieldTheme.colors.primary, fontWeight: '900', fontSize: 16 },
  name: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 16 },
  email: { color: fieldTheme.colors.textMuted, marginTop: 2, fontSize: 13 },
  role: { color: fieldTheme.colors.primary, fontWeight: '700', marginTop: 3, fontSize: 12 },
  sectionWrap: { gap: 8 },
  groupTitle: { color: fieldTheme.colors.textSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.15, textTransform: 'uppercase', paddingHorizontal: 2 },
  listCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 14, gap: 11 },
  settingRowTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 14 },
  rowValue: { color: fieldTheme.colors.textMuted, textAlign: 'right', flexShrink: 1, fontSize: 13 },
  rowHint: { color: fieldTheme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  languageChoices: { flexDirection: 'row', gap: 8, marginLeft: 47 },
  languageButton: { flex: 1, minHeight: 38, borderRadius: fieldTheme.radius.sm, borderWidth: 1, borderColor: fieldTheme.colors.border, backgroundColor: '#FBFCFE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  languageButtonText: { color: fieldTheme.colors.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  preferenceError: { color: fieldTheme.colors.danger, fontSize: 12, lineHeight: 18, marginLeft: 47 },
  divider: { height: 1, backgroundColor: fieldTheme.colors.surfaceMuted, marginLeft: 47 },
  supportRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  permissionButton: { minHeight: 40, borderRadius: fieldTheme.radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginLeft: 47, paddingHorizontal: 12 },
  permissionButtonText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 12 },
  logoutButton: { minHeight: 52, borderRadius: fieldTheme.radius.md, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: fieldTheme.colors.dangerSoft, borderWidth: 1, borderColor: fieldTheme.colors.dangerBorder },
  logoutText: { color: fieldTheme.colors.danger, fontWeight: '800', flex: 1 },
  logoutHint: { color: fieldTheme.colors.textMuted, lineHeight: 18, fontSize: 12, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  error: { color: fieldTheme.colors.danger, lineHeight: 20 },
  illustrationWrap: { marginTop: 'auto', marginHorizontal: -20, paddingTop: 8, alignItems: 'center', overflow: 'hidden' },
  bottomIllustration: { width: '100%', height: 140, opacity: 0.9 },
});
