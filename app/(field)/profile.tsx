import { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfileRequest } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session-provider';
import { FieldActionButton, FieldHeader } from '@/components/field-ui';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme } from '@/ui/theme';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useSession();
  const { connectivity } = useSync();
  const { t } = useFieldI18n();
  const [name, setName] = useState(profile?.user.name ?? '');
  const [phone, setPhone] = useState(profile?.user.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.user.name);
    setPhone(profile.user.phone ?? '');
  }, [profile]);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return name.trim() !== profile.user.name || phone.trim() !== (profile.user.phone ?? '');
  }, [name, phone, profile]);

  if (!profile) return null;

  async function handleSave() {
    if (busy) return;
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError(t('Name is required.'));
      return;
    }

    if (connectivity !== 'online') {
      setError(t('Connect to the internet to edit profile.'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfileRequest({ name: cleanName, phone: cleanPhone || null });
      await refreshProfile();
      router.back();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.message) {
        setError(requestError.message);
      } else {
        setError(t('Failed to update profile.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FieldHeader title={t('Edit Profile')} subtitle={profile.company.display_name} onBack={() => router.back()} backLabel={t('Settings')} />

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('Name')}</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setName}
                placeholder={t('Name')}
                placeholderTextColor={fieldTheme.colors.textSoft}
                style={[styles.input, { borderColor: error && !name.trim() ? fieldTheme.colors.dangerBorder : fieldTheme.colors.border }]}
                value={name}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('Phone')}</Text>
              <TextInput
                editable={!busy}
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder={t('Phone number')}
                placeholderTextColor={fieldTheme.colors.textSoft}
                style={styles.input}
                textContentType="telephoneNumber"
                value={phone}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('Email')}</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyValue}>{profile.user.email}</Text>
              </View>
              <Text style={styles.hint}>{t('Email is used to sign in and can only be changed by an administrator.')}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <FieldActionButton
              disabled={busy || !dirty}
              label={busy ? t('Processing…') : t('Save Profile')}
              onPress={() => { handleSave().catch(() => undefined); }}
            />
          </View>

          <View pointerEvents="none" style={styles.illustrationWrap}>
            <Image source={require('../../assets/ui/field-landscape.png')} resizeMode="contain" style={styles.bottomIllustration} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { flexGrow: 1, padding: 20, gap: 16, paddingBottom: 18 },
  card: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 16 },
  fieldGroup: { gap: 7 },
  label: { color: fieldTheme.colors.text, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 50, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, backgroundColor: '#FBFCFE', color: fieldTheme.colors.text, fontSize: 15, paddingHorizontal: 14 },
  readOnlyInput: { minHeight: 50, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, backgroundColor: fieldTheme.colors.surfaceMuted, justifyContent: 'center', paddingHorizontal: 14 },
  readOnlyValue: { color: fieldTheme.colors.textMuted, fontSize: 15 },
  hint: { color: fieldTheme.colors.textSoft, fontSize: 12, lineHeight: 17 },
  error: { color: fieldTheme.colors.danger, fontSize: 13, lineHeight: 19 },
  illustrationWrap: { marginTop: 'auto', marginHorizontal: -20, paddingTop: 8, alignItems: 'center', overflow: 'hidden' },
  bottomIllustration: { width: '100%', height: 140, opacity: 0.9 },
});
