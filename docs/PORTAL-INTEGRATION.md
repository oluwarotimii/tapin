# Syncing students from the school portal into TapIn

This is for whoever builds the integration on the school portal side. It
covers exactly one thing: when a student registers in the portal, how to get
them into TapIn automatically — no one re-types anything on either end.

## The call you need

```
POST https://tapin.femtechaccess.com.ng/api/v1/students
Authorization: Bearer tp_...
Content-Type: application/json

{
  "name": "Maria Santos",
  "student_id": "2024-001",
  "status": "active"
}
```

Call this once, right after you save a new student in your own system.
`status` is optional (defaults to `"active"`).

A successful call returns `201`:

```json
{ "student": { "id": "cmshkazt30000restgqy9ha81", "studentId": "2024-001", "name": "Maria Santos", "status": "active" } }
```

## About `student_id` — read this part carefully

You mentioned IDs might come in different formats, so to be clear:

- **`student_id` is a plain string on our end — no required format, length,
  or character set.** Numeric, alphanumeric, with dashes, whatever your
  system already uses — just send it as-is.
- **The only rule: once you pick a string for a student, always send that
  exact same string for them, every time, forever.** If you send
  `"2024001"` once and `"2024-001"` another time for the same person, TapIn
  sees two different students — there's no normalization on our side.
  Decide on one canonical format (presumably whatever your portal already
  uses as its own primary key for the student) and pass it through
  unchanged.
- It must be **unique per student**. Sending one that already exists
  returns `409 student_id already exists` — treat that as "already synced,"
  not a failure.
- This is **not** the same as TapIn's own internal `id` (the `cmshk...`
  string in the response) — you'll never need that one unless you're also
  calling the update/delete endpoints below, and even then only after first
  looking a student up.

## What happens after the student exists in TapIn

Nothing further is needed from the portal. The student can walk up to the
physical kiosk, tap their (unregistered) card, and a modal on-screen asks
for their student ID and links the card to their own record — self-service,
no admin step, no second API call.

## Auth

```
Authorization: Bearer tp_...
```

Get a key from **TapIn Admin → API Keys**, scoped to `students_write` (ask
for `students_read` too if you ever need to look students up, e.g. to check
whether one already exists before updating them).

## Error responses

| Status | Meaning |
|--------|---------|
| `400` | Malformed body — check `name` and `student_id` are present and non-empty |
| `401` | Missing/invalid/revoked API key |
| `403` | Key doesn't have the `students_write` scope |
| `409` | `student_id` already exists — not necessarily an error, see above |

Errors always look like `{ "error": "message" }`.

## Updating or deactivating a student later

These need TapIn's internal `id`, not your `student_id`, so look the
student up first:

```bash
curl -H "Authorization: Bearer tp_..." \
  "https://tapin.femtechaccess.com.ng/api/v1/students" \
  | jq '.students[] | select(.studentId == "2024-001")'
```

Then use that record's `id`:

```
PATCH /api/v1/students/{id}   — body: any of name, student_id, status
DELETE /api/v1/students/{id}  — removes the student and their attendance history
```

To deactivate someone without deleting their history, `PATCH` with
`{ "status": "inactive" }` instead of deleting.

## Minimal example (Node)

```js
const KEY = "tp_..."
const BASE = "https://tapin.femtechaccess.com.ng"

async function syncStudent(student) {
  const res = await fetch(`${BASE}/api/v1/students`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: student.fullName,
      student_id: String(student.id), // whatever your own primary key is
      status: student.active ? "active" : "inactive",
    }),
  })
  if (res.status === 409) return // already synced, not an error
  if (!res.ok) throw new Error(`TapIn sync failed: ${res.status}`)
}
```

---

Full API reference (schedules, attendance, taps, bulk CSV import, etc.) is
in `docs/API.md` if this integration grows beyond just syncing new students.
