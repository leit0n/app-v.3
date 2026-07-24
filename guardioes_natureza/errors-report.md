# Errors Report (static review)

This file lists issues found by reviewing the current source files in this repo snapshot.

> Note: Some issues (e.g., runtime type errors) require actually running lint/test/build or browser console verification. This report is based on static inspection of the files that were read.

---

## Backend — `backend/server.js`

### 1) Port conflict / multiple server instances
- **Issue:** During verification, starting a second server instance caused `EADDRINUSE: address already in use :::3000`.
- **Impact:** Not a code bug by itself, but it complicates running tests repeatedly.
- **Where:** `app.listen(PORT, ...)` (expected behavior; just operational).

### 2) (Updated) Request validation + DB-not-configured semantics
- **Status:** Fixed.
- `/api/reports` now validates `latitude`, `longitude`, `accuracy`, and `userId` as finite numbers and returns `400` on invalid input.
- Missing `DATABASE_URL` now returns `503` (service unavailable).
- Added a global Express error handler (`app.use((err, req, res, next) => ...)`) to catch unhandled errors.


---

## Web — `web/state/store.js`

### 6) Stored state is mutated by reference in `addNotification` / `addReport` (design risk)
- **Issue:** The file generally uses immutable updates, but the initial `const state = load() ?? createInitialState();` is then relied upon. While updates use `setState({...})`, there are places that build derived arrays from `state.*`.
- **Risk:** If other code obtains references to nested objects, subtle mutation bugs can appear. This is a design-level risk rather than a confirmed runtime bug.

### 7) `rawSetState` is unused
- **Issue:** `rawSetState` is declared but never used.
- **Impact:** Not a runtime error, but indicates dead code.
- **Where:** `function rawSetState(nextState) { ... }`

---

## Web — `web/screens/screen-profile.js`

### 8) Unused variable `nextSettings`
- **Issue:** `nextSettings` is computed but never used.
- **Impact:** Dead code / minor cleanup.
- **Where:**
  - `const nextSettings = { ...(store.getState().profile.settings || {}), ... }` (unused)



---

## Mobile — `mobile/lib/main.dart`

### 10) Flutter “mock app” likely missing required widgets for full product
- **Issue:** The current mobile app is a minimal mock with only two tabs.
- **Impact:** It may compile, but it may not meet “product complete” expectations.
- **Risk:** This is a product completeness issue rather than a compile error.

### 11) No null/type issues found in static read
- **Observation:** The code appears syntactically valid and uses `String?` safely.
- **But:** No `flutter analyze`/build was executed in this session, so compile-time issues are not fully verified.

---

## Database — `database/schema.sql`

### 12) Schema requires runtime validation (PostGIS)
- **Issue:** Schema assumes PostGIS extension and geometry types.
- **Impact:** Without executing against a database, syntax/runtime compatibility (enum names, constraints, geometry SRIDs) is not guaranteed.
- **Observation:** No obvious SQL syntax error was visible from the file read, but execution was not performed.

---

# Summary
- The biggest real correctness gap is **Backend request validation** for `/api/reports`.
- Several **minor cleanup** items exist in the web UI (unused variables/functions).
- **Database execution** and **Flutter analyze/build** were not performed, so those areas are not fully proven.

