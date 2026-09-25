## 0.5.0-dev — Company Appearance + UI Polish

- Added per-company appearance payload from Mobile API profile/bootstrap.
- Added runtime Field theme provider with offline-safe cached company branding.
- Field now uses one company primary color and derives its own soft/border/strong tones; company accent/navbar colors remain web-facing and do not drive mobile surfaces.
- Semantic success/warning/danger/offline colors stay fixed.
- Appearance changes are detected during sync and applied without logout/login.
- Login/native app identity remains AlumiFlow default branding.
- Refined Login, Home, Survey List, Survey Detail, and Settings toward a lighter operational UI with clearer hierarchy, fewer heavy borders, compact sync state, and consistent vector icons.
- Login remains email/password only; company access continues to be resolved by backend authentication.

# AlumiFlow Field Changelog

## AlumiFlow Field 0.4.0 — Pilot Release (2026-09-18)

### Release status
- Frozen for controlled Pilot use after standalone APK build/install and a full end-to-end Pilot cycle passed.

### Added / improved
- Pilot/Production environment separation and release safety guards.
- Release branding, diagnostics, and support information.
- Reliability hardening for offline queue, reconnect, conflicts, photo lifecycle, permissions, and push notification flow.
- Maps action and copy address/contact actions for Survey and Installation details.
- Clean inline contact action layout.
- Keyboard-aware Survey measurement form.
- Mobile language update/persistence through backend user locale.

### Validated
- TypeScript typecheck PASS.
- Expo Doctor 21/21 PASS.
- Pilot backend runtime and Mobile API PASS.
- Standalone Pilot APK build/install PASS.
- Owner → Surveyor → Owner → Installer → Owner end-to-end operational cycle PASS.

### Deferred to 0.5
- Per-company appearance/branding.
- Product Master Simple / Advanced UX mode.
- Additional non-blocking Pilot feedback.

# AlumiFlow Field 0.4 RC1

## Pilot Release Hardening — UI/UX Polish

### Added
- Shared Field theme tokens and reusable UI states.
- Settings screen.
- Diagnostics screen.
- Human-readable sync status component.
- Skeleton loading and contextual empty states.

### Changed
- Home now prioritizes today's Survey and Installation work.
- Survey and Installation lists now separate Today, Upcoming, and Recently Completed work.
- Survey and Installation detail headers use a consistent hierarchy and compact sync state.
- Installation completion now explains blocking issues before disabling completion.
- Login and Survey measurement form received clean/consistent visual treatment.
- User-facing sync/network errors are mapped to safer non-technical messages.

### Compatibility
- No backend changes.
- No database migration.
- No new Expo dependency.
- Existing Firebase/EAS/app.json configuration is intentionally untouched.
- Existing RC4 business behavior is preserved.
