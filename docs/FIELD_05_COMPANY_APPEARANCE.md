# AlumiFlow Field 0.5 — Company Appearance

## Scope

Field consumes the effective appearance resolved by the backend. Company overrides are configured by Superadmin using the existing company appearance settings; when disabled, the system-global appearance is returned.

Mobile profile contract adds `company.appearance`:

- `source`: `system` or `company`
- `primary_color`
- `accent_color`
- `navbar_color`

## Runtime behavior

- Login before company identity is known keeps the default AlumiFlow theme.
- After login, the company appearance is cached together with the mobile profile for offline use.
- Bootstrap compares appearance with the cached profile. A change triggers profile refresh and ThemeProvider re-render without logout.
- Primary actions, links, active states, count badges, headers, and selected-product highlights follow the effective company primary/accent colors.
- Success, warning, danger, info, offline, and error tones remain semantic and do not follow company branding.
- App icon, splash, notification icon, package name, and app name remain AlumiFlow Field. This is appearance theming, not full native white-labeling.

## Safety

- No database migration is required.
- Invalid/missing colors fall back to AlumiFlow defaults.
- Primary foreground text is selected by luminance.
- Accent/soft surfaces are lightened when the configured accent would produce weak contrast.
- Older cached profiles without `appearance` remain valid and fall back to the default theme until the next successful sync.

## Validation

1. Company override OFF → Field uses global system appearance.
2. Company override ON → Field uses company primary/accent appearance.
3. Change company colors in Superadmin → run Field sync → UI updates without relogin.
4. Start Field offline after a verified online session → cached company appearance remains active.
5. Danger/warning/success states remain semantic regardless of company primary color.
6. Diagnostics shows appearance source and primary color for support verification.
