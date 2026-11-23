import { appendFileSync } from "node:fs";

export default function registerPayloadCapture(pi) {
  pi.on("before_provider_request", (event, ctx) => {
    appendFileSync(process.env.PRK_PROMPT_CAPTURE_FILE, `${JSON.stringify({
      sessionId: ctx.sessionManager.getSessionId(), payload: event.payload,
    })}\n`);
  });
}
