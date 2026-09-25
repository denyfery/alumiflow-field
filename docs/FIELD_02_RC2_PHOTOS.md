# Field 0.2 RC2 — Survey Photos

Adds the first robust camera/photo pipeline on top of the RC1 offline survey core.

Flow: camera → resize/compress → persistent app storage → SQLite photo row → sync queue → idempotent Laravel upload → server confirmation → local file cleanup.

Install required Expo modules before typecheck:

```bash
npx expo install expo-image-picker expo-image-manipulator expo-file-system
```

Server photo deletion is deferred, but queued/failed local photos can be removed safely because photo operations do not advance survey optimistic version.

## After patch

If Expo Router typed paths still only know the old routes, stop Metro and regenerate generated route types:

```bash
rm -rf .expo
npx expo start --clear
```

Then run `npm run typecheck`.
