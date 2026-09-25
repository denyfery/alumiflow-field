import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';

export function ScreenState({ message }: { message: string }) {
  const theme = useFieldTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.mark, { backgroundColor: theme.colors.primary }]}><Text style={[styles.markText, { color: theme.colors.onPrimary }]}>A</Text></View>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: fieldTheme.colors.background },
  mark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.primary },
  markText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  text: { fontSize: 14, color: fieldTheme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
