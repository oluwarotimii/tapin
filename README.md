# TapIn — Solo Version (v1)

Tap-and-go RFID attendance. Student taps card → clock in. Taps again after their scheduled minimum time → clock out. Built for **one terminal, one admin, one schedule**.

> Full product details: [PRD.md](./PRD.md) · Feasibility breakdown: [GAPS.md](./GAPS.md)

---

## What this version does

- ✅ Tap in / tap out with automatic validation (schedule window + minimum session length)
- ✅ Admin adds students (one by one **or via CSV**)
- ✅ Admin sets the schedule (one for everyone) **or imports it via CSV**
- ✅ Admin writes student details onto the card, reads a card, and blanks/reuses a card
- ✅ Attendance log with **CSV export** (LMS handoff later)
- ❌ Not yet: LMS integration, multiple terminals, groups, analytics

---

## Hardware & setup (what you need)

| Item | Example | Notes |
|------|---------|-------|
| USB NFC reader | ACR122U, PN532, or any PC/SC reader | Plug-and-play at OS level |
| Cards | **NTAG213** (recommended) or MIFARE Classic 1K | NTAG = simplest, no keys |
| PC / Raspberry Pi | Any machine with USB | Runs the app + companion service |
| nfc-pcsc driver | `nfc-pcsc` (Node) | The bridge between browser and reader |

> The browser cannot talk to the reader directly. A small **companion service** runs on the same PC as the reader and relays taps + card read/write commands to the web app over localhost.

---

## CSV imports

### Students CSV (`students.csv`)
```
name,student_id,status
Maria Santos,2024-001,active
Juan Cruz,2024-002,active
Ana Reyes,2024-003,inactive
```
- `name` — required
- `student_id` — required, must be unique
- `status` — optional, defaults to `active` (`active` or `inactive`)

### Schedule CSV (`schedule.csv`)
```
day,start,end,minimum_minutes
monday,08:00,17:00,180
tuesday,08:00,17:00,180
saturday,09:00,12:00,120
```
- `day` — monday…sunday
- `start` / `end` — 24h clock-in window (`HH:MM`)
- `minimum_minutes` — **the tap-out rule**: student cannot clock out until this many minutes have passed since clock-in (e.g. `180` = 3 hours, `120` = 2 hours)

> On the **Students** page: *Import CSV*. On the **Schedule** page: *Import CSV*. Format columns exactly as above.

---

## Cards — write, read, blank, reuse

The card stores a small record only:

```
[ TapIn marker ] [ student card ID ]
```

The student's real info (name, student ID) lives in the **database**. The card is just a key.

### Write a card
1. Admin → **Cards** screen
2. Choose student (from list, or type student ID)
3. Hold card on reader → *"Card detected"*
4. Click **Write** → confirmation shown
5. Card now linked to that student

### Read a card
1. **Cards** screen → **Read**
2. Hold card on reader
3. Shows: marker (is it a TapIn card?), card ID, linked student (if any)

### Blank / reuse a card
1. **Cards** screen → **Blank**
2. Hold card on reader
3. Card ID is wiped → card is reusable for a different student

---

## Card reusability — how it works (important)

Cards are **reusable by design**. Every blank simply wipes the stored card ID.

One trade-off to know:

> A card you can rewrite is a card **anyone** with a reader *could* rewrite.

That's why the card only holds a random ID and the student mapping stays in your DB. Even if someone rewrites or clones a card, it won't match any student in your database — it just stops working. That's the safety model.

If you want *stronger* protection later:
- **MIFARE Classic keys** — secret write keys, cards stay reusable, but only devices holding the key can write.
- **NTAG permanent write-lock** — irreversible lock; nobody (not even you) can rewrite; card becomes single-use.

For solo v1, keep cards writable + DB-as-truth. It's the right balance.

---

## Screens (for Figma/React)

1. **Login** — admin password only
2. **Terminal** — the big always-on tap screen (clock, status, last events)
3. **Students** — list, add/edit, deactivate, CSV import, link/write card
4. **Cards** — write / read / blank a card
5. **Schedule** — set day/window/minimum time, CSV import
6. **Attendance Log** — filter, view, export CSV
7. **Admin shell** — sidebar nav shared by pages 3–6

---

## Tap rules (what the app decides on each tap)

| State | Tap result |
|-------|-----------|
| Not clocked in, inside schedule window | ✅ Clock in |
| Clocked in, minimum time passed | ✅ Clock out |
| Clocked in, minimum time NOT passed | ❌ "X min remaining" |
| Not clocked in, outside schedule | ❌ "No session right now" |
| Unknown / inactive card | ❌ "Card not recognized" |
| Already completed today | ❌ "Session already complete" |

---

## Data & export

- Every tap is logged: timestamp, card, student, action, status, reason
- **Attendance Log** → **Export CSV** (`attendance.csv`):
  ```
  date,student_id,name,clock_in,clock_out,duration_minutes,status
  2026-08-05,2024-001,Maria Santos,08:03,11:01,178,complete
  ```

---

## Dev notes / tech stack

- **Next.js** (App Router) — UI + API routes
- **SQLite** — storage (Postgres later)
- **nfc-pcsc** (Node) — companion service for the reader
- **WebSocket / HTTP on localhost** — companion app ↔ web app
- **Tailwind** — UI styling

Suggested build order: Terminal + tap flow → rules engine → Students → Schedule → CSV → Cards → Log/export.
