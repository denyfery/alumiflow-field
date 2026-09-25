import { useMemo } from 'react';
import { useSession } from '@/auth/session-provider';
import { dateLocale, normalizeLocale, t, translateBusinessLabel, type FieldLocale } from '@/i18n';

export function useFieldI18n() {
  const { profile } = useSession();
  const locale = normalizeLocale(profile?.user.locale);

  return useMemo(() => ({
    locale,
    dateLocale: dateLocale(locale),
    t: (key: string, vars?: Record<string, string | number>) => t(locale, key, vars),
    businessLabel: (label: string) => translateBusinessLabel(locale, label),
    formatDate: (value: string | null | undefined) => formatDate(locale, value),
    formatDateTime: (value: string | null | undefined) => formatDateTime(locale, value),
    statusLabel: (status: string) => statusLabel(locale, status),
    locationLabel: (status: string) => locationLabel(locale, status),
  }), [locale]);
}

function formatDate(locale: FieldLocale, value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(locale: FieldLocale, value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(dateLocale(locale));
}

function statusLabel(locale: FieldLocale, status: string): string {
  const map: Record<string, string> = {
    scheduled: t(locale, 'Scheduled'),
    draft: t(locale, 'Draft'),
    in_progress: t(locale, 'In Progress'),
    completed: t(locale, 'Completed'),
  };
  return map[status] ?? status.replace(/_/g, ' ').toUpperCase();
}

function locationLabel(locale: FieldLocale, status: string): string {
  const map: Record<string, string> = {
    captured: t(locale, 'Location captured'),
    permission_denied: t(locale, 'Permission denied'),
    unavailable: t(locale, 'Location unavailable'),
    timeout: t(locale, 'GPS timeout'),
  };
  return map[status] ?? status;
}
