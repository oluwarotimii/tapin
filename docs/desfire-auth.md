# DESFire AES challenge–response for TapIn taps

Design note for hardening card taps against cloning/forgery. This plugs into the
existing seam: a **companion service** talks to the physical NFC reader and POSTs
to `POST /api/v1/taps`. Nothing in the web app needs to do crypto.

---

## 1. Why, and what actually changes

### Trust model today

```
card ──(UID)──▶ reader ──▶ companion service ──POST {card_id}──▶ /api/v1/taps
                                                                     │
                                                    domain.tap(card_id): find Student
                                                    by cardId → clock in/out
```

`src/app/api/v1/taps/route.ts` trusts whatever `card_id` arrives. `card_id` is
the card **UID**, which every reader broadcasts before any authentication (see
`docs`/prior discussion). So:

- A "magic" card programmed with a real student's UID → **accepted**.
- Anyone who reads a UID once can replay it → **accepted**.

### Trust model with DESFire AES

The card proves it holds a secret **AES key** that never crosses the air, via a
3-pass mutual authentication. A clone that only copied the UID **cannot complete
the handshake**, so the companion service never emits a tap for it.

```
card ◀──AES 3-pass mutual auth──▶ reader/companion service   (secret stays local)
             │ auth OK
             ▼
   read protected card serial from card
             │
             ▼
   POST {card_id, [hmac attestation]} ──▶ /api/v1/taps   (over a taps_write API key)
```

The crypto happens **locally in the companion service**, because it's a
millisecond-level APDU conversation with the card. The server's job is unchanged
lookup logic — plus optional attestation checks (§6).

---

## 2. The DESFire AES 3-pass mutual authentication

Let `K` be the AES-128 key shared by card and reader for the TapIn application.

```
Reader                                   Card (DESFire)
  │  AuthenticateAES(keyNo)               │
  │──────────────────────────────────────▶│  generate RndB (16 random bytes)
  │             E_K(RndB)                  │
  │◀──────────────────────────────────────│
  │  decrypt → RndB                        │
  │  generate RndA (16 random bytes)       │
  │  RndB' = rotate_left(RndB, 1 byte)     │
  │        E_K(RndA ‖ RndB')               │
  │──────────────────────────────────────▶│  decrypt; verify RndB' == rotate(RndB)
  │                                        │  (proves READER knows K)
  │             E_K(RndA')                 │  RndA' = rotate_left(RndA, 1 byte)
  │◀──────────────────────────────────────│
  │  decrypt; verify RndA' == rotate(RndA) │
  │  (proves CARD knows K)                 │
  ▼                                        ▼
  Mutual auth complete.
  Session key = f(RndA, RndB); used to encrypt/MAC the follow-up read.
```

Key properties:

- **`K` never transmitted.** Only ciphertexts of fresh random nonces cross the air.
- **Mutual.** The reader also proves itself to the card, so a rogue reader can't
  quietly harvest card data either.
- **Replay-resistant.** Fresh `RndA`/`RndB` each session → captured traffic is
  useless.

You do **not** implement this by hand. A DESFire library drives the APDUs
(`AuthenticateAES`, `ChangeKey`, `ReadData`, …). See §7.

---

## 3. Key management — use diversification, not one shared key

**Do not** load the same `K` onto every card. If one card's key is extracted,
every card is forged. Instead derive a **per-card key** from a single master key
and the card's UID (NXP AN10922 / AES-CMAC diversification):

```
K_card = CMAC_AES(K_master, diversification_input(UID, AID, ...))
```

- Only **`K_master`** lives in the companion service (env var / OS keystore /
  ideally an HSM or a smartcard SAM). It is **never** on a card, never in the
  browser, never in the Next app, never in the DB.
- At tap time the service derives `K_card` on the fly from the UID it just read,
  then runs the §2 handshake with it.
- Extracting one card's `K_card` compromises **only that card**; `K_master`
  stays safe.

Rotate `K_master` by giving it a version byte in the diversification input and
supporting the previous version during a re-issuance window.

---

## 4. Card issuance / personalization (replaces `reader.writeCard`)

A fresh DESFire card ships with a default PICC master key (16 zero bytes). Enroll
each card **once**, at an admin station, before handing it out:

