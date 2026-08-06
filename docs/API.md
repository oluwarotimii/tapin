# TapIn API — Developer Integration Guide

TapIn exposes a REST API so external applications (LMS, SIS, companion reader services, reporting tools) can push students & schedules and read/push attendance. This guide is for developers building those integrations.

---

## 1. Quick start

```
BASE_URL = https://your-tapin-host            # self-hosted
KEY      = tp_…                                # scoped API key (Admin → API Keys)
```

Fetch all students:

```bash
curl -H "Authorization: Bearer tp_…" \
  "$BASE_URL/api/v1/students"
```

Post a tap (used by a companion NFC reader service):

```bash
curl -X POST "$BASE_URL/api/v1/taps" \
  -H "Authorization: Bearer tp_…" \
  -H "Content-Type: application/json" \
  -d '{"card_id":"CARD-A1B2"}'
```

---

## 2. Authentication

Every `/api/v1/*` request requires a key in the `Authorization` header:

```
Authorization: Bearer tp_…
```

- Keys start with `tp_` and are created in **Admin → API Keys**.
- Each key has a **scope set** that gates endpoints. The web admin session is exempt (acts as full access).
- Keys are stored **SHA-256-hashed**; the raw key is shown **once** at creation. If lost, revoke and create a new one.

### Public kiosk endpoints

The tap kiosk (`/terminal`) is open to everyone without credentials, so a small subset of endpoints also accepts **anonymous** requests (no `Authorization` header, no session cookie). Presenting invalid credentials is still rejected. Anonymous callers get a sanitized view:

| Endpoint | Public access | Sanitization for anonymous callers |
|----------|---------------|------------------------------------|
| `GET /api/v1/students` | yes | no `cardId` / `schedule` fields |
| `GET /api/v1/schedule` | yes | n/a (default template only) |
| `GET /api/v1/sessions` | yes | no `cardId` field |
| `POST /api/v1/taps` | yes | n/a |

All other endpoints remain fully gated by the API key or the admin session.

| HTTP status | Meaning |
|-------------|---------|
| `401` | Missing header, invalid key, revoked key, or expired key |
| `403` | Valid key but missing a required scope (response includes the needed scope) |
| `400` | Malformed/validation-failed request body |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate `student_id`) |

---

## 3. Scopes

| Scope | Grants |
|-------|--------|
| `students_read` | `GET` students |
| `students_write` | `POST`/`PATCH`/`DELETE` students, `POST /import` |
| `schedules_read` | `GET` default & per-student schedules |
| `schedules_write` | `POST`/`DELETE` schedules |
| `attendance_read` | `GET` attendance, sessions, recent taps, CSV export |
| `attendance_write` | `POST /attendance` (push manual records) |
| `taps_write` | `POST /taps` (real reader taps) |
| `cards_write` | `POST /cards` (write/blank cards) |

> A key only needs the scopes it uses. An LMS that only **reads attendance** and **pushes schedules** would take `attendance_read` + `schedules_write`.

---

## 4. Endpoints

### 4.1 Students

**`GET /api/v1/students`** → `students_read`

```json
{ "students": [
  { "id": "cmshkazt30000restgqy9ha81",
    "studentId": "2024-001",
    "name": "Maria Santos",
    "status": "active",
    "cardId": "CARD-A1B2",
    "schedule": [
      { "id": "…", "day": "monday", "start": "08:00", "end": "12:00", "minimumMinutes": 180 }
    ] }
] }
```

**`POST /api/v1/students`** → `students_write`. Body:

```json
{ "name": "Maria Santos", "student_id": "2024-001", "status": "active" }
```

`status` optional (defaults `active`). Returns `201` with the created student, or `409` if `student_id` exists.

**`PATCH /api/v1/students/{id}`** → `students_write`. Body: any of `name`, `student_id`, `status`.

**`DELETE /api/v1/students/{id}`** → `students_write`. Cascades: schedule, attendance, active sessions.

> `id` is TapIn's internal id. `student_id` is the stable external id (usually from the LMS). Use `student_id` in your payloads and the API responses; map it back to your system.

---

### 4.2 Schedules

