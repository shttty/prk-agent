import { MERGED_FOOTER } from "./protocol-constants.js";

const PEER_HEADER = /^\[session-message from (?:(worker) "(.*?)"|session) \(id=([^)\s]+)\) \/ message=([^\s/\]]+)(?: \/ replyTo=([^\s\]]+))?(?: \/ arrival=([1-9]\d*))?\]\n\n/;
const PEER_FOOTER = /\n\n(?:\(To answer, call session_send with to="([^"]+)" and replyTo="([^"]+)"\. Plain replies are not delivered to the sender\.\)|\(No reply expected for message=([^\s.]+)\. Do not answer it with session_send; continue your own work\.\))$/;
const MERGED_HEADER = /^\[session-messages: (\d+) received together, oldest first\]\n\n/;
const MERGED_ENTRY = /(?:^|\n\n)\[(\d+)\/(\d+) from (?:(worker) "(.*?)"|session) \(id=([^)\s]+)\) \/ message=([^\s/\]]+)(?: \/ replyTo=([^\s\]]+))?(?: \/ arrival=([1-9]\d*))? \/ (expects reply|no reply expected)\]\n\n/g;

/** Recognize only complete protocol envelopes, not ordinary text beginning with a peer tag. */
export function parsePeerMessages(text) {
  if (typeof text !== "string") return null;
  const single = PEER_HEADER.exec(text);
  if (single) {
    const rest = text.slice(single[0].length);
    const footer = PEER_FOOTER.exec(rest);
    if (!footer) return null;
    const expectReply = footer[1] !== undefined;
    if (expectReply ? footer[1] !== single[3] || footer[2] !== single[4] : footer[3] !== single[4]) return null;
    if (single[6] !== undefined && !Number.isSafeInteger(Number(single[6]))) return null;
    return [{
      label: single[2] || "", sender: single[3], messageId: single[4],
      replyTo: single[5] || "", expectReply, body: rest.slice(0, footer.index),
      ...(single[6] === undefined ? {} : { arrival: Number(single[6]) }),
    }];
  }
  const header = MERGED_HEADER.exec(text);
  if (!header || !text.endsWith(MERGED_FOOTER)) return null;
  const count = Number(header[1]);
  if (!Number.isSafeInteger(count) || count < 2) return null;
  const rest = text.slice(header[0].length, text.length - MERGED_FOOTER.length);
  const entries = [...rest.matchAll(MERGED_ENTRY)];
  if (entries.length !== count || entries[0].index !== 0
    || [...rest.matchAll(/(?:^|\n\n)\[\d+\/\d+ from /g)].length !== count
    || entries.some((entry, index) => Number(entry[1]) !== index + 1 || Number(entry[2]) !== count
      || (entry[8] !== undefined && !Number.isSafeInteger(Number(entry[8]))))) return null;
  const id = entries.map((entry) => entry[6]).join("+");
  return entries.map((entry, index) => ({
    label: entry[4] || "", sender: entry[5], messageId: entry[6],
    replyTo: entry[7] || "", expectReply: entry[9] === "expects reply",
    ...(entry[8] === undefined ? {} : { arrival: Number(entry[8]) }),
    body: rest.slice(entry.index + entry[0].length, entries[index + 1]?.index ?? rest.length),
    batch: { id, index, count },
  }));
}
