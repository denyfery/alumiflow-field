# AlumiFlow Field 0.1 — Foundation Decisions

## Scope lock

Field 0.1 only provides app shell, authentication, secure token storage, device identity, SQLite migration foundation, connectivity state, sync queue schema, sync bootstrap/checkpoint, and role-based home.

Survey, installation, photo, GPS, signature, and push workflows are intentionally not implemented yet.

## Security boundaries

- Bearer token is stored only in Expo SecureStore.
- SQLite contains non-secret operational/cache data only.
- Cached offline session has a bounded verification age (`EXPO_PUBLIC_OFFLINE_AUTH_MAX_HOURS`, default 24h).
- A real HTTP 401/402/403 from protected mobile endpoints invalidates local authentication.
- Logout is blocked when the local sync queue has pending work. This prevents accidental loss of future offline mutations.
- Mobile data schemas must remain tenant/user scoped. `sync_queue` already stores `company_id` and `user_id`.

## Offline-first rules

- Server remains source of truth.
- SQLite is operational local state.
- Sync queue represents mutations not yet acknowledged by the server.
- Every future mutating sync operation receives its own stable operation UUID and idempotency key.
- Field 0.1 does not process business queue rows while backend capabilities `survey_sync` / `installation_sync` are false.

## Sync states

Future operations use: `pending -> processing -> acknowledged/delete`, with `failed` retained for retry and diagnostics.

Do not silently drop failed work. Do not delete local photos/data until the server confirms persistence.

## Conflict strategy

V6.2 backend already establishes optimistic `version` fields and mobile UUID foundations. Field 0.2+ must reject stale writes and surface conflicts instead of using blind last-write-wins.

## Device identity

A random UUID is generated once per app installation/device storage context and saved in SecureStore. It is sent during login and used as `client_id` for sync checkpoint.

## Logout while offline

Field 0.1 clears the local token even if the server logout call cannot be reached. In later milestones, device-management UX should clearly expose active devices so a user/owner can revoke a token remotely. Pending business mutations must prevent logout.
