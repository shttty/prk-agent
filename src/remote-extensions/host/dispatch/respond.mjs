import { request } from "./dispatch-request.mjs";
import { send } from "../connection/send-frame.mjs";
import { encode } from "../../codec/encode.mjs";
import { asError } from "../normalize-error.mjs";

export async function respond(ctx, frame) {
  let reply;
  try {
    reply = { kind: "reply", id: frame.id, result: encode(await request(ctx, frame)) };
  } catch (error) {
    let encoded;
    try { encoded = encode(asError(error)); } catch (encodingError) { encoded = encode(asError(encodingError)); }
    reply = { kind: "reply", id: frame.id, error: encoded };
  }
  send(ctx, reply);
  if (frame.method === "shutdown") ctx.socket.end();
}
