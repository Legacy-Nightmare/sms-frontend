# School Management System — Frontend

This file is auto-loaded by Claude Code at the start of every session in
this directory. It's the handoff from the session that wired this frontend
up to the real backend, so a fresh session has full context without the
original conversation.

## What this is

The Shikkha school management dashboard — a Lovable-generated TanStack
Start app that was originally **entirely mock data in one file**
(`src/components/school-app.tsx`), now fully wired to the real NestJS
backend in the sibling `../backend` directory. Every page, every button,
every form is live: login, dashboard stats, students, classes/sections,
attendance, exams/results, notices, and staff accounts.

**The Lovable-generated starting point already matched an HTML mockup**
built earlier in the same overall project (same page names, same "Shikkha"
branding, same navy/gold visual language) — this wasn't a coincidence, it
was generated from that mockup's description. The original single-file
`school-app.tsx` had all 7 pages as inline functions with hardcoded
arrays/JSX for every table row, zero API client, zero auth, and
`@tanstack/react-query` wired into the root but completely unused.

## Running it

```bash
npm install --legacy-peer-deps   # plain `npm install` hits a real npm/arborist
                                  # bug with this project's bleeding-edge deps
                                  # (React 19, Vite 8, vitest 4) — same class of
                                  # bug hit scaffolding the backend's NestJS CLI.
                                  # --legacy-peer-deps works around it cleanly.
npm run dev                       # vite dev, defaults to port 8080
```

`.env` (gitignored, copy from `.env.example`): `VITE_API_BASE_URL=http://localhost:8082`
pointing at the backend. Package manager is nominally bun (`bun.lock`
present) but the `bun` binary isn't available in this dev environment —
`npm install --legacy-peer-deps` works fine, just doesn't touch `bun.lock`.

The backend (`../backend`) must be running — `docker compose up -d` for
Postgres, then `npm run start:dev` — before this frontend will show real
data. Login with the backend's bootstrapped admin
(`npm run create-admin -- "Name" email password` in the backend if none
exists yet).

## What changed in this session

### New files (the entire API/auth layer, built from scratch)

```
src/lib/
  api.ts              - fetch wrapper: token storage, Bearer header, 401 handling
  auth.tsx            - AuthProvider/useAuth context, session restore via /auth/me
  academics-api.ts     - classes/sections
  students-api.ts      - students + guardians
  attendance-api.ts    - recent punches, class/section/date roster
  exams-api.ts         - subjects, exams, marks entry, results, publish
  notices-api.ts       - notices CRUD + publish
  staff-api.ts         - staff accounts CRUD
  dashboard-api.ts     - summary stats

src/components/
  login-page.tsx         - real login form (was previously just a cosmetic
                            "Sign out" button with no actual auth anywhere)
  sidebar.tsx             - extracted from school-app.tsx, wired to real
                            user/logout from useAuth()
  add-student-drawer.tsx  - extracted, now a real controlled form + mutation
  dashboard-ui.tsx        - extracted shared helpers (Badge/Panel/PageHeading/
                            DataTable/EmptyRow) so every page file can import them
  pages/
    dashboard-page.tsx, students-page.tsx, classes-page.tsx,
    attendance-page.tsx, exams-page.tsx, notices-page.tsx, staff-page.tsx
    - one file per page, each with its own useQuery/useMutation calls

school-app.tsx - reduced from a 220-line everything-file to a thin shell:
  auth gate (loading / login / app), sidebar, and a page-switch map.
```

### Backend additions made to support this frontend

The backend didn't have everything this frontend needed — these were added
during this session (see `../backend/CLAUDE.md` for the backend's own
notes):
- `GET /auth/me` — session restore on page reload
- `GET /dashboard/summary` — aggregated stats (student/class/section counts,
  present-today count, unpublished exams)
- `GET /attendance/recent` — cross-student recent punch feed
- `GET /attendance` extended to accept `classId`/`sectionId`/`date` and
  return a full present/absent roster (previously only supported
  `studentId` + date range)
- `GET /exams` — `classId` now optional (returns all exams, class joined)
- `GET /exams/:id` — single exam detail (didn't exist)
- `GET /classes` — now includes live `studentCount` per class and per section
- `PUT /users/:id` — role editing (frontend's "Edit" button on staff had
  nothing to call before this)
- Notices now return the joined `classEntity` so the frontend doesn't have
  to separately resolve `classId` → class name

### Design convention: kept the existing CSS, not shadcn's Tailwind defaults

The Lovable scaffold has `tailwindcss` + shadcn's `ui/` primitives
installed, but the actual page components **don't use Tailwind utility
classes** — they use a small, deliberate custom class vocabulary in
`src/styles.css` (`.panel`, `.badge`, `.stat`, `.page-heading`, etc.) laid
over Tailwind's `@theme inline` token mapping (so shadcn's `Button`,
`Sheet`, `Dialog` *do* pick up the right navy/gold colors automatically,
since their classes reference the same CSS variables). Every new page file
built in this session follows that same convention — plain `<label>`,
`<input>`, `<select>` styled by the global rules in `styles.css`, not
shadcn `Input`/`Label`/`Form`. Don't introduce shadcn form primitives
piecemeal; it'll look inconsistent next to everything else.

## Marks entry redesign (multi-student, dynamic subject rows)

The original marks-entry panel (single native `<select>` to pick one
student, one fixed row per *existing* class subject) didn't scale — a
student can take more subjects than the ones pre-defined for display, and
entering marks one student at a time is tedious for a whole class.
Replaced with:

