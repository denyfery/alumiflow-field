# Field 0.3 RC2 — Customer Signature & Completion Handover

## Flow

1. Installer selects Complete Installation.
2. Field captures completion GPS evidence (optional as before).
3. Installer enters recipient name and optional handover notes.
4. Recipient signs on-device, or installer explicitly records why signature is unavailable.
5. Completion + handover is stored locally and queued as one idempotent operation.
6. Offline restart keeps the handover in SQLite and sync queue.
7. Server completion creates immutable handover evidence and completes the job.
8. Web Installation page exposes a print-friendly Completion Report.

## Dependency

Install the Expo-compatible SVG package locally before typecheck:

```bash
npx expo install react-native-svg
```

Do not overwrite the local authoritative `package-lock.json` from the patch.
