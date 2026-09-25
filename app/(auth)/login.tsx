import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session-provider';
import { FieldIcon } from '@/components/field-icon';
import { appVersionLabel } from '@/support/diagnostics';
import { fieldTheme } from '@/ui/theme';

export default function LoginScreen() {
  const { login, error: sessionError } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/home');
    } catch (loginError) {
      setError(loginMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.brand}>ALUMIFLOW FIELD</Text>
            <Text style={styles.title}>Masuk ke Akun</Text>
            <Text style={styles.subtitle}>Masuk untuk melanjutkan pekerjaan lapangan Anda.</Text>
            <AuthLandscape />
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputShell}>
              <View style={styles.inputIcon}><FieldIcon name="mail" size={20} color={fieldTheme.colors.textMuted} /></View>
              <View style={styles.inputBody}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="nama@perusahaan.com"
                  placeholderTextColor={fieldTheme.colors.textSoft}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputShell}>
              <View style={styles.inputIcon}><FieldIcon name="lock" size={20} color={fieldTheme.colors.textMuted} /></View>
              <View style={styles.inputBody}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  secureTextEntry={!showPassword}
                  placeholder="Masukkan password Anda"
                  placeholderTextColor={fieldTheme.colors.textSoft}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => { submit().catch(() => undefined); }}
                  returnKeyType="go"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                hitSlop={10}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.eyeButton}
              >
                <FieldIcon name="eye" size={20} color={fieldTheme.colors.textMuted} />
              </Pressable>
            </View>

            {(error || sessionError) ? (
              <View style={styles.errorCard}>
                <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
                <Text style={styles.error}>{error || 'Sesi perangkat tidak dapat dipakai. Silakan masuk kembali.'}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => { submit().catch(() => undefined); }}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Masuk</Text>
                  <FieldIcon name="arrow-right" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <Text style={styles.helpText}>Butuh bantuan? Hubungi admin perusahaan Anda.</Text>
          </View>

          <View style={styles.assuranceCard}>
            <AssuranceRow icon="shield" title="Sinkronisasi aman" caption="Data lapangan dikirim melalui koneksi terenkripsi." />
            <AssuranceRow icon="cloud" title="Offline-first" caption="Tetap dapat bekerja dengan data yang sudah tersimpan." />
            <AssuranceRow icon="database" title="Data tetap tersimpan" caption="Perubahan akan disinkronkan kembali saat online." />
          </View>

          <Text style={styles.footer}>AlumiFlow Field · {appVersionLabel()}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AssuranceRow({ icon, title, caption }: { icon: 'shield' | 'cloud' | 'database'; title: string; caption: string }) {
  return (
    <View style={styles.assuranceRow}>
      <View style={styles.assuranceIcon}><FieldIcon name={icon} size={20} color={fieldTheme.colors.primary} /></View>
      <View style={styles.assuranceBody}>
        <Text style={styles.assuranceTitle}>{title}</Text>
        <Text style={styles.assuranceCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function AuthLandscape() {
  return (
    <View pointerEvents="none" style={styles.landscape}>
      <View style={styles.hillBack} />
      <View style={styles.hillFront} />
      <View style={[styles.building, styles.buildingBack]}>
        <View style={styles.windowRow}><View style={styles.window} /><View style={styles.window} /></View>
        <View style={styles.windowRow}><View style={styles.window} /><View style={styles.window} /></View>
      </View>
      <View style={[styles.building, styles.buildingFront]}>
        <View style={styles.windowRow}><View style={styles.window} /><View style={styles.window} /></View>
        <View style={styles.windowRow}><View style={styles.window} /><View style={styles.window} /></View>
        <View style={styles.windowRow}><View style={styles.window} /><View style={styles.window} /></View>
      </View>
      <View style={[styles.tree, styles.treeOne]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
      <View style={[styles.tree, styles.treeTwo]}><View style={styles.treeTop} /><View style={styles.treeTrunk} /></View>
    </View>
  );
}

function loginMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
    if (error.status === 401) return 'Email atau password tidak sesuai.';
    if ([402, 403].includes(error.status)) return 'Akses AlumiFlow Field untuk akun atau perusahaan ini sedang tidak aktif.';
  }
  if (error instanceof Error && /network|fetch|connection/i.test(error.message)) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
  }
  return 'Login belum berhasil. Coba lagi beberapa saat lagi.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26 },
  hero: { minHeight: 220, paddingHorizontal: 6, paddingTop: 18, overflow: 'hidden', borderRadius: fieldTheme.radius.xl },
  brand: { color: fieldTheme.colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1.7 },
  title: { color: fieldTheme.colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.9, marginTop: 20 },
  subtitle: { color: fieldTheme.colors.textMuted, fontSize: 16, lineHeight: 23, maxWidth: 310, marginTop: 5 },
  landscape: { position: 'absolute', left: -8, right: -8, bottom: -5, height: 118, overflow: 'hidden' },
  hillBack: { position: 'absolute', left: -50, right: 120, bottom: -50, height: 105, borderRadius: 120, backgroundColor: '#EAF7F4', transform: [{ rotate: '-4deg' }] },
  hillFront: { position: 'absolute', left: 70, right: -90, bottom: -62, height: 118, borderRadius: 140, backgroundColor: '#DDF3EE', transform: [{ rotate: '5deg' }] },
  building: { position: 'absolute', borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 7, gap: 6, opacity: 0.65 },
  buildingBack: { width: 72, height: 76, right: 86, bottom: 0, backgroundColor: '#D6E9EC' },
  buildingFront: { width: 78, height: 104, right: 16, bottom: -2, backgroundColor: '#C6E0E5' },
  windowRow: { flexDirection: 'row', gap: 7 },
  window: { width: 12, height: 10, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.75 },
  tree: { position: 'absolute', alignItems: 'center' },
  treeOne: { left: 28, bottom: 2 },
  treeTwo: { left: 92, bottom: -2, transform: [{ scale: 0.8 }] },
  treeTop: { width: 38, height: 38, borderRadius: 22, backgroundColor: '#BDE7DD' },
  treeTrunk: { width: 6, height: 28, marginTop: -5, borderRadius: 4, backgroundColor: '#A8D4CB' },
  formCard: { backgroundColor: fieldTheme.colors.surface, borderRadius: fieldTheme.radius.xl, padding: 16, gap: 12, shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  inputShell: { minHeight: 66, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, backgroundColor: '#FBFCFE', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  inputIcon: { width: 26, alignItems: 'center', justifyContent: 'center' },
  inputBody: { flex: 1, paddingVertical: 9 },
  inputLabel: { color: fieldTheme.colors.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  input: { color: fieldTheme.colors.text, fontSize: 15, padding: 0, minHeight: 24 },
  eyeButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorCard: { backgroundColor: fieldTheme.colors.dangerSoft, borderWidth: 1, borderColor: fieldTheme.colors.dangerBorder, borderRadius: fieldTheme.radius.md, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.danger },
  errorIconText: { color: '#FFFFFF', fontWeight: '900' },
  error: { color: fieldTheme.colors.danger, lineHeight: 19, fontSize: 13, flex: 1 },
  button: { minHeight: 54, borderRadius: fieldTheme.radius.md, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.primary, marginTop: 2 },
  buttonPressed: { opacity: 0.86 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  helpText: { color: fieldTheme.colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingTop: 2 },
  assuranceCard: { marginTop: 14, backgroundColor: fieldTheme.colors.surface, borderRadius: fieldTheme.radius.lg, padding: 15, gap: 12, borderWidth: 1, borderColor: fieldTheme.colors.border },
  assuranceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assuranceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.primarySoft },
  assuranceBody: { flex: 1 },
  assuranceTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 13 },
  assuranceCaption: { color: fieldTheme.colors.textMuted, marginTop: 2, fontSize: 12, lineHeight: 17 },
  footer: { color: fieldTheme.colors.textSoft, fontSize: 11, textAlign: 'center', marginTop: 18 },
});
