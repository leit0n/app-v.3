# TODO - make program run 100% no errors

## Web (SPA) — DONE
- [x] Fix `web/state/store.js` to avoid `crypto.randomUUID()` runtime issues by adding a safe UUID helper.
- [x] Add store action to persist profile settings (`notificationsEnabled`, `reduceMotion`) and remove invalid `store.setState?.({})`.
- [x] Update `web/screens/screen-profile.js` to save settings via the store (no direct/localStorage mutation for settings).

## Backend (Node/Express) — NEXT
- [ ] Add safe runtime validation for `POST /api/reports` request body (ensure required fields exist and have correct types/ranges).
  - Return 400 with a clear message for invalid input.
  - Keep the existing “DB not configured” early return, but also prevent crashes caused by malformed input.
- [ ] Ensure the server process starts cleanly:
  - No unhandled promise rejections.
  - Add a catch-all error handler and guard async paths.

## Database — NEXT
- [ ] Verify `database/schema.sql` can be executed successfully (at least: enums, PostGIS extension, tables, constraints, indexes).

## Mobile (Flutter) — NEXT
- [ ] Run `flutter analyze` / `flutter build` and fix any compile-time null/type issues in `mobile/lib/main.dart`.

## Verification — NEXT
- [x] Run basic checks: `node backend/server.js`.
  - Result observed: server starts; warning printed because `DATABASE_URL` is not set.
- [ ] Web smoke test: open `web/index.html`, navigate all routes (home/map/report/challenges/profile), and confirm there are no console errors.



