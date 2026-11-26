import { asText } from "./as-text.ts";
import { READ_TAIL } from "./tool-text-constants.ts";
import { READ_ONLY_NOTICE } from "./tool-text-constants.ts";
/** Split Pi's continuation notice off a read result: `{ body, notice }` (notice is "" when there is none). */
export function splitReadNotice(output: unknown): { body: string; notice: string } {
  const text = asText(output);
  if (READ_ONLY_NOTICE.test(text)) return { body: "", notice: text };
  const match = READ_TAIL.exec(text);
  return match ? { body: text.slice(0, match.index), notice: match[1] ?? "" } : { body: text, notice: "" };
}
