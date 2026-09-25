import type { CompanyAppearance } from '@/types/api';

const baseColors = {
  background: '#F6F9FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E5EAF0',
  borderStrong: '#D6DEE8',
  text: '#0F172A',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  success: '#15803D',
  successSoft: '#F0FDF4',
  successBorder: '#BBF7D0',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  infoBorder: '#BFDBFE',
} as const;

const defaultAppearance: CompanyAppearance = {
  source: 'system',
  primary_color: '#0F766E',
  accent_color: '#F0FDFA',
  navbar_color: '#FFFFFF',
};

export function createFieldTheme(appearance?: CompanyAppearance | null) {
  const resolved = {
    ...defaultAppearance,
    ...appearance,
    primary_color: normalizeHex(appearance?.primary_color, defaultAppearance.primary_color),
    accent_color: normalizeHex(appearance?.accent_color, defaultAppearance.accent_color),
    navbar_color: normalizeHex(appearance?.navbar_color, defaultAppearance.navbar_color),
  } satisfies CompanyAppearance;

  const primary = resolved.primary_color.toUpperCase();
  // Mobile uses one company brand color and derives a calm tonal palette.
  // accent_color/navbar_color remain part of the API contract for web/diagnostics,
  // but they intentionally do not drive Field surfaces.
  const primarySoft = mixHex(primary, '#FFFFFF', 0.91);
  const navbar = baseColors.surface;

  return {
    appearance: {
      source: resolved.source,
      navbar,
      onNavbar: readableTextColor(navbar),
    },
    colors: {
      ...baseColors,
      primary,
      primaryStrong: mixHex(primary, '#000000', 0.16),
      primarySoft,
      primaryBorder: mixHex(primary, '#FFFFFF', 0.72),
      onPrimary: readableTextColor(primary),
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    radius: {
      sm: 10,
      md: 14,
      lg: 18,
      xl: 22,
      pill: 999,
    },
  } as const;
}

export const fieldTheme = createFieldTheme();
export type FieldTheme = ReturnType<typeof createFieldTheme>;
export type FieldStatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'info';

function normalizeHex(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim();
  return candidate && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallback;
}

function readableTextColor(hex: string): '#0F172A' | '#FFFFFF' {
  return relativeLuminance(hex) > 0.52 ? '#0F172A' : '#FFFFFF';
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function mixHex(base: string, target: string, ratio: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(target);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * ratio);
  return rgbToHex(mix(br, tr), mix(bg, tg), mix(bb, tb));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}
