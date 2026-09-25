# AlumiFlow Field 0.4 — Pilot Freeze Checklist

This checklist records the evidence used to freeze Field 0.4.0 for controlled Pilot use.

Status:
- `PASS` — validated successfully.
- `RC2 PASS` — validated during the 0.4 reliability hardening matrix and carried into the freeze; the Pilot 1 changes did not intentionally alter that subsystem.
- `NOT RECORDED` — result may have been tested but was not explicitly recorded in the freeze evidence.

## Release identity

| Check | Status | Evidence |
|---|---:|---|
| Version = `0.4.0` | PASS | Expo public config |
| Android versionCode = `10` | PASS | Expo public config |
| Package = `com.alumiflow.field` | PASS | Expo public config |
| Environment = `pilot` | PASS | Expo public config / release profile |
| Pilot API = `https://pilot.alumiflow.com/api/mobile/v1` | PASS | Pilot release config |
| Production/local-host safety guard | RC2 PASS | Release config hardening |
| Branding icon / adaptive icon / splash | PASS | Expo config + installed Pilot APK |
| `npm run typecheck` | PASS | 0 errors |
| `npm run doctor` | PASS | 21/21 |
| Standalone Pilot APK build | PASS | User validation |
| Standalone Pilot APK install/run without Metro | PASS | User validation |

## Pilot backend runtime

| Check | Status | Evidence |
|---|---:|---|
| HTTPS / TLS | PASS | `pilot.alumiflow.com` |
| Mobile API `/status` | PASS | HTTP 200 |
| Unauthorized `/me` protection | PASS | Auth guard smoke test |
| Authenticated `/me` | PASS | HTTP 200 |
| `/sync/bootstrap` | PASS | HTTP 200 |
| PostgreSQL Pilot DB separation | PASS | Dedicated `alumiflow_pilot` database/user |
| Queue worker | PASS | Supervisor RUNNING |
| Scheduler | PASS | Doctor heartbeat OK |
| Storage / storage link | PASS | Backend doctor OK |
| `APP_DEBUG=false` | PASS | Backend doctor OK |

## Surveyor final Pilot flow

| Check | Status |
|---|---:|
| Assignment reaches Field | PASS |
| Sync / bootstrap | PASS |
| Survey detail | PASS |
| Measurement | PASS |
| Quantity / notes keyboard behavior | PASS |
| Photo evidence | PASS |
| GPS evidence | PASS |
| Complete | PASS |
| Push/sync back to Web flow | PASS |
| Maps action | PASS |
| Copy address | PASS |
| Copy phone / WhatsApp | PASS |
| WhatsApp action | PASS |
| Clean inline contact action positioning | PASS |
| Language switch | PASS |
| Language persistence | PASS |

## Installer final Pilot flow

| Check | Status |
|---|---:|
| Assignment reaches Field | PASS |
| Start | PASS |
| GPS evidence | PASS |
| Before photo | PASS |
| After photo | PASS |
| Structured issue flow | PASS |
| Blocking issue flow | PASS |
| Signature | PASS |
| Handover | PASS |
| Complete | PASS |
| Sync back to Web flow | PASS |
| Maps / contact actions | PASS |

## Reliability hardening carried into freeze

These checks were validated during Field 0.4 RC2 hardening. They are recorded here as existing release evidence rather than claimed as a fresh standalone-APK torture-test rerun.

| Check | Status |
|---|---:|
| Offline queue | RC2 PASS |
| Offline → online reconnect | RC2 PASS |
| Manual sync fallback | RC2 PASS |
| App kill with pending queue | RC2 PASS |
| Device restart with pending queue | RC2 PASS |
| Internet drop mid-sync | RC2 PASS |
| Duplicate Sync protection | RC2 PASS |
| Idempotent completion | RC2 PASS |
| Photo retry without duplicate | RC2 PASS |
| Version conflict recovery | RC2 PASS |
| Assignment revoke handling | RC2 PASS |
| Device revoke handling | RC2 PASS |
| Company suspend handling | RC2 PASS |
| Cross-user snapshot cache isolation | RC2 PASS |
| Pending/failed photo retention | RC2 PASS |
| Server-confirmed photo cleanup | RC2 PASS |
| Push notification regression | RC2 PASS |
| Permission UX regression | RC2 PASS |
| Diagnostic data safety | RC2 PASS |

## End-to-end business flow

| Check | Status |
|---|---:|
| Owner creates Customer | PASS |
| Owner creates Survey | PASS |
| Owner assigns Surveyor | PASS |
| Surveyor completes Survey | PASS |
| Owner receives Survey result | PASS |
| Quotation / Approval / Job progression | PASS |
| Owner creates/assigns Installation | PASS |
| Installer completes Installation | PASS |
| Owner receives Installation result | PASS |
| Downstream Web flow verified in Pilot cycle | PASS |

## Freeze result

```text
Field 0.4.0 Pilot Release: PASS / FROZEN
Date: 2026-09-18
Blocking issues at freeze: none reported
```

The 0.4 freeze does not mean every future device/network combination is proven. Pilot feedback should continue to be classified as blocker, UX friction, or non-blocking enhancement. Only blocker/data-safety/security/regression fixes should reopen 0.4.