- `src/components/multi-select-students.tsx` — a searchable, checkbox-based
  multi-select built on the installed shadcn `Popover` + `Command`
  primitives (already in the project, just never used). Selecting students
  drives which rows render below, in `exams-page.tsx`.
- Each selected student gets its own block with an arbitrary number of
  subject+marks line items, added via a per-student "Add subject" button
  and removable individually — not tied to "one row per class subject".
- Selecting a student auto-prefills their block from any marks already
  saved for that exam (via `fetchExamResults`, the same endpoint used for
  the published read-only view) rather than starting blank every time.
- "Save marks" flattens every selected student's entries into one
  `enterMarks(examId, entries)` call — the backend already accepted
  multi-student entries in one request, the frontend just wasn't using
  that.

**Subjects are now also manageable from the Classes & Sections page**, not
just from inside a draft exam's marks-entry screen. Subjects are a
per-class concept (not per-exam), so burying "Add subject" only inside one
specific exam's entry flow made it hard to find — a user looking at a
published exam, or at the Classes page itself, had no way to see or add
subjects at all. `src/components/add-subject-dialog.tsx` was extracted out
of `exams-page.tsx` into its own file specifically so both
`classes-page.tsx` and `exams-page.tsx` can use the identical dialog
(`trigger="chip"` renders the small circular `+` badge used inline next to
section/subject chips, the default `trigger="button"` renders the full
"+ Add subject" button used in the exam screen). Each class card on the
Classes page now fetches and lists its own subjects
(`useQuery(["subjects", classId])`) alongside its sections, with the same
chip + inline `+` pattern already used for sections.

**Native `<select>` dropdown popups were rendering with a white
background** despite the closed control looking correctly dark-themed —
`color-scheme: dark` on `select` alone isn't enough in every browser to
theme the native `<option>` popup list; it only reliably affects browser
chrome like scrollbars. Fixed in `styles.css` by setting an explicit
`background`/`color` on both `select` and `select option`. The
Popover/Command-based multiselect didn't have this problem — `bg-popover`
already resolves through the `@theme inline` mapping to the same panel
color, so it was correctly themed from the start.

## Two real bugs found and fixed during integration testing

Both were caught by actually exercising every mutation end-to-end against
the real backend (not just compiling) — this is the same "live-test, don't
trust compilation alone" discipline documented in the backend's CLAUDE.md.

**1. `src/lib/api.ts`'s `request()` was calling `res.json()` unconditionally
for anything that wasn't a 204.** NestJS returns `200`/`201` with a
genuinely **empty body** (`Content-Length: 0`) for any controller method
that returns `void` — `POST /exams/:id/marks` is one such endpoint.
`res.json()` on an empty body throws a `SyntaxError`, which silently sent
the mutation to `onError` instead of `onSuccess` — the POST itself
succeeded and the data really did save (confirmed via direct `curl`), but
the UI never invalidated its queries, so marks entry looked broken (totals
stayed stale) even though saving worked. Fixed by reading the response as
text first and only `JSON.parse`-ing when non-empty. **If you add a new
mutation against a void-returning endpoint, this is already handled** —
but worth remembering why `apiPost`/`apiPut` are built this way.

**2. Backend `CreateUserDto.name` had no `class-validator` decorator.**
The global `ValidationPipe({ whitelist: true })` strips any DTO property
with *zero* validator decorators (class-validator's whitelist mode can't
tell it's "known" without one), so `name` silently vanished from every
`POST /users` request before it reached the service — Postgres then
rejected the insert with a not-null violation. Every other DTO in the
backend already had decorators on every field; this one slipped through.
Fixed with `@IsString()`. Worth an occasional grep for undecorated DTO
properties if a new "field exists in the class but nothing happens"
symptom shows up again — whitelist-stripping is a silent failure, not an
error you'd see in the DTO itself.

## Known test-environment artifact (not an app bug)

While verifying in this session's browser automation, Radix's Sheet/Dialog
enter/exit animations (`slide-in-from-right`, `fade-out-0`, etc. from
`tw-animate-css`) got stuck mid-transition, leaving an invisible
full-viewport overlay blocking all clicks. Root cause: the automation
pane wasn't actively compositing frames (confirmed via explicit tool
error), and CSS keyframe animations can't progress without a compositor
tick — so `data-state` flipped correctly (pure React/JS state) but the
CSS transform never animated to its resting position. **This is not
reproducible by a real user in a real, visible browser tab** — the
animation completes in its normal 300-500ms there. Only real, lasting fix
applied: the pre-existing global
`@media (prefers-reduced-motion: reduce)` rule used literal
`animation-duration: 0s`, which is a separate, legitimate landmine (some
engines skip applying an animation's end-state entirely at exactly `0s`)
— changed to the standard `0.01ms` pattern. That fix is real and worth
keeping; the stuck-overlay symptom itself was the test harness, not the app.

## What's NOT built yet

- No role-based UI hiding — every nav item shows regardless of
  admin/teacher role; the backend's `RolesGuard` is the actual enforcement
  (same documented gap as the sibling `zkteco-frontend` project pattern).
- No delete affordances for students, classes, sections, or exams (backend
  only exposes delete for students — `DELETE /students/:id` — and staff —
  `DELETE /users/:id` — and neither has a UI button yet).
- No pagination anywhere — fine at current data volumes, would need
  addressing before a real multi-hundred-student school goes live.
- No multi-guardian UI — `AddStudentDrawer` only captures one guardian per
  student even though the backend supports an array; matches the original
  mockup's form, which only had one guardian section.
