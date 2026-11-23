import { randomUUID } from "node:crypto";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import type { SessionControl } from "./control-types.ts";

export function writeSessionControl(path: string, value: SessionControl): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporary, path);
  } finally { rmSync(temporary, { force: true }); }
}
