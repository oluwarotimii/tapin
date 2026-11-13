# ZKTeco UA300 → TapIn via ADMS (push) protocol

Status: **receiver implemented, ready for device testing.** The terminal keeps
its own fingerprint templates and performs 1:N matching on-device; TapIn only
receives the resulting attendance punches and applies the normal tap rules.

This is the hardware path for "place finger → attendance recorded" without a
browser: the UA300 identifies the student itself, then pushes the punch to us
over the network.

---

## 1. Architecture

```
UA300 (fingerprint 1:N on device)
   │  ADMS / push (HTTP, plain text)
   ▼
TapIn  /iclock/cdata  ──►  src/server/adms.ts
   │                          │  parse ATTLOG line
   │                          │  PIN → Student.studentId
   │                          │  dedupe (device, pin, timestamp)
   │                          ▼
   │                       tapByStudentIdAt()  ── same rules as kiosk
   ▼                          │
OK: <n>  ◄─────────────────────┘  AttendanceRecord + ActiveSession
```

The device pushes; TapIn never polls it. Fingerprint images/templates are
**not** sent to the server — only `PIN + timestamp (+ status/verify mode)`.

---

## 2. Endpoints (implemented)

ZKTeco firmware uses a fixed `/iclock/` prefix appended to the configured
Server Address.

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET  | `/iclock/cdata` | Handshake / options (`options=all`) | plain-text option block |
| POST | `/iclock/cdata?table=ATTLOG` | Attendance upload | `OK: <accepted>` |
| GET  | `/iclock/getrequest` | Command poll | `OK` (no pending commands) |
| POST | `/iclock/devicecmd` | Command result callback | `OK` |
| GET  | `/iclock/ping` | Liveness | `OK` |

All responses are `text/plain` — **not JSON**. The device only clears its
outbound queue when it receives an `OK...` body.

### ATTLOG format
One record per line, tab-separated:

```
PIN \t YYYY-MM-DD HH:mm:ss \t Status \t Verify \t WorkCode \t ...
1001 \t 2026-11-13 08:15:32 \t 0 \t 1 \t 0 \t 0 \t 0 \t 0
```

- `PIN` must equal the student's `Student.studentId` (the 4-digit school ID).
- `Status`/`Verify` are stored on `DevicePunch` for auditing; the clock-in/out
  toggle follows TapIn's own rules (`performTap`), not the device's status
  field, so behaviour matches the kiosk exactly.

---

## 3. Configure the UA300

On the terminal: **Comm → ADMS / Cloud Server Setting**

| Setting | Value |
|---------|-------|
| Server Mode | `ADMS` |
| Enable Domain Name | ON (if using a hostname) |
| Server Address | your public host, e.g. `attendance.example.com` |
| Server Port | `443` (HTTPS) or `80` (HTTP) — see §5 |
| Enable Proxy Server | OFF |

> **Do not point the device at a server until the receiver is deployed and
> reachable.** A misconfigured address makes the terminal retry forever.

Exact field names vary by firmware. Send a photo of the full ADMS screen
(including anything below Server Address) if a field doesn't match.

---

## 4. Prerequisites on the device

1. **Enroll fingerprints on the UA300 itself.** TapIn does not push templates
   to the device. Use the device's own user management.
2. **User IDs must equal `Student.studentId`.** When creating a user on the
   terminal, set the ID to the student's 4-digit school ID (e.g. `1001`). If
   the IDs don't match, punches are stored but resolve to `not_recognized`.
3. **Set the terminal clock and timezone** to match the server
   (`Asia/Manila`). Punch times are parsed as wall-clock local time.
4. **Enable real-time upload** if the firmware exposes it — the handshake
   already returns `Realtime=1`, which makes the device push each punch
   immediately.

---

## 5. HTTPS / TLS note

The ADMS protocol is plain HTTP. Most ZKTeco firmware **cannot verify modern
TLS certificates** (it rejects or ignores them), so pointing it at
`https://…:443` often fails the handshake.

Recommended: expose the receiver over **plain HTTP on a dedicated port** (or
behind a reverse proxy that terminates TLS and forwards to the app), and
restrict access at the network layer. Examples:

- Reverse proxy (nginx/caddy) with a rule that only proxies `/iclock/*` and
  strips TLS, or
- Firewall rule allowing the terminal's IP to reach the app's HTTP port.

If your firmware does support HTTPS with a trusted CA, use it — otherwise
plain HTTP + IP allowlisting is the pragmatic path.

---

## 6. Security

The `/iclock/*` endpoints are **unauthenticated** by design — the terminal
can't send a bearer token. Protect them with:

- **Serial allowlist** (recommended): set
  `ADMS_ALLOWED_SERIALS=<serial1>,<serial2>` in the app environment. Requests
  from any other serial get `403`. Find the serial under **Device Info** on
  the terminal.
- **Network allowlist**: only allow the terminal's IP(s) to reach `/iclock/*`.
- If `ADMS_ALLOWED_SERIALS` is unset, any serial is accepted and
  auto-registered — convenient for first-time setup, not for production.

`ADMS_DEVICE_NAME` optionally sets the display name for auto-registered
devices (default: "ZKTeco device").

---

## 7. Data model

- **`Device`** — one row per terminal (`serial` unique, `lastSeenAt`,
  `lastStamp`, `enabled`).
- **`DevicePunch`** — one row per ATTLOG line. Unique on
  `(deviceId, pin, punchedAt)`; this is the idempotency guard because ADMS
  re-sends unacknowledged batches. `result` records the applied
  `TapResult.kind`.

Admin read API: `GET /api/v1/devices` (admin session) returns registered
devices and the 50 most recent punches.

---

## 8. Behaviour & limitations

- **Time-aware**: a late-delivered batch is applied against the punch
  timestamp (`tapByStudentIdAt`), not the delivery time.
- **Duplicate-safe**: re-pushed punches are ignored.
- **Same rules as the kiosk**: first punch of the day clocks in, a later punch
  clocks out (subject to `minimumMinutes`); `too_early` prevents an immediate
  accidental clock-out.
- **Backlog import**: `Stamp` starts at 0, so the first sync may replay the
  device's stored log. Those punches are applied on their original dates.
  Clear `DevicePunch` / adjust attendance if that's undesirable.
- **Timezone**: server and terminal must share a timezone; otherwise punch
  times shift by the offset.
- **No command channel yet**: `/iclock/getrequest` returns `OK` (no commands).
  Remote enrollment/sync is not implemented — enrollment stays on-device.

---

## 9. Testing the receiver locally

```bash
# handshake
curl -s "http://localhost:8443/iclock/cdata?SN=TEST123&options=all&pushver=2.2.14"
# → GET OPTION FROM: TEST123 ... Realtime=1 ...

# push one punch (PIN must exist as a student's studentId)
printf '1001\t2026-11-13 08:15:32\t0\t1\t0\t0\t0\t0\n' \
  | curl -s -X POST --data-binary @- \
    "http://localhost:8443/iclock/cdata?SN=TEST123&table=ATTLOG&Stamp=1"
# → OK: 1
```

Then check `GET /api/v1/devices` (with an admin session) or the attendance
log for the new record. Re-posting the same punch should still return `OK`
but not create a second attendance change (deduped).
