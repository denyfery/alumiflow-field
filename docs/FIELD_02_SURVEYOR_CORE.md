# AlumiFlow Field 0.2 — Surveyor Core RC1

This candidate turns the Field 0.1 foundation into the first real offline-capable Surveyor workflow.

## Included

- Pull assigned surveys from Laravel and store them in SQLite.
- Pull safe Product Master + dynamic measurement schema into SQLite.
- Survey list and local detail screen.
- Start Survey from device.
- Add/edit/delete measurement items using Product Master dynamic attributes.
- Queue every mutation locally with idempotency keys.
- Optimistic survey version chain while offline.
- Complete Survey locally and push when online.
- Push-first then pull sync ordering so local unsynced work is never overwritten by a server snapshot.
- Crash-safe retry of queue rows left in `processing` state.
- Queue counts are scoped to the active user/company.
- Field 0.1 SafeAreaView deprecation fix retained.

## Offline flow

```text
Server assignment
  -> Sync
  -> SQLite surveys/products
  -> Network unavailable
  -> Start Survey
  -> Add/Edit/Delete measurement
  -> Complete Survey
  -> sync_queue (pending)
  -> Network returns
  -> Idempotent push in operation order
  -> Fresh server snapshot
  -> SQLite reconciled
```

## Intentionally deferred

- Camera / Survey photos.
- GPS event capture.
- Push notifications.
- Advanced conflict resolution UI.
- Installer workflow.

The next Field 0.2 slice is camera + resilient photo queue after this RC1 core flow passes the device test matrix.
