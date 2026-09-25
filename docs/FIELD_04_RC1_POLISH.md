# AlumiFlow Field 0.4 RC1 — UI/UX Polish

## Goal

Make the already validated Surveyor + Installer flows feel simpler, calmer, and safer for pilot users without changing field business rules.

## Included

- Shared Field design tokens and reusable UI primitives.
- Cleaner login screen with user-safe login errors.
- Home focused on today's field work rather than technical sync internals.
- Human-readable sync states: synced, syncing, offline, pending, error.
- Survey and Installation lists grouped into Today, Upcoming, and Recently Completed.
- Consistent status pills and empty/loading/error states.
- Cleaner Survey and Installation detail headers with compact sync state.
- Installation blocking issue explanation before completion.
- Polished Survey measurement form.
- Settings screen.
- Diagnostics screen with app/server/sync/device information and Share action.
- ID/EN translations for new UI copy.

## Intentionally unchanged

- Survey business rules.
- Installation business rules.
- Offline queue protocol.
- Idempotency/versioning.
- Photo lifecycle.
- Signature/handover.
- Push notification delivery/deep-link contract.
- Cross-role assignment rules.
- Backend API contract.

## Pilot UX rule

Users should see business language, not implementation language. Terms such as bootstrap, checkpoint, and queue are kept out of the normal Field UI. Diagnostics remains the place for support-oriented state.