A schedule is a set of **day slots**. `minimumMinutes` is the minimum session length (the tap-out rule).

**Default template** (applies to students without their own schedule)

- `GET /api/v1/schedule` → `schedules_read`
- `POST /api/v1/schedule` → `schedules_write`, body:

```json
{ "day": "monday", "start": "08:00", "end": "17:00", "minimum_minutes": 120 }
```

- `DELETE /api/v1/schedule/{day}` → `schedules_write`

**Per-student**

- `GET /api/v1/students/{id}/schedule` → `schedules_read`
- `POST /api/v1/students/{id}/schedule` → `schedules_write` (same body as above)
- `DELETE /api/v1/students/{id}/schedule?day=monday` → `schedules_write`
- `POST /api/v1/students/{id}/schedule/copy` → `schedules_write` (copies the default template into the student's week)

Days: `sunday`…`saturday`. Times are 24h `HH:MM`.

---

### 4.3 Attendance

**`GET /api/v1/attendance`** → `attendance_read`. Optional query filters:

```
?date=2026-08-06          # one day
?student_id=2024-001      # one student
```

```json
{ "attendance": [
  { "id": "…",
    "studentId": "2024-001",
    "studentName": "Maria Santos",
    "date": "2026-08-06",
    "clockIn": "08:03",
    "clockOut": "11:01",
    "durationMinutes": 178,
    "status": "complete",        // complete | incomplete | in_progress
    "override": false,           // true = accepted off-schedule
    "source": "tap" }            // tap | api | seed | …
] }
```

**`POST /api/v1/attendance`** → `attendance_write` — push a record from an external system (e.g. historical import). Body:

```json
{
  "student_id": "2024-001",
  "date": "2026-08-06",
  "clock_in": "08:00",
  "clock_out": "16:30",
  "status": "complete",      // optional; defaults to complete if clock_out set
  "source": "lms"            // optional label
}
```

`clock_out`, `duration_minutes`, `status`, `override`, `source` are optional. Upserted on `(student_id, date)` — one record per student per day.

**`GET /api/v1/attendance/export`** → `attendance_read`. Returns `text/csv`:

```
date,student_id,name,clock_in,clock_out,duration_minutes,status,override,source
```

---

### 4.4 Taps (the reader hook)

**`POST /api/v1/taps`** → `taps_write`. A real companion NFC service (or the web demo reader) posts a card tap; the server runs the tap rules and records attendance.

```json
{ "card_id": "CARD-A1B2" }
```

Response — the `result` is a discriminated union:

| `kind` | Meaning |
|--------|---------|
| `clocked_in` | Clocked in. `override: true` if outside the schedule window (accepted & flagged). |
| `clocked_out` | Clocked out; `durationMinutes` = session length. |
| `too_early` | Still clocked in; `remainingMinutes` until they can leave. |
| `already_complete` | Session already completed today. |
| `not_recognized` | Unknown or inactive card. |

```json
{ "result": { "kind": "clocked_in",
              "student": { "studentId": "2024-001", "name": "Maria Santos" },
              "override": false } }
```

**`GET /api/v1/taps/recent`** → `attendance_read`. Last ~60 tap events (in-process, per server instance):

```json
{ "taps": [ { "id": "…", "cardId": "CARD-A1B2",
              "result": { "kind": "clocked_in", … },
              "time": "14:38:09", "source": "api_key" } ] }
```

Useful for a dashboard/live feed, or to verify a tap landed.

**`GET /api/v1/sessions`** → `attendance_read`. Currently clocked-in students:

```json
{ "sessions": [ { "studentId": "…", "cardId": "CARD-A1B2",
                  "clockedInAt": "2026-08-06T14:38:08.715Z",
                  "studentName": "Maria Santos" } ] }
```

---

### 4.5 Cards

**`POST /api/v1/cards`** → `cards_write`. Assign a card to a student:

```json
{ "student_id": "2024-001", "card_id": "CARD-A1B2" }
```

Blank/reuse a card:

```json
{ "blank": true, "card_id": "CARD-A1B2" }
```

---

### 4.6 CSV import (bulk)

**`POST /api/v1/import`** → `students_write`. Body is raw CSV text (`Content-Type: text/plain`). One file can contain students **and** schedules:

```csv
name,student_id,status,day,start,end,minimum_minutes
Maria Santos,2024-001,active,monday,08:00,12:00,180
Maria Santos,2024-001,active,tuesday,08:00,12:00,180
Juan Cruz,2024-002,active,tuesday,13:00,17:00,120
```

- Rows **with** `name` + `student_id` create/update the student and set that student's schedule slot for that day.
- Rows **without** a student set the **default template** slot.
- Upsert semantics: existing `student_id`s are updated, new ones created.

Response:

```json
{ "result": { "students": 2, "slots": 3, "defaultSlots": 1 } }
```

Download the matching template files from the **Students** or **Schedule** page (Template ▾ dropdown).

---

## 5. Tap rules (what the server decides)

| State | Result |
|-------|--------|
| Not clocked in, inside schedule window | `clocked_in` |
| Not clocked in, **outside** window | `clocked_in` with `override: true` (auto-accepted, flagged) |
| Clocked in, elapsed ≥ `minimumMinutes` | `clocked_out` |
| Clocked in, elapsed < `minimumMinutes` | `too_early` |
| Unknown / inactive card | `not_recognized` |
| Already completed today | `already_complete` |

---

## 6. Worked examples

### Python (requests)

```python
import requests

BASE = "https://host"
KEY = "tp_…"
H = {"Authorization": f"Bearer {KEY}"}

students = requests.get(f"{BASE}/api/v1/students", headers=H).json()["students"]

r = requests.post(
    f"{BASE}/api/v1/attendance",
    headers={**H, "Content-Type": "application/json"},
    json={"student_id": "2024-001", "date": "2026-08-06",
          "clock_in": "08:00", "clock_out": "16:30", "source": "lms"},
)
assert r.status_code == 201, r.json()
```

### Node.js

```js
const KEY = "tp_…"
const H = {
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "application/json",
}

// Push today's roster + schedules
await fetch(`${BASE}/api/v1/import`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "text/plain" },
  body: csvText,
})

// Read attendance each morning
const res = await fetch(`${BASE}/api/v1/attendance?date=${today}`, { headers: H })
const { attendance } = await res.json()
```

### Companion reader service (pseudo)

```js
nfcReader.on("card", ({ id }) => {
  fetch(`${BASE}/api/v1/taps`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: id }),
  })
    .then((r) => r.json())
    .then(({ result }) => speak(tapFeedback(result)))
})
```

---

## 7. Design notes / conventions

- **IDs**: use `student_id` (stable external id) in payloads. `id` is internal and may change.
- **Times**: 24h `HH:MM` local. **Dates**: `YYYY-MM-DD` local.
- **One attendance record per student per day**; `POST /attendance` upserts.
- **Errors**: always `{ "error": "message" }`.
- **Off-schedule taps are accepted** and flagged `override` — your LMS should treat `override: true` as "accepted outside normal schedule" rather than an error.
- **Live feed**: `GET /api/v1/taps/recent` is in-process memory (single instance). For multi-instance deploys it should move to the DB/Redis.

---

## 8. Local development

```bash
pnpm install
pnpm db:migrate     # apply schema
pnpm db:seed        # load roster from prisma/data/*.csv
pnpm dev            # http://0.0.0.0:8443
```

`db:seed` reads `prisma/data/students.csv`, `schedules.csv` and (optionally) `attendance.csv` and **resets** the roster — students, schedules, attendance and API keys are wiped, the admin account is preserved. Each CSV ships with commented example rows; empty `student_id` in `schedules.csv` sets the default template applied to every student without their own schedule.

1. Open `http://localhost:8443` → first-run setup creates the admin account. The `/terminal` kiosk is public; `/admin` is gated by middleware and redirects to `/login` (password) when unauthenticated.
2. **Admin → API Keys** → create a key with the scopes you need.
3. Point your integration at `http://localhost:8443` with `Authorization: Bearer tp_…`.

Swagger/OpenAPI: not yet shipped — the endpoint list above is the contract.