```
1. AuthenticateAES(PICC master, default key)          # 0x00…00 on blank card
2. ChangeKey(PICC master → K_picc)                     # your own PICC master
3. CreateApplication(AID = TAPIN, keySettings, #keys)  # dedicated app for TapIn
4. SelectApplication(AID)
5. AuthenticateAES(app master, default)
6. K_card = diversify(K_master, UID)                   # §3
7. ChangeKey(app key 0 → K_card)                       # lock the app to this card
8. CreateStdDataFile(fileNo, size, accessRights)       # read requires app auth
9. WriteData(fileNo, card_serial)                      # your own stable serial
10. (optional) SetConfiguration(Random ID = on)        # hide real UID; see §8
11. Record Student.cardId = <card_serial or UID> in DB
```

Notes:

- Steps 1–10 are the **companion service in "enroll" mode**, driven from
  **Admin → the card tooling** (today `reader.writeCard(cardId, studentId)` in
  `src/reader.ts`, which currently just calls `db.writeCard`). The real service
  performs the APDU sequence above and then calls the existing
  `PATCH`/write-card API to persist the mapping.
- The value you store in `Student.cardId` can be the UID **or** a serial you
  write into the protected file in step 9. If you enable Random ID (§8), you
  **must** use a written serial (step 9), because the UID is no longer stable.

---

## 5. Tap-time flow, end to end

```
┌ Companion service (local, holds K_master) ─────────────────────────┐
│ 1. Card enters field → read UID (anti-collision)                   │
│ 2. K_card = diversify(K_master, UID)                               │
│ 3. SelectApplication(TAPIN); AuthenticateAES(0, K_card)   ── §2    │
│      └─ fails → DROP. No POST. (clone / foreign card)              │
│ 4. ReadData(fileNo)  → card_serial   (encrypted under session key) │
│ 5. build body { card_id: card_serial }                            │
│ 6. (optional) attestation: hmac, nonce, ts   ── §6                │
│ 7. POST /api/v1/taps  with  Authorization: Bearer tp_<readerkey>  │
└────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    /api/v1/taps  (unchanged core)
                    authorizeRequest(req, ["taps_write"])   ← see §6
                    domain.tap(card_id, "api_key")
                       find Student by cardId → clock in/out
```

The web app's `domain.tap()` logic is **untouched**. The card's authenticity is
established before the POST ever happens.

---

## 6. Server-side hardening (optional but recommended)

The AES handshake proves the **card** is genuine to the **reader**. It does *not*
by itself prove to the *server* that a genuine reader sent the POST. Two levels:

### 6a. Require an API key, drop `allowPublic` for real readers

`taps/route.ts` currently calls `authorizeRequest(req, ["taps_write"], { allowPublic: true })`.
`allowPublic` exists for the login-free kiosk (real HID card taps, no admin
session). For a hardware reader wired through a companion service instead:

- Issue the companion service a dedicated **`taps_write`** API key
  (Admin → API Keys). Only holders of a valid key can POST.
- In production, either drop `allowPublic` here, or keep it but **flag**
  `auth.type === "public"` taps distinctly (e.g. `source: "public"` already
  differs from `"api_key"`) and consider rejecting them once every reader uses a
  key.

### 6b. Per-tap attestation (defends against a captured/replayed POST)

Give the companion service a **reader secret** `S` (separate from the API key).
Extend the tap body:

```jsonc
{
  "card_id": "TAPIN-000123",
  "auth": {
    "nonce": "<random per tap>",
    "ts": 1723377600,                 // unix seconds
    "mac": "<hex HMAC-SHA256>"        // HMAC_S(card_id . nonce . ts)
  }
}
```

Server verification (new, small):

1. `ts` within ±60s of now (clock-skew window).
2. `nonce` unseen (store recent nonces; TTL = skew window; see schema note).
3. `mac == HMAC_SHA256(S, `${card_id}.${nonce}.${ts}`)`.

This makes a sniffed/re-sent POST non-replayable and ties each tap to a machine
holding `S`. It's belt-and-suspenders over the API key; adopt it if a stolen key
is in your threat model.

`src/lib/validation.ts` change — make `tapRequest.auth` optional so the kiosk and
early readers keep working:

```ts
export const tapRequest = z.object({
  card_id: z.string().min(1).max(100),
  auth: z
    .object({
      nonce: z.string().min(8).max(64),
      ts: z.number().int(),
      mac: z.string().length(64),
    })
    .optional(),
})
```

Schema note: a nonce store can be an in-memory LRU in the Next process for a
single instance, or a small `TapNonce { nonce @id, seenAt }` table / Redis key
with TTL if you run multiple instances.

