# AlumiFlow Field 0.3 RC1 - Installer Core

## Workflow

Assigned Installation -> SQLite -> Start -> before/issue/after photos -> completion review -> Complete -> ordered sync -> Laravel API.

## Offline-first behavior

Installer actions are written locally first. Start, photo uploads, completion, and field events are queued with stable operation UUID / Idempotency-Key values. Local photo files are only removed after the server confirms upload.

## Privacy

Location is event-based only at start/completion. No background or continuous tracking is used. GPS is optional and denied/unavailable/timeout states are recorded honestly.

## Localization

Field reads `profile.user.locale` (`id` / `en`). Main Surveyor and Installer UI copy, dates, statuses, evidence labels, and known measurement labels follow this setting. A successful Sync refreshes `/me`, so language changes made on Web are picked up without reinstalling the app.

## RC1 exclusions

- Customer signature / handover report
- Push notification
- Background location
- Continuous employee tracking
- Installer finance visibility
