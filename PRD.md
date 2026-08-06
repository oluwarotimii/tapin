# TapIn — Product Requirements Document (v1)

> Tap-and-go RFID attendance system for students. Two taps = one session (clock in / clock out).
> Built with Next.js + a local NFC reader companion service.

---

## 1. Problem

Schools track student attendance manually or with old paper logs. Teachers waste time, records are unreliable, and there is no clean data feed for the school's LMS.

## 2. Goal

A simple, fast **tap-and-go attendance terminal**:

- Student taps card → **Clock in**
- Student taps card again after their session → **Clock out**
- A **schedule** defines allowed time windows (e.g. 2h or 3h study sessions)
- Student **must complete the minimum session time** before clock-out is allowed (e.g. must stay 3h, cannot clock out early)
- Admin can add students, write/read/clear cards, and manage schedules

## 3. Core Concept

| Tap | Action |
|-----|--------|
| 1st tap of the day | Clock in (if within a scheduled slot) |
| 2nd tap | Clock out (only if minimum session time has passed) |
| Tap while already clocked out / outside schedule | Rejected with reason shown on screen |

The hardware does not decide anything. **The web app decides** — the card just carries a student ID.

## 4. Scope (v1)

### In scope
- Student card tap → clock in / clock out with validation
- Schedule definition (days, time windows, minimum session duration)
- Minimum-time rule: cannot clock out before minimum duration elapses
- Admin: add/edit/deactivate students
- Admin: write student ID + details to card, read a card, blank/erase a card
- On-screen feedback: name, action, success / rejection reason
- Live session list & today's attendance log
- Local terminal mode (companion service on the PC with the reader)

### Out of scope (later)
- LMS integration API (attendance export, schedule import via CSV/API)
- Multi-terminal sync, dashboards/analytics, notifications
- Mobile app, biometrics, payments

## 5. Users & Roles

| Role | What they do |
|------|--------------|
| **Student** | Taps card at terminal |
| **Admin / Staff** | Runs terminal, adds students, writes cards, manages schedules, reviews attendance |
| **System** | Companion app + web app + database |

## 6. Functional Requirements

### 6.1 Attendance flow
- `FR-1` System reads card UID from reader.
- `FR-2` System looks up student by card ID in DB.
- `FR-3` Unknown / inactive card → reject, show message.
- `FR-4` No matching schedule slot now → reject, show message.
- `FR-5` Student not clocked in → clock in, record start time.
- `FR-6` Student clocked in and minimum session time has passed → clock out, record end time + duration.
- `FR-7` Student clocked in but minimum time NOT met → reject with "time remaining" shown.
- `FR-8` Student taps a 3rd time in a day → reject (session already complete).
- `FR-9` Every action is logged (timestamp, card, student, decision, reason).

### 6.2 Schedules
- `FR-10` Admin defines schedule slots: day(s) of week, start time, end time, minimum duration.
- `FR-11` A slot applies to all students (v1) or per group (stretch).
- `FR-12` Clock-in only allowed inside an active slot.
- `FR-13` Clock-out allowed only after `minimum duration` since clock-in.

### 6.3 Admin — students
- `FR-14` CRUD students: name, student ID, group, status (active/inactive).
- `FR-15` Assign a card ID to a student, or unassign.

### 6.4 Admin — card operations (needs companion app / reader)
- `FR-16` Write card: encode card with student ID + marker (see Security).
- `FR-17` Read card: show what is stored.
- `FR-18` Blank card: erase data (reset / mark empty).
- `FR-19` All card writes require an admin action (no silent auto-writes).

### 6.5 Terminal UX
- `FR-20` Large always-on screen: clock, status "Ready for tap", last result.
- `FR-21` Clear feedback: green = success, red = rejected, with reason.
- `FR-22` Audio/visual beep on success vs reject (optional hardware).
- `FR-23` Offline-tolerant: queue taps locally if server briefly unreachable, sync later.

### 6.6 Data & reporting
- `FR-24` Today's log, history per student, per date range.
- `FR-25` Export attendance as CSV (v1 minimum for LMS handoff).

## 7. Non-Functional Requirements

- `NFR-1` Tap → feedback under **2 seconds**.
- `NFR-2` Companion app auto-reconnects to the web app.
- `NFR-3` Card write operations are admin-only and logged.
- `NFR-4` Backups: DB exportable/restorable.

## 8. Technical Architecture (draft)

```
[NFC Card] --> [USB NFC Reader] --> [Companion app (Node, nfc-pcsc)]
                                          |
                                   WebSocket / HTTP (localhost)
                                          |
                                   [Next.js API routes]
                                          |
                              [Database: SQLite/Postgres] + [Schedules]
                                          |
                                   [Admin UI (Next.js)]
```

- **Next.js** — UI + API routes (`/api/taps`, `/api/students`, `/api/schedules`, `/api/cards`)
- **Companion app** — runs on the PC with the reader; sends tap events (card UID) and performs read/write/blank card operations on command
- **DB** — SQLite to start (zero config), Postgres when multi-terminal
- **Auth** — admin login (single admin or email/password), session cookies
- **Security** — see GAPS.md §3

## 9. Milestones

| Milestone | Deliverable |
|-----------|-------------|
| **M1** — Reader + tap flow | Companion app reads cards; tap-in/tap-out works with hardcoded students; SQLite DB |
| **M2** — Rules engine | Schedules + minimum-duration validation + rejection reasons |
| **M3** — Admin | Students CRUD, schedule management, attendance log/export |
| **M4** — Card writing | Write/read/blank card from admin UI; card security keys set |
| **M5** — Polish | Terminal UX, offline queue, error handling, deploy |

## 10. Success Metrics

- Time from tap to feedback < 2s
- No false clock-outs before minimum duration
- Zero lost attendance records
- Admin can onboard a new student + write a card in < 1 minute

## 11. Open Questions

- Session time rule: minimum only, or also maximum (auto clock-out)? (v1 = minimum only)
- Are all students on one schedule, or per group?
- Should "clock in" be limited to one per day even if student leaves and returns? (v1 = yes, one session/day)
- Which exact card model? NTAG213/215 (simpler, lockable) vs MIFARE Classic 1K (key-based) — recommend NTAG for simplicity.
