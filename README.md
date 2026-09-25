# AlumiFlow Field 0.4 RC1 — UI/UX Polish Patch

This patch is applied on top of the validated Field 0.3 RC4 source.

## Apply

From the AlumiFlow Field project root:

```bash
unzip -o ~/Downloads/alumiflow-field-0.4-rc1-ui-ux-polish-patch.zip -d .
```

No `npm install` is required by this patch.

## Important: regenerate Expo Router typed routes

RC1 adds `/settings` and `/diagnostics`. Regenerate `.expo` route types before the final typecheck:

```bash
rm -rf .expo
npx expo start --dev-client --localhost --clear
```

After Metro has generated route types, run in another terminal:

```bash
npm run typecheck
npm run doctor
```

Expected:

- TypeScript: 0 errors
- Expo Doctor: 21/21

## Smoke test

1. Login online.
2. Home shows current user, date, Survey/Installation cards, and human-readable sync state.
3. Switch network off: Home should show offline state while local assignments remain usable.
4. Survey list: Today / Upcoming / Recently Completed grouping.
5. Installation list: Today / Upcoming / Recently Completed grouping, blocking issue warning if applicable.
6. Open Survey and Installation details; compact sync state should be visible.
7. Blocking Installation issue should explain why completion is unavailable.
8. Settings opens from Home.
9. Diagnostics displays server, sync, pending count, app version, and masked device ID.
10. Share diagnostic info should open Android share sheet.
11. Change account locale on Web, sync, and verify the new RC1 labels switch ID/EN.
12. Re-test one Survey completion and one Installation completion to ensure no business-flow regression.

## Notes

This release is intentionally UX-only. Do not treat it as a replacement for Field 0.4 RC2 reliability/offline regression hardening.
