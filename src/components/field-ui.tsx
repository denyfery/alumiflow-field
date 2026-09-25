import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldIcon, type FieldIconName } from '@/components/field-icon';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme, type FieldStatusTone } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';
import { friendlyFieldError } from '@/ui/errors';

export function FieldHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  backLabel,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  const theme = useFieldTheme();

  return (
    <View style={styles.headerWrap}>
      {(onBack || right) && (
        <View style={styles.headerActions}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={8}>
              <Text style={[styles.backText, { color: theme.colors.primary }]}>← {backLabel ?? 'Back'}</Text>
            </Pressable>
          ) : <View />}
          {right}
        </View>
      )}
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeading({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function StatusPill({ label, status, tone }: { label: string; status?: string; tone?: FieldStatusTone }) {
  const theme = useFieldTheme();
  const resolvedTone = tone ?? toneForStatus(status ?? '');
  const activePill = resolvedTone === 'active' ? { backgroundColor: theme.colors.primarySoft } : null;
  const activeText = resolvedTone === 'active' ? { color: theme.colors.primary } : null;
  return (
    <View style={[styles.pill, pillTone[resolvedTone], activePill]}>
      <Text style={[styles.pillText, pillTextTone[resolvedTone], activeText]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useFieldTheme();

  return (
    <View style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primarySoft }]}><Text style={[styles.emptyIconText, { color: theme.colors.primary }]}>○</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={[styles.outlineButton, { borderColor: theme.colors.primary }]}>
          <Text style={[styles.outlineButtonText, { color: theme.colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingCards({ count = 2 }: { count?: number }) {
  return (
    <View style={{ gap: fieldTheme.spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, { width: '42%' }]} />
          <View style={[styles.skeletonLine, { width: '68%' }]} />
          <View style={[styles.skeletonLine, { width: '88%' }]} />
        </View>
      ))}
    </View>
  );
}

export function FieldErrorCard({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  const { t } = useFieldI18n();
  const message = friendlyFieldError(error, t);
  if (!message) return null;

  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{t('Needs attention')}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.errorAction}>
          <Text style={styles.errorActionText}>{t('Try sync')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SyncStatusCard({ compact = false, onSynced }: { compact?: boolean; onSynced?: () => void | Promise<void> }) {
  const theme = useFieldTheme();
  const { status, connectivity, lastSyncAt, pendingCount, error, syncNow } = useSync();
  const { t, formatDateTime } = useFieldI18n();

  const offline = connectivity === 'offline' || status === 'offline';
  const syncing = status === 'syncing';
  const hasError = status === 'error' || Boolean(error);

  const title = offline
    ? t('Offline')
    : syncing
      ? t('Syncing changes…')
      : hasError
        ? t('Sync needs attention')
        : pendingCount > 0
          ? t('{count} changes waiting to sync', { count: pendingCount })
          : t('All data synced');

  const message = offline
    ? t('Your data stays safe on this device and will sync when connection returns.')
    : syncing
      ? t('Sending field changes and refreshing assignments.')
      : hasError
        ? t('Some changes have not synced yet. Your local data is still safe.')
        : lastSyncAt
          ? t('Last synced {time}', { time: formatDateTime(lastSyncAt) })
          : t('Ready to sync your field data.');

  const tone: FieldStatusTone = offline
    ? 'warning'
    : syncing
      ? 'info'
      : hasError || pendingCount > 0
        ? 'warning'
        : 'success';

  async function handleSync() {
    await syncNow();
    await onSynced?.();
  }

  return (
    <View style={[styles.syncCard, compact && styles.syncCardCompact, syncCardTone[tone]]}>
      <View style={[styles.syncDot, syncDotTone[tone]]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.syncTitle}>{title}</Text>
        <Text style={[styles.syncMessage, compact && styles.syncMessageCompact]} numberOfLines={compact ? 1 : undefined}>{message}</Text>
      </View>
      {!syncing && connectivity !== 'offline' ? (
        <Pressable onPress={handleSync} hitSlop={8} style={styles.syncAction}>
          <Text style={[styles.syncActionText, { color: theme.colors.primary }]}>{t('Sync')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type FieldActionVariant = 'primary' | 'secondary' | 'danger';

export function FieldActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
  fullWidth = true,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: FieldActionVariant;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  icon?: FieldIconName;
}) {
  const theme = useFieldTheme();
  const dynamicButtonTone = variant === 'primary'
    ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
    : variant === 'secondary'
      ? { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primarySoft }
      : null;
  const dynamicTextTone = variant === 'primary'
    ? { color: theme.colors.onPrimary }
    : variant === 'secondary'
      ? { color: theme.colors.primary }
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        compact && styles.actionButtonCompact,
        fullWidth ? styles.actionButtonFullWidth : styles.actionButtonInline,
        actionButtonTone[variant],
        dynamicButtonTone,
        pressed && !disabled && styles.actionButtonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {icon ? (
        <FieldIcon
          name={icon}
          size={compact ? 15 : 18}
          color={variant === 'primary' ? theme.colors.onPrimary : variant === 'danger' ? fieldTheme.colors.danger : theme.colors.primary}
        />
      ) : null}
      <Text style={[styles.actionButtonText, compact && styles.actionButtonTextCompact, actionButtonTextTone[variant], dynamicTextTone]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <FieldActionButton label={label} onPress={onPress} disabled={disabled} />;
}

function toneForStatus(status: string): FieldStatusTone {
  if (status === 'in_progress') return 'active';
  if (status === 'completed' || status === 'resolved') return 'success';
  if (status === 'open') return 'warning';
  if (status === 'blocking' || status === 'failed') return 'danger';
  return 'neutral';
}

const pillTone = StyleSheet.create({
  neutral: { backgroundColor: fieldTheme.colors.surfaceMuted },
  active: { backgroundColor: fieldTheme.colors.primarySoft },
  success: { backgroundColor: fieldTheme.colors.successSoft },
  warning: { backgroundColor: fieldTheme.colors.warningSoft },
  danger: { backgroundColor: fieldTheme.colors.dangerSoft },
  info: { backgroundColor: fieldTheme.colors.infoSoft },
});

const pillTextTone = StyleSheet.create({
  neutral: { color: fieldTheme.colors.textMuted },
  active: { color: fieldTheme.colors.primary },
  success: { color: fieldTheme.colors.success },
  warning: { color: fieldTheme.colors.warning },
  danger: { color: fieldTheme.colors.danger },
  info: { color: fieldTheme.colors.info },
});


const actionButtonTone = StyleSheet.create({
  primary: { backgroundColor: fieldTheme.colors.primary, borderColor: fieldTheme.colors.primary },
  secondary: { backgroundColor: fieldTheme.colors.primarySoft, borderColor: fieldTheme.colors.primaryBorder },
  danger: { backgroundColor: fieldTheme.colors.dangerSoft, borderColor: fieldTheme.colors.dangerBorder },
});

const actionButtonTextTone = StyleSheet.create({
  primary: { color: '#FFFFFF' },
  secondary: { color: fieldTheme.colors.primary },
  danger: { color: fieldTheme.colors.danger },
});

const syncCardTone = StyleSheet.create({
  neutral: {},
  active: {},
  success: { borderColor: fieldTheme.colors.successBorder, backgroundColor: fieldTheme.colors.successSoft },
  warning: { borderColor: fieldTheme.colors.warningBorder, backgroundColor: fieldTheme.colors.warningSoft },
  danger: { borderColor: fieldTheme.colors.dangerBorder, backgroundColor: fieldTheme.colors.dangerSoft },
  info: { borderColor: fieldTheme.colors.infoBorder, backgroundColor: fieldTheme.colors.infoSoft },
});

const syncDotTone = StyleSheet.create({
  neutral: { backgroundColor: fieldTheme.colors.textSoft },
  active: { backgroundColor: fieldTheme.colors.primary },
  success: { backgroundColor: fieldTheme.colors.success },
  warning: { backgroundColor: fieldTheme.colors.warning },
  danger: { backgroundColor: fieldTheme.colors.danger },
  info: { backgroundColor: fieldTheme.colors.info },
});

const styles = StyleSheet.create({
  headerWrap: { gap: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30, marginBottom: 4 },
  backText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 14 },
  eyebrow: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1.35 },
  title: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 28, letterSpacing: -0.65 },
  subtitle: { color: fieldTheme.colors.textMuted, fontSize: 15, lineHeight: 21 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  sectionTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 18 },
  sectionCaption: { color: fieldTheme.colors.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  pill: { alignSelf: 'flex-start', borderRadius: fieldTheme.radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  emptyCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 20, alignItems: 'center', gap: 7 },
  emptyIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: fieldTheme.colors.primarySoft, marginBottom: 2 },
  emptyIconText: { color: fieldTheme.colors.primary, fontWeight: '900', fontSize: 20 },
  emptyTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  emptyMessage: { color: fieldTheme.colors.textMuted, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  outlineButton: { marginTop: 4, minHeight: 42, paddingHorizontal: 16, borderRadius: fieldTheme.radius.sm, borderWidth: 1, borderColor: fieldTheme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: fieldTheme.colors.primary, fontWeight: '800' },
  skeletonCard: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 10 },
  skeletonLine: { height: 12, borderRadius: 999, backgroundColor: fieldTheme.colors.surfaceMuted },
  errorCard: { backgroundColor: fieldTheme.colors.dangerSoft, borderColor: fieldTheme.colors.dangerBorder, borderWidth: 1, borderRadius: fieldTheme.radius.md, padding: 14, gap: 6 },
  errorTitle: { color: fieldTheme.colors.danger, fontWeight: '800' },
  errorMessage: { color: fieldTheme.colors.danger, lineHeight: 20 },
  errorAction: { alignSelf: 'flex-start', marginTop: 3 },
  errorActionText: { color: fieldTheme.colors.danger, fontWeight: '800' },
  syncCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: fieldTheme.colors.border, backgroundColor: fieldTheme.colors.surface, borderRadius: fieldTheme.radius.lg, padding: 14 },
  syncCardCompact: { minHeight: 56, borderRadius: fieldTheme.radius.md, paddingVertical: 9, paddingHorizontal: 12 },
  syncDot: { width: 9, height: 9, borderRadius: 999 },
  syncTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 14 },
  syncMessage: { color: fieldTheme.colors.textMuted, lineHeight: 18, fontSize: 12, marginTop: 2 },
  syncMessageCompact: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  syncAction: { paddingHorizontal: 8, paddingVertical: 7 },
  syncActionText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  actionButton: { minHeight: 50, borderRadius: fieldTheme.radius.md, borderWidth: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  actionButtonCompact: { minHeight: 38, borderRadius: fieldTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  actionButtonFullWidth: { alignSelf: 'stretch' },
  actionButtonInline: { alignSelf: 'flex-start' },
  actionButtonPressed: { opacity: 0.78 },
  actionButtonText: { fontWeight: '800', fontSize: 16, textAlign: 'center', lineHeight: 20 },
  actionButtonTextCompact: { fontSize: 13, lineHeight: 17 },
  buttonDisabled: { opacity: 0.45 },
});
