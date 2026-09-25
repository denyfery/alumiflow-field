# Field 0.2 RC1 validation

1. Backend V6.2.1 migration + focused test pass.
2. Full Laravel regression test pass.
3. Web `npm run types:check` + `npm run build` pass.
4. Mobile `npm run typecheck` + `npm run doctor` pass.
5. Web: schedule a Survey to a Surveyor.
6. Mobile online: Sync -> assignment appears.
7. Turn Laravel/network unavailable after data is cached.
8. Mobile offline: Start -> add at least one Product measurement -> edit -> optional delete/add -> Complete.
9. Confirm Pending queue > 0 and logout is blocked.
10. Restore backend/network -> Sync.
11. Pending queue returns 0; Survey remains Completed after fresh server pull.
12. Web Survey shows the same items/measurements and status Completed.
13. Cross-surveyor access must remain unavailable.
