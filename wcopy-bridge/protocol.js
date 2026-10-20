// Reverse-engineered wire protocol for the "NSCCN / wCopy Smart Reader"
// (VID 0x0416, PID 0xb030). Mirrors tapintest/protocol.js — kept as a
// separate copy since this runs as an independent local service, not
// bundled with the diagnostic tool. See tapintest/protocol.js for the
// full derivation notes (Ghidra decompilation of nfcPro_x64.exe's sole
// hid_write() call site, confirmed against the real device).
//
// Outgoing frame (64 bytes):
//   [0] 0x00, [1] 0x01, [2] len+6, [3..4] seq (LE), [5..] payload,
//   [5+len] checksum = ~(sum of bytes[1..4+len]) & 0xff, [5+len+1] 0xFE,
//   then zero-padded to 64 bytes.
//
// Incoming response (64 bytes):
//   [0] 0x02, [1] totalLen (frame length through trailer, inclusive),
//   [2..3] seq echo (LE), [4..totalLen-2] content, [totalLen-1] 0xFD.

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

// Known-confirmed commands (live-tested against real hardware).
const COMMANDS = {
  deviceInfo: [0xff, 0x00, 0x68],
  reset: [0xff, 0x00, 0x9a, 0x5a, 0xa5, 0x54, 0x69, 0x61, 0x6e],
};

// The reader's chip is PN532-compatible (NXP). These payloads are our
// outer USB frame carrying a standard, PUBLICLY DOCUMENTED PN532 command
// (NXP UM0701-02) as an inner sub-frame: [0xFF,0x00,0x00,0x00,LEN, D4,
// ...PN532 command bytes...]. detectCard is confirmed byte-for-byte
// against a real API Monitor capture of nfcPro_x64.exe's actual traffic
// (UID/ATQA/SAK matched a known-good read exactly). readPage uses the
// standard FAST_READ opcode but its response shape isn't live-verified
// yet — treat parseReadPageResponse as provisional until confirmed.
const PN532_COMMANDS = {
  detectCard: [0xff, 0x00, 0x00, 0x00, 0x04, 0xd4, 0x4a, 0x01, 0x00],
  readPage: (page) => [0xff, 0x00, 0x00, 0x00, 0x06, 0xd4, 0x40, 0x01, 0x3a, page, page],
};

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

function parseReadPageResponse(content) {
  if (content.length < 3 || content[0] !== 0xd5 || content[1] !== 0x41) return null;
  const status = content[2];
  if (status !== 0x00) return { ok: false, status };
  return { ok: true, status, data: content.subarray(3) };
}

module.exports = {
  frameCommand,
  parseResponse,
  resetSequence,
  COMMANDS,
  PN532_COMMANDS,
  parseDetectResponse,
  parseReadPageResponse,
};
