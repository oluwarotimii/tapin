# TapIn

Tap-and-go RFID attendance system. Student taps card → clock in. Taps again after their scheduled minimum time → clock out.

> Full product details: [PRD.md](./PRD.md) · Feasibility breakdown: [GAPS.md](./GAPS.md) · **Developer API docs: [docs/API.md](./docs/API.md)**

---

## What this version does

- ✅ Tap in / tap out with automatic validation (schedule window + minimum session length)
- ✅ **Off-schedule taps are auto-accepted and flagged** (`override`) so sudden schedule changes don't block students
- ✅ Real admin login (hashed passwords, httpOnly session cookie) with **first-run setup**
- ✅ Admin adds students one by one **or via unified CSV** (students + per-student schedules in one file)
- ✅ Per-student schedules with a default template
- ✅ Admin writes/reads/blanks cards
- ✅ Attendance log with **CSV export**
- ✅ **Scoped API keys** — external apps (LMS integrations) can push students/schedules/attendance and read data over `POST/GET /api/v1/*`
- ❌ Not yet: real NFC reader (companion service), multiple terminals, analytics

---

## Tech stack

- **Next.js 16** (App Router) — pages + REST API routes
- **PostgreSQL** — storage, via **Prisma**
- **Tailwind CSS v4** — styling (`@tailwindcss/postcss`)
- **Auth** — jose JWT sessions (httpOnly cookie) + bcryptjs; API keys are `tp_…` with scoped access, SHA-256-hashed at rest

---

## Setup

```
docker run -d --name tapin-postgres \
  -e POSTGRES_USER=tapin -e POSTGRES_PASSWORD=tapin_dev_pw -e POSTGRES_DB=tapin \
  -p 5434:5432 postgres:16-alpine
```

```
cp .env.example .env        # set DATABASE_URL + AUTH_SECRET
pnpm install
pnpm db:migrate             # apply schema
pnpm db:seed                # load roster from prisma/data/*.csv (resets students/schedules)
pnpm dev                    # http://0.0.0.0:8443
```

First load → **create the admin account** (`/setup`), then sign in at `/login`.

**Kiosk vs Admin:** `/terminal` (and `/`) is a public, login-free tap kiosk with no admin buttons. Admin lives at `/admin` — `src/proxy.ts` (Next middleware) redirects it to `/login` whenever the session cookie is missing/expired, so entering admin always requires the password.

### Seeding real data

Fill in the roster CSVs under `prisma/data/`, then run `pnpm db:seed` (re-runnable — resets students, schedules, attendance and API keys, keeps the admin account):

- `students.csv` — `name,student_id,status`
- `schedules.csv` — leave `student_id` empty for the default template, or set a per-student week (`student_id,day,start,end,minimum_minutes`)
- `attendance.csv` — optional historical backfill (`student_id,date,clock_in,clock_out,duration_minutes,status,source`)

Each file ships with commented example rows.

---

## REST API for external apps (LMS integrations)

All `/api/v1/*` endpoints require `Authorization: Bearer tp_…` (or the admin session). Exception: the public tap kiosk — `GET /students`, `GET /schedule`, `GET /sessions`, `POST /taps` accept anonymous requests (sanitized; see `docs/API.md`). Admin (`/admin`) always requires a password login.

Create keys in **Admin → API Keys** with a set of scopes:

| Scope | Grants |
|-------|--------|
| `students_read` / `students_write` | `GET/POST /api/v1/students`, `PATCH/DELETE /api/v1/students/[id]` |
| `schedules_read` / `schedules_write` | `GET/POST /api/v1/schedule`, `/api/v1/students/[id]/schedule` |
| `attendance_read` | `GET /api/v1/attendance`, `/api/v1/sessions`, `/api/v1/attendance/export` |
| `attendance_write` | `POST /api/v1/attendance` (push records) |
| `taps_write` | `POST /api/v1/taps` (real reader/companion taps) |
| `cards_write` | `POST /api/v1/cards` (write/blank) |

Example — fetch attendance:

```
curl -H "Authorization: Bearer tp_…" http://host/api/v1/attendance
```

Example — a companion NFC service posting a tap:

```
curl -X POST -H "Authorization: Bearer tp_…" \
  -H "Content-Type: application/json" \
  -d '{"card_id":"CARD-A1B2"}' \
  http://host/api/v1/taps
```

A missing scope returns `403`; an invalid/revoked key returns `401`.

---

## CSV imports

### Unified file — students + their schedules

```
name,student_id,status,day,start,end,minimum_minutes
Maria Santos,2024-001,active,monday,08:00,12:00,180
Maria Santos,2024-001,active,tuesday,08:00,12:00,180
Juan Cruz,2024-002,active,tuesday,13:00,17:00,120
```

- Rows **with** `name` + `student_id` create/update a student (and set that student's schedule for that day).
- Rows **without** a student set the **default template** schedule.
- Import from **Students** or **Schedule** pages, or `POST /api/v1/import` (requires `students_write`).

---

## Tap rules

| State | Tap result |
|-------|-----------|
| Not clocked in, inside schedule window | ✅ Clock in |
| Not clocked in, **outside** schedule window | ✅ Clock in (flagged **off-schedule**) |
| Clocked in, minimum time passed | ✅ Clock out |
| Clocked in, minimum time NOT passed | ❌ "X min remaining" |
| Unknown / inactive card | ❌ "Card not recognized" |
| Already completed today | ❌ "Session already complete" |

---

## Cards

The card holds only a marker + a random card ID. The real student mapping lives in the **database** — the card is just a key. Blanks wipe the mapping so a card is reusable. Even if someone rewrites/clones a card, it won't match any student.

---

## Dev notes

- Reader is **simulated** on the client (`src/reader.ts`). The real companion service will call `POST /api/v1/taps` with a `taps_write` key.
- Live tap feed is in-process (per server instance); `GET /api/v1/taps/recent` returns recent events.
- Verify with `npx tsc --noEmit` and `pnpm build`. Formatter is **prettier** (oxfmt is broken and must not be used).
