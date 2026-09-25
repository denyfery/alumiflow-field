# Field 0.2 RC3 — GPS Event + Completion Evidence

RC3 records event-based field evidence only when a Surveyor starts or completes a survey.

## Privacy / UX rules

- Foreground location only.
- No continuous/background tracking.
- GPS is optional: denied, unavailable, and timeout states are recorded without blocking work.
- Completion uses a review step before final confirmation.
- Local event time (`captured_at`) remains authoritative for when the field action happened offline; server receipt time is separate.

## Offline flow

1. Start/complete survey locally.
2. Capture location result (or failure state).
3. Persist immutable local field event in SQLite.
4. Queue event with its own UUID/idempotency key.
5. Push queued operations in SQLite insertion order.
6. Server confirms event; local row becomes uploaded.
7. Pull authoritative survey/evidence snapshot.

## Required dependency

Run once after applying RC3:

```bash
npx expo install expo-location
```

`app.json` includes the Expo Location config plugin for foreground permission copy.
