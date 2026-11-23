import { readFileSync } from "node:fs";
import { Type } from "typebox";
import { Value } from "typebox/value";
import type { SessionControl } from "./control-types.ts";

const schema = Type.Object({
  rootSessionId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  supervisors: Type.Record(Type.String({ minLength: 1 }), Type.String({ minLength: 1 })),
}, { additionalProperties: false });

export function readSessionControl(path: string): SessionControl {
  let text: string;
  try { text = readFileSync(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { rootSessionId: null, supervisors: {} };
    throw error;
  }
  const value: unknown = JSON.parse(text);
  if (!Value.Check(schema, value)) throw new Error("Invalid persisted session-control metadata.");
  return value;
}
