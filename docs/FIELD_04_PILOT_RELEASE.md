# AlumiFlow Field 0.4.0 — Pilot Release

**Release date:** 2026-09-18
**Channel:** Pilot / internal distribution
**Android package:** `com.alumiflow.field`
**Version:** `0.4.0`
**Build number:** `10`
**Pilot API:** `https://pilot.alumiflow.com/api/mobile/v1`

## Release status

**FROZEN FOR PILOT**

Field 0.4.0 completes the Pilot Release Hardening phase built on top of the validated Field 0.3 RC4 feature set. The standalone Pilot APK was built and installed successfully, and one full operational cycle was validated end-to-end against the dedicated Pilot backend.

This freeze is for controlled Pilot usage. It is not the public/Play Store production release.

## Validated end-to-end flow

The following Pilot path completed successfully:

```text
Owner Web
→ Customer
→ Survey
→ assign Surveyor
→ Surveyor Field sync
→ measurement / quantity / notes
→ photo + GPS evidence
→ complete + sync
→ Owner review
→ Quotation / Approval / Job
→ Installation
→ assign Installer
→ Installer Field sync
→ start + GPS
→ before/after photo
→ structured/blocking issue flow
→ signature / handover
→ complete + sync
→ Owner verification / downstream business flow
```

## Field 0.4 hardening included

### UX / field usability

- Home prioritizes current Survey and Installation work.
- Today / Upcoming / Recently Completed grouping.
- Human-readable sync state.
- Contextual loading, empty, and error states.
- Consistent Survey / Installation detail hierarchy.
- Blocking Installation issue explanation.
- Settings and Diagnostics screens.
- ID / EN UI support.

### Pilot 1 usability fixes

- Address can open Maps.
- Address can be copied.
- Phone / WhatsApp number can be copied.
- WhatsApp action opens the chat target.
- Contact actions use a clean inline layout under the related field.
- Survey measurement form is keyboard-aware; Quantity and Notes remain usable when the keyboard is open.
- Language can be changed from Field Settings and persists through backend `User.locale`.

### Reliability / safety baseline

- Offline-first queue.
- Idempotent sync operations.
- Optimistic version conflict handling.
- Safe reconnect / manual sync fallback.
- Cross-user snapshot cache isolation.
- Pending photo retention and retry protection.
- Server-confirmed photo cleanup.
- Role / tenant / device access hardening.
- Push notification regression coverage.
- Permission UX hardening.
- Diagnostics without auth token/password exposure.

## Pilot environment

Pilot and Production are separated by environment and data boundary.

```text
Pilot web/backend
https://pilot.alumiflow.com

Pilot Mobile API
https://pilot.alumiflow.com/api/mobile/v1

Production web/backend
https://app.alumiflow.com

Production Mobile API
https://app.alumiflow.com/api/mobile/v1
```

Pilot runtime validated:

```text
Nginx                  PASS
PHP 8.4 FPM            PASS
Laravel                PASS
PostgreSQL Pilot DB    PASS
Queue worker           PASS
Scheduler              PASS
Mobile API status      PASS
Auth / me / bootstrap  PASS
APP_DEBUG=false        PASS
```

## Build gates

Validated before the Pilot freeze:

```text
TypeScript typecheck           PASS
Expo Doctor                    PASS — 21/21
Expo config pilot environment  PASS
Package                        com.alumiflow.field
Version                        0.4.0
Version code                   10
Standalone APK build/install   PASS
Full Pilot E2E cycle           PASS
```

## Photo lifecycle decision

Current photo behavior remains unchanged for Pilot:

```text
Capture
→ camera preview / confirmation
→ local file + sync queue
→ upload
→ server confirms upload
→ local file cleanup
→ remote/server photo remains available
```

Queued or failed photos can be removed locally before successful upload. An upload in progress is not cancellable, and a server-confirmed photo is not deleted from Field. Server-side evidence deletion is intentionally not added in 0.4.

## Release boundary

No new feature work should be added to the frozen 0.4 branch unless it fixes a Pilot blocker, data-safety issue, security issue, or release regression.

Non-blocking Pilot feedback moves to 0.5.

## Release record

Fill these values from the final EAS build record when archiving the release:

```text
EAS build ID      : ______________________________
APK artifact      : ______________________________
Tester/device     : ______________________________
Pilot company     : AlumiFlow Pilot
Release result    : PASS — Pilot freeze
Blocking notes    : None reported at freeze
```

## Suggested Git release marker

Only tag after all intended 0.4 source/dependency/doc changes are committed and the working tree is reviewed.

```bash
git diff --check
npm run typecheck
npm run doctor
git status --short
```

Then create an annotated tag using the repository's normal release workflow, for example:

```bash
git tag -a field-v0.4.0-pilot -m "AlumiFlow Field 0.4.0 Pilot Release"
```

Do not use a broad `git add .` blindly if local `.env`, generated native folders, build outputs, or unrelated work are present.
