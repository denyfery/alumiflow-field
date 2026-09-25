# Field 0.2 RC3 Validation

Validate three scenarios before freezing Surveyor 0.2:

## Online
- Start Survey captures location (or explicit unavailable state).
- Complete Survey shows review with item count, photo count, and location state.
- Sync reaches zero pending operations.
- Web Survey detail shows started/completed field evidence.

## Offline
- Sync assignment first, then stop Laravel/network.
- Start Survey, measurements/photos, completion review, complete.
- Kill and reopen Expo Go; local survey/evidence remains.
- Reconnect and sync; pending queue reaches zero and web evidence appears with original captured times.

## Permission denied
- Deny foreground location permission.
- Start/complete remains allowed.
- Evidence shows `permission_denied`, with no coordinates.
