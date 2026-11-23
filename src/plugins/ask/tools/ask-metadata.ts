import { USER_WAIT_CALLBACK } from "../../../codemode/kernel-protocol/kernel-protocol-schema.ts";
const DESCRIPTION = [
  "Ask the user questions only when the choice is a material tradeoff that only they can decide. Default: act on code, config, docs, history and conventions; when several choices are viable, pick the conservative standard one, proceed and state it.",
  "- Batch related questions into one call. Give each 2–5 distinct options with short labels; put tradeoffs in `description`.",
  "- `recommended` is the 0-based integer index into `options` of the option you suggest (0 = first, 1 = second; never the label text; the UI marks it); `multi: true` allows several selections.",
  "- NEVER add an \"Other\" option: the UI already offers a free-text row. If the user answers with custom text, take it as the answer and re-ask only what is still unresolved.",
  "- The user may decline to answer and ask to discuss first; the result says so.",
].join("\n");

export const ASK_TOOL_METADATA = { name: USER_WAIT_CALLBACK, description: DESCRIPTION };