---

## 7. Hardware & library reality check (nfcPro)

`nfcPro.exe` from nsccn.com is a **Windows GUI tool** — good for eyeballing
cards, not for embedding in a service. For the companion service you need
**programmatic** access:

- **Confirm the reader is PC/SC (WinSCard / CCID) compliant.** Most USB NFC
  readers are. If so, you can drive it from any language via PC/SC.
- Pick a DESFire-capable library so you don't hand-roll APDUs:
  - **Node** (matches your stack): `nfc-pcsc` for transport + a DESFire/AES
    layer (e.g. a `mifare-desfire` helper or `node-forge`/`node:crypto` AES for
    the handshake math).
  - **C / Linux**: `libfreefare` on top of `libnfc` — mature DESFire AES support
    (`mifare_desfire_authenticate_aes`, `mifare_desfire_read_data`, etc.).
  - The vendor's own **SDK/DLL** if nfcPro ships one — check the download for a
    developer package; the GUI alone won't expose the APDU layer.
- If the reader is **HID-keyboard-wedge only** (types the UID as keystrokes), it
  **cannot** do DESFire AES — it only ever exposes the UID. You'd need a PC/SC
  reader to do real authentication. Verify this first; it's the make-or-break.

**Action item for you:** determine whether your nsccn reader exposes PC/SC + an
SDK, or is keyboard-wedge only. Everything above assumes PC/SC. If it's
wedge-only, the hardware caps you at UID-level and you'd swap to a PC/SC reader
(e.g. ACR122U-class) to get AES.

---

## 8. Random ID (hiding the real UID)

DESFire can broadcast a **random UID** each tap (`SetConfiguration`, Random ID
on). Then:

- Unauthorized readers see a meaningless, changing number → real identity hidden.
- You **must** authenticate first, then read the **written serial** (§4 step 9)
  to identify the card — the UID is no longer a stable key.
- Diversification input (§3) must then use the written serial or the post-auth
  real UID (`GetCardUID`), not the random anti-collision UID.

Only enable this if unlinkability matters (privacy / anti-tracking). For pure
attendance it's optional.

---

## 9. What this does and does not protect against

| Threat | Protected? | By what |
| --- | --- | --- |
| Random/foreign card taps | ✅ | AES auth fails → no POST |
| UID clone onto a magic card | ✅ | Clone lacks `K_card` → auth fails |
| Sniffing the air to replay a card | ✅ | Fresh nonces in the handshake |
| Replaying a captured `/api/v1/taps` POST | ✅ (with §6b) | nonce + HMAC + ts |
| Stolen companion-service API key used elsewhere | ⚠️ partial | §6b HMAC needs `S` too; rotate key |
| Extracting one card's key | ✅ contained | Diversification → only that card |
| Extracting `K_master` from the service host | ❌ | Protect host; HSM/SAM if high-value |
| Someone borrowing a real enrolled card | ❌ | Out of scope — physical/social control |

---

## 10. Rollout checklist

1. Confirm reader is **PC/SC + SDK** capable (else swap hardware). — §7
2. Buy **MIFARE DESFire EV2/EV3** cards. Avoid MIFARE Classic (broken crypto).
3. Generate and safely store **`K_master`** (env/keystore/HSM). — §3
4. Build the **companion service**: enroll mode (§4) + tap mode (§5).
5. Wire enroll mode to the existing write-card API; wire tap mode to
   `POST /api/v1/taps` with a dedicated **`taps_write`** API key. — §6a
6. (Optional) Add per-tap **HMAC attestation** + nonce store. — §6b
7. (Optional) Enable **Random ID** if unlinkability is required. — §8
8. Personalize a pilot batch; verify clones/foreign cards are rejected before
   rolling out.

---

### Files this touches when you build it

- `src/app/api/v1/taps/route.ts` — optionally verify §6b attestation; tighten
  `allowPublic`.
- `src/lib/validation.ts` — optional `auth` block on `tapRequest`.
- `src/reader.ts` — stays as-is for HID keyboard-wedge card taps; a DESFire
  AES reader instead posts from a separate companion process, not this file.
- `prisma/schema.prisma` — optional `TapNonce` table if you add replay defense
  and run multiple instances.
- Companion service — **new, out-of-repo** (or a `service/` dir): holds
  `K_master`, drives the reader, does all AES.
