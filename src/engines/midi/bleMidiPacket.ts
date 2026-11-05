// ─── BLE-MIDI packet encoding ───
//
// Bluetooth LE MIDI wraps ordinary MIDI messages in small packets:
//
//   [header, (timestamp, status, data...)+]
//
//   header    = 0b10hh_hhhh   (bits 12–7 of a 13-bit millisecond clock)
//   timestamp = 0b1lll_llll   (bits 6–0)
//
// Every message here carries its own timestamp and full status byte; running
// status saves a byte but some pianos parse it badly. A packet must fit one
// ATT write: Web Bluetooth does not expose the negotiated MTU, so we stay at
// the 20-byte minimum every BLE-MIDI device accepts.

/** Largest payload every BLE-MIDI device accepts (ATT MTU 23 − 3). */
export const BLE_MIDI_MAX_PACKET = 20;

/** Encode MIDI channel messages into as few BLE-MIDI packets as possible. */
export function encodeBleMidiPackets(
  messages: readonly (readonly number[])[],
  clockMs: number,
  maxPacket: number = BLE_MIDI_MAX_PACKET,
): Uint8Array[] {
  const ts = Math.floor(clockMs) & 0x1fff;
  const header = 0x80 | ((ts >> 7) & 0x3f);
  const stamp = 0x80 | (ts & 0x7f);

  const packets: Uint8Array[] = [];
  let current: number[] = [];

  for (const message of messages) {
    if (message.length === 0 || (message[0] & 0x80) === 0) continue;
    const bytes = [stamp, ...message.map((b, i) => (i === 0 ? b : b & 0x7f))];
    if (1 + bytes.length > maxPacket) continue;
    if (current.length > 0 && current.length + bytes.length > maxPacket) {
      packets.push(Uint8Array.from(current));
      current = [];
    }
    if (current.length === 0) current.push(header);
    current.push(...bytes);
  }
  if (current.length > 0) packets.push(Uint8Array.from(current));
  return packets;
}
