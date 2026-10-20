// Reverse-engineered wire protocol for the "NSCCN / wCopy Smart Reader"
// (VID 0x0416, PID 0xb030), extracted from the vendor's nfcPro_x64.exe via
// Ghidra decompilation of its sole hid_write() call site, and confirmed
// against the real device over the HID Interrupt OUT/IN pair (EP 0x02/0x81).
//
// Outgoing frame (64 bytes, always sent in full):
//   [0] 0x00                 sync byte
//   [1] 0x01                 fixed
//   [2] payload.length + 6   length field
//   [3..4] seq (uint16 LE)   increments by 2 per command
//   [5..5+len-1] payload     command-specific bytes
//   [5+len] checksum         ~(sum of bytes[1..4+len]) & 0xff
//   [5+len+1] 0xFE           trailer
//   [...] zero padding to 64 bytes
//
// Incoming response (64 bytes), verified against two real captures:
//   [0] 0x02                        sync byte
//   [1] totalLen                    covers bytes [0..totalLen-1] inclusive
//                                    (i.e. the whole frame through the trailer)
//   [2..3] seq echo (uint16 LE)     mirrors the request's sequence number
//   [4 .. totalLen-2] content       response payload (totalLen-5 bytes)
//   [totalLen-1] 0xFD               trailer (no separate checksum observed)
//   [...] zero padding to 64 bytes
// For short replies, content[0] behaves like a status/error code (e.g. 0x02
// seen consistently for "no card"). For longer replies (e.g. device info)
// content is plain ASCII. Not yet confirmed for every response type.

let seqCounter = 0;

function resetSequence() {
  seqCounter = 0;
}

function frameCommand(payload) {
  const bytes = Array.isArray(payload) ? payload : Array.from(payload);
  const buf = Buffer.alloc(64, 0);
  const len = Math.min(bytes.length, 0x30);
  buf[0] = 0x00;
  buf[1] = 0x01;
  buf[2] = (len + 6) & 0xff;
  buf[3] = seqCounter & 0xff;
  buf[4] = (seqCounter >> 8) & 0xff;
  for (let i = 0; i < len; i++) buf[5 + i] = bytes[i];
  let sum = 0;
  for (let idx = 1; idx <= 4 + len; idx++) sum = (sum + buf[idx]) & 0xff;
  buf[5 + len] = (~sum) & 0xff;
  buf[5 + len + 1] = 0xfe;
  seqCounter += 2;
  return buf;
}

// Decode a 64-byte response per the verified layout above. Still
// provisional for response shapes we haven't captured yet (e.g. a real
// card-read reply) - treat `status` as a guess, not gospel, until
// cross-checked against more real traffic.
function parseResponse(buf) {
  const sync = buf[0];
  const totalLen = buf[1];
  const seqEcho = buf[2] | (buf[3] << 8);
  const contentEnd = Math.max(4, Math.min(4 + Math.max(totalLen - 5, 0), 64));
  const content = buf.subarray(4, contentEnd);
  const trailer = totalLen >= 1 && totalLen - 1 < 64 ? buf[totalLen - 1] : undefined;
  const ascii = content.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
  return {
    sync,
    totalLen,
    seqEcho,
    status: content[0],
    content,
    contentHex: content.toString("hex"),
    ascii,
    trailer,
    raw: buf.toString("hex"),
  };
}

// The reader's chip is PN532-compatible (NXP). These payloads are our
// outer USB frame carrying a standard, PUBLICLY DOCUMENTED PN532 command
// (NXP UM0701-02) as an inner sub-frame: [0xFF,0x00,0x00,0x00,LEN, D4,
// ...PN532 command bytes...]. Confirmed against a real API Monitor
// capture of nfcPro_x64.exe's actual traffic (not guessed).
const PN532_COMMANDS = {
  // InListPassiveTarget: detect a Type A card, return UID/ATQA/SAK.
  detectCard: [0xff, 0x00, 0x00, 0x00, 0x04, 0xd4, 0x4a, 0x01, 0x00],
  // InDataExchange(Tg=1) + NTAG/Ultralight FAST_READ(page, page) — reads
  // one page (4 bytes) at a time. NTAG213 has pages 0-44 (45 total).
  readPage: (page) => [0xff, 0x00, 0x00, 0x00, 0x06, 0xd4, 0x40, 0x01, 0x3a, page, page],
};

function parseHexBytes(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  const bytes = parts.map((p) => parseInt(p, 16));
  if (bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) return null;
  return bytes;
}

// Parses the `content` field of a response to detectCard (PN532
// InListPassiveTargetResponse, CC=0x4b). Returns null if it doesn't look
// like that response shape.
function parseDetectResponse(content) {
  if (content.length < 8 || content[0] !== 0xd5 || content[1] !== 0x4b) return null;
  const nbTg = content[2];
  if (nbTg === 0) return { found: false };
  const tg = content[3];
  const atqa = content.subarray(4, 6);
  const sak = content[6];
  const uidLen = content[7];
  const uid = content.subarray(8, 8 + uidLen);
  return {
    found: true,
    tg,
    atqa: atqa.toString("hex"),
    sak: sak.toString(16).padStart(2, "0"),
    uid: uid.toString("hex"),
  };
}

// Parses the `content` field of a response to readPage (PN532
// InDataExchangeResponse, CC=0x41). Returns the raw page bytes (4 bytes
// per page for FAST_READ(N,N)), or null on error status.
function parseReadPageResponse(content) {
  if (content.length < 3 || content[0] !== 0xd5 || content[1] !== 0x41) return null;
  const status = content[2];
  if (status !== 0x00) return { ok: false, status };
  return { ok: true, status, data: content.subarray(3) };
}

module.exports = {
  frameCommand,
  parseResponse,
  parseHexBytes,
  resetSequence,
  PN532_COMMANDS,
  parseDetectResponse,
  parseReadPageResponse,
};
