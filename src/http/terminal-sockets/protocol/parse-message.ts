import type { RawData } from "ws";
import type { Message } from "./terminal-protocol.ts";
import { object } from "../../../gateway/wire/is-record.ts";
import { exactly } from "./exactly.ts";
import { positive } from "./positive.ts";

export function parse(raw: RawData, binary: boolean): Message | undefined {
  if (binary) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw.toString()); } catch { return undefined; }
  if (!object(value)) return undefined;
  if (value.type === "ping" && exactly(value, ["type"])) return { type: "ping" };
  if (value.type === "input" && exactly(value, ["type", "data"]) && typeof value.data === "string" && value.data.length > 0) return { type: "input", data: value.data };
  if (value.type === "resize" && exactly(value, ["type", "rows", "cols"]) && positive(value.rows) && positive(value.cols)) return { type: "resize", rows: value.rows, cols: value.cols };
  return undefined;
}
