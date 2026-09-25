# Field 0.2 RC2 Validation

## Dependencies

```bash
npx expo install expo-image-picker expo-image-manipulator expo-file-system
npm run typecheck
npm run doctor
```

If typed routes are stale after applying the patch:

```bash
rm -rf .expo
npx expo start --clear
```

## Online photo flow

1. Start an assigned survey.
2. Add at least one measurement item.
3. Tap `Kamera` in Foto Survey.
4. Confirm the photo becomes `Synced` when online.
5. Verify the survey photo appears in the web survey detail.

## Offline photo flow

1. Sync an assigned survey first.
2. Stop Laravel / disconnect the emulator network.
3. Start the survey and capture a photo.
4. Confirm the photo remains visible locally and shows `Menunggu sync`.
5. Force-close/reopen Expo Go and confirm the photo still exists.
6. Reconnect/start Laravel and run Sync.
7. Confirm pending queue returns to 0 and photo becomes `Synced`.

## Failure/retry

- A network failure must keep the local file and queue operation.
- Local file is deleted only after the server confirms the upload.
- A queued/failed photo can be removed locally without changing survey version.
