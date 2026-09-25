# AlumiFlow Field 0.5 — UI Polish

## Goal
Keep Field operational, quiet, and fast while reducing the rigid "card everywhere" feel.

## Scope
- Login: email/password only, clearer hierarchy, password visibility, local-first assurance copy.
- Home: lighter hero, workspace icons, compact sync state, cleaner card hierarchy.
- Survey list: featured Today card, schedule/location icons, lighter completed rows.
- Survey detail: structured location/contact information, cleaner item/photo actions, shared vector icons.
- Settings: list-style preferences/support/account sections with compact language controls.
- Shared UI: compact sync details, subtle secondary actions, reusable vector icons.
- Company appearance: mobile consumes only the company primary color and derives the rest of its tonal palette.

## Intentionally unchanged
- Survey/Installation business rules.
- Offline queue, sync protocol, conflict handling, photo lifecycle, GPS evidence, permissions, push behavior.
- Backend auth contract: company is inferred from the authenticated user; Login has no company field.
- Success/warning/danger semantic colors.
- Native app icon/splash/package identity.

## Validation
1. `npm run typecheck`
2. `npm run doctor`
3. Login success/error/offline server error.
4. Home Survey + Installation navigation.
5. Survey list Today/Upcoming/Completed.
6. Survey detail Maps/Copy/WhatsApp, item edit/delete, camera, complete.
7. Settings language persistence, notification state, diagnostics, logout.
8. Change company primary color, Sync, verify subtle accent update without semantic status color changes.
