# TapIn — Gaps & Feasibility Document

Breaks down every part of the idea, rates how feasible it is, and flags the gaps you need to close.

**Rating scale:** 🟢 Feasible today | 🟡 Feasible with effort/decisions | 🔴 Hard / has real risk

---

## 1. Web app + tap-to-record flow (clock in / clock out)

**Verdict: 🟢 Feasible**

Two taps = one session is a simple state machine:
- Not clocked in → tap = clock in
- Clocked in + min time met → tap = clock out
- Else → reject

This is pure server logic (Next.js API routes + DB). No gap. The only decisions: one session/day or multi-session, and whether late-to-slot matters.

---

## 2. "Built with Next.js"

**Verdict: 🟢 Feasible**

Next.js gives you the admin UI, API routes (`/api/...`), and can serve the terminal screen. **Gap:** browsers cannot natively talk to a USB NFC reader. You need a small local **companion service** (Node.js + `nfc-pcsc`, running where the reader is plugged in) that relays taps and card read/write commands. Two components, not one — but both straightforward.

**Alternatives that avoid the companion app:**
- **Keyboard-wedge reader** → card UID is "typed" like a keyboard into a focused input. Zero custom driver code. Cheap and reliable.
- **Web NFC API** → Chrome/Android only, NDEF-only (not raw card memory). Not enough for card writing/locking. Skip.

---

## 3. "Plug-and-play NFC reader and writer"

**Verdict: 🟢 hardware is plug-and-play, 🟡 software is not**

- USB readers (ACR122U, PN532, generic PC/SC) are plug-and-play at the OS level.
- The **NFC tools app / libnfc / nfc-pcsc** then exposes them.
- Real plug-and-play in a web browser does **not** exist. Accept the companion-app pattern (or keyboard-wedge). This is the biggest architectural gap to embrace, not fight.

---

## 4. Writing student details to the card

**Verdict: 🟢 Feasible**

Two card types:
- **NTAG (Ultralight/NTAG213/215):** simple memory pages, no keys needed, easy to write, and **permanently lockable**.
- **MIFARE Classic 1K:** needs sector keys (Key A/B) to write; more setup, more secure write control.

**Recommendation:** NTAG213. Write the card with: student ID + a random check value. Read-back to verify. `nfc-pcsc` handles both.

**Gap (design decision):** *what* exactly goes on the card. Recommend storing **only a random card ID** and keeping the student mapping in the DB — not the student's name on the card (privacy + flexibility). If you must write name/ID, that's still fine, just less flexible.

---

## 5. Clearing / blanking the card

**Verdict: 🟢 Feasible**

- Unlocked cards: write zeros / factory values back.
- **Caution:** a card that was *permanently write-locked* (see §6) **cannot be cleared** — that's the point of the lock. So decide the lifecycle:
  - **Lock cards after enrollment** → can never be rewritten/cleared. Most secure, but a card error = new card.
  - **Keep cards writable, protect by secret key** → can be erased/reissued, but a stolen key = anyone can write.
  - **Recommend:** keep writable in v1 (admin-only write via companion app), add permanent lock later if card reuse is not needed.

---

## 6. Preventing other devices from writing to the card

**Verdict: 🟡 Feasible — with the right card + honest expectations**

**What actually works:**
1. **Permanent write-lock (NTAG):** lock pages with an irreversible one-way bit. After locking, *nobody* can ever write, including you. Best for "no one else can write" but kills card reuse.
2. **Secret sector keys (MIFARE Classic):** only a device holding Key A/B can write. Anyone without the key is read-only. Reusable cards. Risk = key theft (mitigate: keep key only in companion app config, never in DB/browser).
3. **DB-as-truth pattern (do this regardless):** card stores only a random ID; the mapping lives in the DB. Even if an attacker rewrites a card, it won't match any student unless they know a valid card ID.

**Honest limits:**
- You **cannot** stop a determined attacker from **cloning** an existing card (physical copy with an NFC reader/writer). Encryption of card content doesn't stop copying — it only stops *reading* content.
- You **cannot** retroactively lock a card that was never locked.

**Bottom line:** write-lock (NTAG) or keys (MIFARE) + DB-as-truth = "no *casual* device can write." That's the realistic security bar.

---

## 7. Schedule-driven validation (min 2h/3h before clock-out)

**Verdict: 🟢 Feasible**

Simple: when the 2nd tap happens, compare `now − clockInTime` to `schedule.minimumDuration`. Reject if under, with "X min remaining." Time windows for clock-in are a simple `start/end` per day-of-week. No gap.

---

## 8. Admin feature: add student + write/clear cards

**Verdict: 🟢 Feasible**

Standard CRUD UI in Next.js + card operations routed to the companion app. All card writes admin-only and logged. **Gap:** decide admin auth (single admin password vs. email/password) and whether any staff role exists.

---

## 9. Future: LMS integration (attendance export + schedule import)

**Verdict: 🟢 Feasible (build for it now)**

- **Export:** CSV endpoint today (FR-25), REST/Webhook later. Build attendance records as immutable events now so the export is trivial later.
- **Import schedules via API/CSV:** design schedules table around an importable shape (day, start, end, min duration, group) now.
- **Gap:** *which* LMS? Unknown. Design a generic adapter interface, fill in specifics later.

---

## 10. Overall feasibility

| Part | Verdict |
|------|---------|
| Next.js web app + API | 🟢 |
| Tap in/out state machine + rules | 🟢 |
| Schedule windows + minimum duration | 🟢 |
| USB NFC reader (hardware) | 🟢 |
| Browser ↔ reader bridge | 🟡 (companion app or keyboard-wedge) |
| Write student data to card | 🟢 (NTAG recommended) |
| Blank/clear card | 🟢 (unless locked) |
| Block other writers | 🟡 (lock or keys; cloning not fully preventable) |
| Admin: students + card ops | 🟢 |
| Attendance CSV export | 🟢 |
| LMS schedule import (API/CSV) | 🟡 (needs LMS details) |

**Overall: 🟢 Green.** No part of this idea is a research problem. Everything exists as off-the-shelf libraries. The only "engineering" work is the companion-app bridge, the rules engine, and the card-security decision — all small.

## 11. Biggest risks / gaps to decide early

1. **Companion app or keyboard-wedge reader?** (determines all card-write UX)
2. **Card model:** NTAG (simple, lockable) vs MIFARE Classic (keys, reusable)
3. **Card lifecycle:** writable+keyed vs permanently locked
4. **Session model:** one session/day vs open-close multiple
5. **Which LMS?** only matters when you get to M6
6. **PC availability at the tap point** — the reader is USB, so a dedicated PC/Raspberry Pi runs it. (Raspberry Pi is a great fit: run the companion app headless.)

## 12. Suggested stack (final)

- Next.js (App Router) — UI + API
- SQLite → Postgres — storage
- `nfc-pcsc` (Node) — companion tap/read/write service
- ACR122U or PN532 reader — hardware
- NTAG213 cards — recommended
- local WebSocket between companion app and Next.js (or plain HTTP POST per tap)
- Tailwind for the terminal/admin UI
